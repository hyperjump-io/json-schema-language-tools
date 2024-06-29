import { describe, test, expect, beforeAll } from "vitest";
import { TextDocumentSyncKind } from "vscode-languageserver";
import { getTestClient, initializeServer } from "./test-utils.js";

import type { Connection, ServerCapabilities } from "vscode-languageserver";


describe("JSON Schema Language Server", () => {
  let client: Connection;
  let capabilities: ServerCapabilities;

  beforeAll(async () => {
    client = getTestClient([]);
    capabilities = await initializeServer(client);
  });

  test("textDocumentSync = Incremental", async () => {
    expect(capabilities.textDocumentSync).to.equal(TextDocumentSyncKind.Incremental);
  });
});
