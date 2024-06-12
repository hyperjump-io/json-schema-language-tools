import { beforeAll, describe, expect, test } from "vitest";
import { CompletionItemKind, InsertTextFormat, CompletionRequest, InitializeRequest, InitializedNotification } from "vscode-languageserver/node.js";
import completion from "./completion.js";
import ifThenCompletionFeature from "./if-then-completion.js";
import { clientCapabilities, getTestClient, openDocument } from "../test-utils.js";


describe("Feature - if/then completion", () => {
  let client;

  beforeAll(async () => {
    client = getTestClient([completion, ifThenCompletionFeature]);
    const init = {
      capabilities: clientCapabilities,
      workspaceFolders: []
    };
    await client.sendRequest(InitializeRequest.type, init);
    await client.sendNotification(InitializedNotification);
  });

  test("if/then completion", async () => {
    const documentUri = "file://path/to/workspace/subject1.schema.json";
    await openDocument(client, documentUri, `{
  "if": ""
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 6
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);

    expect(response).to.eql([
      {
        label: "if/then",
        kind: CompletionItemKind.Snippet,
        // eslint-disable-next-line no-template-curly-in-string
        insertText: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"${1:propertyName}\": { \"const\": ${2:value} }\n  },\n  \"required\": [\"${1:propertyName}\"]\n},\n\"then\": ${3:{}}",
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: "Basic if/then pattern with a single condition and corresponding schema."
      },
      {
        label: "If/then/else",
        kind: CompletionItemKind.Snippet,
        // eslint-disable-next-line no-template-curly-in-string
        insertText: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"${1:varName}\": { \"const\": ${2:value} }\n  },\n  \"required\": [\"${1:varName}\"]\n},\n\"then\": ${3:{}},\n\"else\": ${4:{}}",
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: "Conditional object structure with if/then/else logic"
      }

    ]);
  });
});
