import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { TextDocumentSyncKind } from "vscode-languageserver";
import { TestClient } from "./test-client.js";

import type { DocumentSettings } from "./configuration.js";


describe("JSON Schema Language Server", () => {
  let client: TestClient<DocumentSettings>;

  beforeAll(async () => {
    client = new TestClient([]);
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  test("textDocumentSync = Incremental", async () => {
    expect(client.serverCapabilities?.textDocumentSync).to.equal(TextDocumentSyncKind.Incremental);
  });
});
