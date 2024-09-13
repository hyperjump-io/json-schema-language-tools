import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { CompletionItemKind, CompletionRequest } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.js";

import type { DocumentSettings } from "../../services/configuration.js";


describe("Feature - $schema completion", () => {
  let client: TestClient<DocumentSettings>;
  let documentUri: string;

  beforeAll(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.closeDocument(documentUri);
  });

  afterAll(async () => {
    await client.stop();
  });

  test("$schema completion with string", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

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
    await client.writeDocument("subject.schema.json", `{
  "$schema":
}`);
    documentUri = await client.openDocument("subject.schema.json");

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
    await client.writeDocument("subject.schema.json", `{
  "$schema": 
}`);
    documentUri = await client.openDocument("subject.schema.json");

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
    await client.writeDocument("subject.schema.json", `{
  "$schema"
}`);
    documentUri = await client.openDocument("subject.schema.json");

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
