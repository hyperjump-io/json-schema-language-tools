import { describe, test, expect, beforeAll } from "vitest";
import { InitializeRequest, TextDocumentSyncKind } from "vscode-languageserver";
import { getTestClient } from "./test-utils.js";


describe("JSON Schema Language Server", () => {
  let client;

  beforeAll(() => {
    client = getTestClient([]);
  });

  test("textDocumentSync = Incremental", async () => {
    /**
     * @type {import("vscode-languageserver").InitializeParams}
     */
    const init = {
      capabilities: {}
    };
    const response = await client.sendRequest(InitializeRequest, init);

    expect(response.capabilities.textDocumentSync).to.equal(TextDocumentSyncKind.Incremental);
  });
});
