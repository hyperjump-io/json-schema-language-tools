import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../test-client.js";
import { setupWorkspace, tearDownWorkspace } from "../test-utils.js";
import {
  DidChangeWatchedFilesNotification,
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";
import { resolveIri } from "../util.js";

import type { DocumentSettings } from "./document-settings.js";


describe("Feature - workspace", () => {
  let client: TestClient<DocumentSettings>;
  let workspaceFolder: string;

  beforeAll(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      semanticTokens,
      schemaRegistry
    ]);

    workspaceFolder = await setupWorkspace({
      "subject.schema.json": `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`
    });

    await client.start({
      workspaceFolders: [
        {
          name: "root",
          uri: workspaceFolder
        }
      ]
    });
  });

  afterAll(async () => {
    await client.stop();
    await tearDownWorkspace(workspaceFolder);
  });

  test("capabilities", async () => {
    expect(client.serverCapabilities?.workspace).to.eql({
      workspaceFolders: {
        changeNotifications: true,
        supported: true
      }
    });
  });

  test("opening a schema should validate it", async () => {
    const diagnostics = new Promise((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.uri);
      });
    });

    const documentUri = resolveIri("./subject.schema.json", `${workspaceFolder}/`);
    await client.openDocument(documentUri);

    expect(await diagnostics).to.equal(documentUri);
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

    await client.sendNotification(DidChangeWatchedFilesNotification.type, { changes: [] });

    expect(await validatedSchemas).to.eql([
      resolveIri("./subject.schema.json", `${workspaceFolder}/`)
    ]);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});
