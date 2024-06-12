import { beforeAll, describe, expect, test } from "vitest";
import { CompletionItemKind, CompletionRequest, InitializeRequest, InitializedNotification } from "vscode-languageserver/node.js";
import completion from "./completion.js";
import schemaCompletion from "./schema-completion.js";
import { clientCapabilities, getTestClient, openDocument } from "../test-utils.js";


describe("Feature - $schema completion", () => {
  let client;

  beforeAll(async () => {
    client = getTestClient([completion, schemaCompletion]);
    const init = {
      capabilities: clientCapabilities,
      workspaceFolders: []
    };
    await client.sendRequest(InitializeRequest.type, init);
    await client.sendNotification(InitializedNotification);
  });

  test("$schema completion", async () => {
    const documentUri = "file://path/to/workspace/subject.schema.json";
    await openDocument(client, documentUri, `{
  "$schema": ""
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 14
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);
    expect(response).to.eql([
      {
        kind: CompletionItemKind.Value,
        label: "https://json-schema.org/draft/2020-12/schema"
      },
      {
        kind: CompletionItemKind.Value,
        label: "https://json-schema.org/draft/2019-09/schema"
      },
      {
        kind: CompletionItemKind.Value,
        label: "http://json-schema.org/draft-07/schema#"
      },
      {
        kind: CompletionItemKind.Value,
        label: "http://json-schema.org/draft-06/schema#"
      },
      {
        kind: CompletionItemKind.Value,
        label: "http://json-schema.org/draft-04/schema#"
      }
    ]);
  });
});
