import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getTestClient, initializeServer, setupWorkspace, tearDownWorkspace } from "../test-utils.js";
import {
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { utimes } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveIri } from "@hyperjump/uri";
import workspace from "./workspace.js";
import documentSettings from "./document-settings.js";
import schemaRegistry from "./schema-registry.js";


describe("Feature - workspace (neovim)", () => {
  let client;
  let capabilities;
  let workspaceFolder;

  beforeAll(async () => {
    client = getTestClient([workspace, documentSettings, schemaRegistry]);

    workspaceFolder = await setupWorkspace({
      "subject.schema.json": `{ "$schema": "https://json-schema.org/draft/2020-12/cshema" }`
    });

    /**
     * @type {import("vscode-languageserver").InitializeParams}
     */
    const init = {
      capabilities: {
        workspace: {
          didChangeWatchedFiles: {
            dynamicRegistration: false
          }
        }
      },
      workspaceFolders: [
        { uri: workspaceFolder }
      ]
    };
    capabilities = await initializeServer(client, init);

    // Block for a while to allow InitializedNotification time to finish. This
    // is only needed for the node-based workspace watching used for neovim
    await wait(10);
  });

  afterAll(async () => {
    await client.dispose();
    await tearDownWorkspace(workspaceFolder);
  });

  test("capabilities", async () => {
    expect(capabilities.workspace).to.eql({
      workspaceFolders: {
        changeNotifications: true,
        supported: true
      }
    });
  });

  test("a change to a watched file should validate the workspace", async () => {
    const validatedSchemas = new Promise((resolve) => {
      let schemaUris;

      client.onRequest(WorkDoneProgressCreateRequest, ({ token }) => {
        client.onProgress(WorkDoneProgress, token, ({ kind }) => {
          if (kind === "begin") {
            schemaUris = [];
          } else if (kind === "end") {
            resolve(schemaUris);
          }
        });
      });

      client.onNotification(PublishDiagnosticsNotification, (params) => {
        schemaUris.push(params.uri);
      });
    });

    const subjectSchemaUri = resolveIri("./subject.schema.json", `${workspaceFolder}/`);
    await touch(fileURLToPath(subjectSchemaUri));

    expect(await validatedSchemas).to.eql([subjectSchemaUri]);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});

const wait = async (delay) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};

const touch = (path) => {
  const time = new Date();
  return utimes(path, time, time);
};
