import { beforeAll, describe, expect, test } from "vitest";
import { InitializeRequest } from "vscode-languageserver";
import { getTestClient } from "../test-utils.js";
import completion from "./completion.js";


describe("Feature - Completion", () => {
  let client;

  beforeAll(() => {
    client = getTestClient([completion]);
  });

  test("completion provider capabilities", async () => {
    /**
     * @type {import("vscode-languageserver").InitializeParams}
     */
    const init = {
      capabilities: {}
    };
    const response = await client.sendRequest(InitializeRequest, init);

    const completionProvider = {
      resolveProvider: false,
      triggerCharacters: ["\"", ":", " "]
    };
    expect(response.capabilities.completionProvider).to.eql(completionProvider);
  });
});
