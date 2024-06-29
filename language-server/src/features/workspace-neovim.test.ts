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

import type { Connection, ServerCapabilities } from "vscode-languageserver";


describe("Feature - workspace (neovim)", () => {
  let client: Connection;
  let capabilities: ServerCapabilities;
  let workspaceFolder: string;

  beforeAll(async () => {
    client = getTestClient([workspace, documentSettings, schemaRegistry]);

    workspaceFolder = await setupWorkspace({
      "subject.schema.json": `{ "$schema": "https://json-schema.org/draft/2020-12/cshema" }`
    });

    capabilities = await initializeServer(client, {
      capabilities: {
        workspace: {
          didChangeWatchedFiles: {
            dynamicRegistration: false
          }
        }
      },
      workspaceFolders: [
        {
          name: "root",
          uri: workspaceFolder
        }
      ]
    });

    // Block for a while to allow InitializedNotification time to finish. This
    // is only needed for the node-based workspace watching used for neovim
    await wait(10);
  });

  afterAll(async () => {
    client.dispose();
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
      let schemaUris: string[];

      client.onRequest(WorkDoneProgressCreateRequest.type, ({ token }) => {
        client.onProgress(WorkDoneProgress.type, token, ({ kind }) => {
          if (kind === "begin") {
            schemaUris = [];
          } else if (kind === "end") {
            resolve(schemaUris);
          }
        });
      });

      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
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

const wait = async (delay: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};

const touch = (path: string) => {
  const time = new Date();
  return utimes(path, time, time);
};
