import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { DidChangeWatchedFilesNotification, PublishDiagnosticsNotification, TextDocumentSyncKind, WorkDoneProgress, WorkDoneProgressCreateRequest } from "vscode-languageserver";
import { TestClient } from "../test/test-client.js";

import type { DocumentSettings } from "./configuration.js";


describe("JSON Schema Language Server", () => {
  let client: TestClient<DocumentSettings>;
  let documentUri: string;

  beforeAll(async () => {
    client = new TestClient();
    documentUri = await client.writeDocument("./subject.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);

    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  test("textDocumentSync = Incremental", async () => {
    expect(client.serverCapabilities?.textDocumentSync).to.equal(TextDocumentSyncKind.Incremental);
  });

  test("workspace folders are supported", async () => {
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
