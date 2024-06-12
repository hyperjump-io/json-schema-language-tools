import { beforeAll, describe, expect, test } from "vitest";
import { clientCapabilities, getTestClient } from "../test-utils.js";
import { CompletionRequest, InitializeRequest, InitializedNotification } from "vscode-languageserver";
import completion from "./completion.js";
import schemaCompletion from "./schema-completion.js";


describe("Feature - $schema completion", () => {
  let client;

  beforeAll(async () => {
    client = getTestClient([completion, schemaCompletion]);
    const init = {
      capabilities: clientCapabilities,
      workspaceFolders: ["./src/test-workspace"]
    };
    await client.sendRequest(InitializeRequest.type, init);
    await client.sendNotification(InitializedNotification);
  });

  test("$schema completion", async () => {
    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: "./src/test-workspace/test.schema.json" },
      position: {
        line: 1,
        character: 14
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);
    expect(response).to.equal(null);
  });
});
