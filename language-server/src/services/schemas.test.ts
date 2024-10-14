import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PublishDiagnosticsNotification, TextDocumentSyncKind } from "vscode-languageserver";
import { TestClient } from "../test/test-client.ts";

import type { DocumentSettings } from "./configuration.js";


describe("JSON Schema Language Server", () => {
  let client: TestClient<DocumentSettings>;
  let documentUriA: string;
  let documentUriB: string;

  beforeAll(async () => {
    client = new TestClient();
    await client.start();

    documentUriA = await client.writeDocument("./subjectA.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);
    documentUriB = await client.writeDocument("./subjectB.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);
  });

  afterAll(async () => {
    await client.stop();
  });

  test("textDocumentSync = Incremental", () => {
    expect(client.serverCapabilities?.textDocumentSync).to.equal(TextDocumentSyncKind.Incremental);
  });

  test("workspace folders are supported", () => {
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

    await client.openDocument(documentUriA);

    expect(await diagnostics).to.equal(documentUriA);
  });

  test("a change to a watched file should validate the workspace", async () => {
    const schemaUris: string[] = [];

    client.onNotification(PublishDiagnosticsNotification.type, (params) => {
      schemaUris.push(params.uri);
    });

    await client.writeDocument("./subjectB.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/cshema" }`);

    expect(schemaUris).to.eql([documentUriA, documentUriB]);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});
