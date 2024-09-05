import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../test-client.js";
import {
  DidChangeWatchedFilesNotification,
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import validateSchema from "./validate-schema.js";
import validateWorkspace from "./validate-workspace.js";
import workspace from "./workspace.js";

import type { DocumentSettings } from "./document-settings.js";


describe("Feature - workspace", () => {
  let client: TestClient<DocumentSettings>;
  let documentUri: string;

  beforeAll(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      validateSchema,
      validateWorkspace,
      semanticTokens
    ]);

    documentUri = await client.writeDocument("./subject.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
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

    expect(await validatedSchemas).to.eql([documentUri]);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});
