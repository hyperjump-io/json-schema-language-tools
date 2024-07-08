import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  closeDocument,
  getTestClient,
  initializeServer,
  openDocument,
  setupWorkspace,
  tearDownWorkspace
} from "../test-utils.js";
import {
  DidChangeTextDocumentNotification,
  DidChangeWatchedFilesNotification,
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { resolveIri } from "@hyperjump/uri";
import documentSettings from "./document-settings.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";

import type { Connection, ServerCapabilities } from "vscode-languageserver";


describe("Feature - workspace", () => {
  let client: Connection;
  let capabilities: ServerCapabilities;
  let workspaceFolder: string;

  beforeAll(async () => {
    client = getTestClient([workspace, documentSettings, schemaRegistry]);

    workspaceFolder = await setupWorkspace({
      "subject.schema.json": `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`
    });

    capabilities = await initializeServer(client, {
      workspaceFolders: [
        {
          name: "root",
          uri: workspaceFolder
        }
      ]
    });
  });

  afterAll(async () => {
    await tearDownWorkspace(client, workspaceFolder);
  });

  test("capabilities", async () => {
    expect(capabilities.workspace).to.eql({
      workspaceFolders: {
        changeNotifications: true,
        supported: true
      }
    });
  });

  describe("changing an open schema", () => {
    let documentUri: string;

    beforeAll(async () => {
      documentUri = resolveIri("./subject.schema.json", `${workspaceFolder}/`);
      await openDocument(client, documentUri);
    });

    afterAll(async () => {
      await closeDocument(client, documentUri);
    });

    test("should validate it", async () => {
      const diagnostics = new Promise((resolve) => {
        client.onNotification(PublishDiagnosticsNotification.type, (params) => {
          resolve(params.uri);
        });
      });

      await client.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri: documentUri, version: 1 },
        contentChanges: []
      });

      expect(await diagnostics).to.equal(documentUri);
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

    await client.sendNotification(DidChangeWatchedFilesNotification.type, { changes: [] });

    expect(await validatedSchemas).to.eql([
      resolveIri("./subject.schema.json", `${workspaceFolder}/`)
    ]);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});
