import { beforeAll, describe, expect, test } from "vitest";
import { InitializeRequest } from "vscode-languageserver/node";
import { getTestClient } from "../test-utils.js";
import completion from "./completion.js";


describe("Feature - Completion", () => {
  let client;

  beforeAll(() => {
    client = getTestClient([completion]);
  });

  test("completion provider capabilities", async () => {
    /**
     * @type {import("vscode-languageserver/node.js").InitializeParams}
     */
    const init = {
      capabilities: {},
      workspaceFolders: []
    };
    const response = await client.sendRequest(InitializeRequest.type, init);

    const completionProvider = {
      resolveProvider: false,
      triggerCharacters: ["\"", ":", " "]
    };
    expect(response.capabilities.completionProvider).to.eql(completionProvider);
  });
});
