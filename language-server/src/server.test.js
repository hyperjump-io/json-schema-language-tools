import { describe, test, expect, beforeAll } from "vitest";
import { InitializeRequest, TextDocumentSyncKind } from "vscode-languageserver/node";
import { clientCapabilities, getTestClient } from "./test-utils.js";


describe("JSON Schema Language Server", () => {
  let client;

  beforeAll(() => {
    client = getTestClient([]);
  });

  test("textDocumentSync = Incremental", async () => {
    /**
     * @type {import("vscode-languageserver/node.js").InitializeParams}
     */
    const init = {
      capabilities: clientCapabilities,
      workspaceFolders: []
    };
    const response = await client.sendRequest(InitializeRequest.type, init);

    expect(response.capabilities.textDocumentSync).to.equal(TextDocumentSyncKind.Incremental);
  });
});
