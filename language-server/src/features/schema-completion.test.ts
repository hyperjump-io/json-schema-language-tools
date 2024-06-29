import { beforeAll, describe, expect, test } from "vitest";
import { CompletionItemKind, CompletionRequest } from "vscode-languageserver";
import completion from "./completion.js";
import schemaCompletion from "./schema-completion.js";
import { getTestClient, initializeServer, openDocument } from "../test-utils.js";

import type { Connection } from "vscode-languageserver";


describe("Feature - $schema completion", () => {
  let client: Connection;

  beforeAll(async () => {
    client = getTestClient([completion, schemaCompletion]);
    await initializeServer(client);
  });

  test("$schema completion with string", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "$schema": ""
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 14
      }
    });
    expect(response).to.eql(expectedCompletions);
  });

  test("$schema completion with colon", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "$schema":
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 12
      }
    });
    expect(response).to.eql([]);
  });

  test("$schema completion with colon and space", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "$schema": 
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 13
      }
    });
    expect(response).to.eql([]);
  });

  test("$schema completion without colon", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "$schema"
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 11
      }
    });
    expect(response).to.eql([]);
  });
});

const expectedCompletions = [
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
];
