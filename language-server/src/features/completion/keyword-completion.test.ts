import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { CompletionRequest, CompletionItemKind } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";


describe("Feature - keyword completion", () => {
  let client: TestClient;
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

  test("Keyword Completion 2020-12", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 3
      }
    });

    expect(response).to.eql([
      { label: "$anchor", kind: CompletionItemKind.Value },
      { label: "$comment", kind: CompletionItemKind.Value },
      { label: "$defs", kind: CompletionItemKind.Value },
      { label: "$dynamicAnchor", kind: CompletionItemKind.Value },
      { label: "$dynamicRef", kind: CompletionItemKind.Value },
      { label: "$id", kind: CompletionItemKind.Value },
      { label: "$ref", kind: CompletionItemKind.Value },
      { label: "$vocabulary", kind: CompletionItemKind.Value },
      { label: "additionalProperties", kind: CompletionItemKind.Value },
      { label: "allOf", kind: CompletionItemKind.Value },
      { label: "anyOf", kind: CompletionItemKind.Value },
      { label: "contains", kind: CompletionItemKind.Value },
      { label: "dependentSchemas", kind: CompletionItemKind.Value },
      { label: "if", kind: CompletionItemKind.Value },
      { label: "then", kind: CompletionItemKind.Value },
      { label: "else", kind: CompletionItemKind.Value },
      { label: "items", kind: CompletionItemKind.Value },
      { label: "not", kind: CompletionItemKind.Value },
      { label: "oneOf", kind: CompletionItemKind.Value },
      { label: "patternProperties", kind: CompletionItemKind.Value },
      { label: "prefixItems", kind: CompletionItemKind.Value },
      { label: "properties", kind: CompletionItemKind.Value },
      { label: "propertyNames", kind: CompletionItemKind.Value },
      { label: "unevaluatedItems", kind: CompletionItemKind.Value },
      { label: "unevaluatedProperties", kind: CompletionItemKind.Value },
      { label: "const", kind: CompletionItemKind.Value },
      { label: "dependentRequired", kind: CompletionItemKind.Value },
      { label: "enum", kind: CompletionItemKind.Value },
      { label: "exclusiveMaximum", kind: CompletionItemKind.Value },
      { label: "exclusiveMinimum", kind: CompletionItemKind.Value },
      { label: "maxContains", kind: CompletionItemKind.Value },
      { label: "maxItems", kind: CompletionItemKind.Value },
      { label: "maxLength", kind: CompletionItemKind.Value },
      { label: "maxProperties", kind: CompletionItemKind.Value },
      { label: "maximum", kind: CompletionItemKind.Value },
      { label: "minContains", kind: CompletionItemKind.Value },
      { label: "minItems", kind: CompletionItemKind.Value },
      { label: "minLength", kind: CompletionItemKind.Value },
      { label: "minProperties", kind: CompletionItemKind.Value },
      { label: "minimum", kind: CompletionItemKind.Value },
      { label: "multipleOf", kind: CompletionItemKind.Value },
      { label: "pattern", kind: CompletionItemKind.Value },
      { label: "required", kind: CompletionItemKind.Value },
      { label: "type", kind: CompletionItemKind.Value },
      { label: "uniqueItems", kind: CompletionItemKind.Value },
      { label: "default", kind: CompletionItemKind.Value },
      { label: "deprecated", kind: CompletionItemKind.Value },
      { label: "description", kind: CompletionItemKind.Value },
      { label: "examples", kind: CompletionItemKind.Value },
      { label: "readOnly", kind: CompletionItemKind.Value },
      { label: "title", kind: CompletionItemKind.Value },
      { label: "writeOnly", kind: CompletionItemKind.Value },
      { label: "format", kind: CompletionItemKind.Value },
      { label: "contentEncoding", kind: CompletionItemKind.Value },
      { label: "contentMediaType", kind: CompletionItemKind.Value },
      { label: "contentSchema", kind: CompletionItemKind.Value }
    ]);
  });
  test("Keyword Completion 2019-09", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 3
      }
    });

    expect(response).to.eql([
      { label: "$anchor", kind: CompletionItemKind.Value },
      { label: "$comment", kind: CompletionItemKind.Value },
      { label: "$defs", kind: CompletionItemKind.Value },
      { label: "$recursiveAnchor", kind: CompletionItemKind.Value },
      { label: "$recursiveRef", kind: CompletionItemKind.Value },
      { label: "$id", kind: CompletionItemKind.Value },
      { label: "$ref", kind: CompletionItemKind.Value },
      { label: "$vocabulary", kind: CompletionItemKind.Value },
      { label: "additionalItems", kind: CompletionItemKind.Value },
      { label: "additionalProperties", kind: CompletionItemKind.Value },
      { label: "allOf", kind: CompletionItemKind.Value },
      { label: "anyOf", kind: CompletionItemKind.Value },
      { label: "contains", kind: CompletionItemKind.Value },
      { label: "dependentSchemas", kind: CompletionItemKind.Value },
      { label: "if", kind: CompletionItemKind.Value },
      { label: "then", kind: CompletionItemKind.Value },
      { label: "else", kind: CompletionItemKind.Value },
      { label: "items", kind: CompletionItemKind.Value },
      { label: "not", kind: CompletionItemKind.Value },
      { label: "oneOf", kind: CompletionItemKind.Value },
      { label: "patternProperties", kind: CompletionItemKind.Value },
      { label: "properties", kind: CompletionItemKind.Value },
      { label: "propertyNames", kind: CompletionItemKind.Value },
      { label: "unevaluatedItems", kind: CompletionItemKind.Value },
      { label: "unevaluatedProperties", kind: CompletionItemKind.Value },
      { label: "const", kind: CompletionItemKind.Value },
      { label: "enum", kind: CompletionItemKind.Value },
      { label: "dependentRequired", kind: CompletionItemKind.Value },
      { label: "exclusiveMaximum", kind: CompletionItemKind.Value },
      { label: "exclusiveMinimum", kind: CompletionItemKind.Value },
      { label: "maxContains", kind: CompletionItemKind.Value },
      { label: "maxItems", kind: CompletionItemKind.Value },
      { label: "maxLength", kind: CompletionItemKind.Value },
      { label: "maxProperties", kind: CompletionItemKind.Value },
      { label: "maximum", kind: CompletionItemKind.Value },
      { label: "minContains", kind: CompletionItemKind.Value },
      { label: "minItems", kind: CompletionItemKind.Value },
      { label: "minLength", kind: CompletionItemKind.Value },
      { label: "minProperties", kind: CompletionItemKind.Value },
      { label: "minimum", kind: CompletionItemKind.Value },
      { label: "multipleOf", kind: CompletionItemKind.Value },
      { label: "pattern", kind: CompletionItemKind.Value },
      { label: "required", kind: CompletionItemKind.Value },
      { label: "type", kind: CompletionItemKind.Value },
      { label: "uniqueItems", kind: CompletionItemKind.Value },
      { label: "default", kind: CompletionItemKind.Value },
      { label: "deprecated", kind: CompletionItemKind.Value },
      { label: "description", kind: CompletionItemKind.Value },
      { label: "examples", kind: CompletionItemKind.Value },
      { label: "readOnly", kind: CompletionItemKind.Value },
      { label: "title", kind: CompletionItemKind.Value },
      { label: "writeOnly", kind: CompletionItemKind.Value },
      { label: "format", kind: CompletionItemKind.Value },
      { label: "contentEncoding", kind: CompletionItemKind.Value },
      { label: "contentMediaType", kind: CompletionItemKind.Value },
      { label: "contentSchema", kind: CompletionItemKind.Value }
    ]);
  });

  test("Keyword Completion draft-07", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 3
      }
    });

    expect(response).to.eql([
      { label: "$id", kind: CompletionItemKind.Value },
      { label: "$ref", kind: CompletionItemKind.Value },
      { label: "$comment", kind: CompletionItemKind.Value },
      { label: "additionalItems", kind: CompletionItemKind.Value },
      { label: "additionalProperties", kind: CompletionItemKind.Value },
      { label: "allOf", kind: CompletionItemKind.Value },
      { label: "anyOf", kind: CompletionItemKind.Value },
      { label: "const", kind: CompletionItemKind.Value },
      { label: "contains", kind: CompletionItemKind.Value },
      { label: "contentEncoding", kind: CompletionItemKind.Value },
      { label: "contentMediaType", kind: CompletionItemKind.Value },
      { label: "default", kind: CompletionItemKind.Value },
      { label: "definitions", kind: CompletionItemKind.Value },
      { label: "dependencies", kind: CompletionItemKind.Value },
      { label: "description", kind: CompletionItemKind.Value },
      { label: "enum", kind: CompletionItemKind.Value },
      { label: "examples", kind: CompletionItemKind.Value },
      { label: "exclusiveMaximum", kind: CompletionItemKind.Value },
      { label: "exclusiveMinimum", kind: CompletionItemKind.Value },
      { label: "format", kind: CompletionItemKind.Value },
      { label: "if", kind: CompletionItemKind.Value },
      { label: "then", kind: CompletionItemKind.Value },
      { label: "else", kind: CompletionItemKind.Value },
      { label: "items", kind: CompletionItemKind.Value },
      { label: "maxItems", kind: CompletionItemKind.Value },
      { label: "maxLength", kind: CompletionItemKind.Value },
      { label: "maxProperties", kind: CompletionItemKind.Value },
      { label: "maximum", kind: CompletionItemKind.Value },
      { label: "minItems", kind: CompletionItemKind.Value },
      { label: "minLength", kind: CompletionItemKind.Value },
      { label: "minProperties", kind: CompletionItemKind.Value },
      { label: "minimum", kind: CompletionItemKind.Value },
      { label: "multipleOf", kind: CompletionItemKind.Value },
      { label: "not", kind: CompletionItemKind.Value },
      { label: "oneOf", kind: CompletionItemKind.Value },
      { label: "pattern", kind: CompletionItemKind.Value },
      { label: "patternProperties", kind: CompletionItemKind.Value },
      { label: "properties", kind: CompletionItemKind.Value },
      { label: "propertyNames", kind: CompletionItemKind.Value },
      { label: "readOnly", kind: CompletionItemKind.Value },
      { label: "required", kind: CompletionItemKind.Value },
      { label: "title", kind: CompletionItemKind.Value },
      { label: "type", kind: CompletionItemKind.Value },
      { label: "uniqueItems", kind: CompletionItemKind.Value },
      { label: "writeOnly", kind: CompletionItemKind.Value }
    ]);
  });

  test("Keyword Completion draft-06", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-06/schema#",
  ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 3
      }
    });

    expect(response).to.eql([
      { label: "$id", kind: CompletionItemKind.Value },
      { label: "$ref", kind: CompletionItemKind.Value },
      { label: "additionalItems", kind: CompletionItemKind.Value },
      { label: "additionalProperties", kind: CompletionItemKind.Value },
      { label: "allOf", kind: CompletionItemKind.Value },
      { label: "anyOf", kind: CompletionItemKind.Value },
      { label: "const", kind: CompletionItemKind.Value },
      { label: "contains", kind: CompletionItemKind.Value },
      { label: "default", kind: CompletionItemKind.Value },
      { label: "definitions", kind: CompletionItemKind.Value },
      { label: "dependencies", kind: CompletionItemKind.Value },
      { label: "description", kind: CompletionItemKind.Value },
      { label: "enum", kind: CompletionItemKind.Value },
      { label: "examples", kind: CompletionItemKind.Value },
      { label: "exclusiveMaximum", kind: CompletionItemKind.Value },
      { label: "exclusiveMinimum", kind: CompletionItemKind.Value },
      { label: "format", kind: CompletionItemKind.Value },
      { label: "items", kind: CompletionItemKind.Value },
      { label: "maxItems", kind: CompletionItemKind.Value },
      { label: "maxLength", kind: CompletionItemKind.Value },
      { label: "maxProperties", kind: CompletionItemKind.Value },
      { label: "maximum", kind: CompletionItemKind.Value },
      { label: "minItems", kind: CompletionItemKind.Value },
      { label: "minLength", kind: CompletionItemKind.Value },
      { label: "minProperties", kind: CompletionItemKind.Value },
      { label: "minimum", kind: CompletionItemKind.Value },
      { label: "multipleOf", kind: CompletionItemKind.Value },
      { label: "not", kind: CompletionItemKind.Value },
      { label: "oneOf", kind: CompletionItemKind.Value },
      { label: "pattern", kind: CompletionItemKind.Value },
      { label: "patternProperties", kind: CompletionItemKind.Value },
      { label: "properties", kind: CompletionItemKind.Value },
      { label: "propertyNames", kind: CompletionItemKind.Value },
      { label: "required", kind: CompletionItemKind.Value },
      { label: "title", kind: CompletionItemKind.Value },
      { label: "type", kind: CompletionItemKind.Value },
      { label: "uniqueItems", kind: CompletionItemKind.Value }
    ]);
  });

  test("Keyword Completion draft-04", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 3
      }
    });

    expect(response).to.eql([
      { label: "id", kind: CompletionItemKind.Value },
      { label: "$ref", kind: CompletionItemKind.Value },
      { label: "additionalItems", kind: CompletionItemKind.Value },
      { label: "additionalProperties", kind: CompletionItemKind.Value },
      { label: "allOf", kind: CompletionItemKind.Value },
      { label: "anyOf", kind: CompletionItemKind.Value },
      { label: "default", kind: CompletionItemKind.Value },
      { label: "definitions", kind: CompletionItemKind.Value },
      { label: "dependencies", kind: CompletionItemKind.Value },
      { label: "description", kind: CompletionItemKind.Value },
      { label: "enum", kind: CompletionItemKind.Value },
      { label: "exclusiveMaximum", kind: CompletionItemKind.Value },
      { label: "exclusiveMinimum", kind: CompletionItemKind.Value },
      { label: "format", kind: CompletionItemKind.Value },
      { label: "items", kind: CompletionItemKind.Value },
      { label: "maxItems", kind: CompletionItemKind.Value },
      { label: "maxLength", kind: CompletionItemKind.Value },
      { label: "maxProperties", kind: CompletionItemKind.Value },
      { label: "maximum", kind: CompletionItemKind.Value },
      { label: "minItems", kind: CompletionItemKind.Value },
      { label: "minLength", kind: CompletionItemKind.Value },
      { label: "minProperties", kind: CompletionItemKind.Value },
      { label: "minimum", kind: CompletionItemKind.Value },
      { label: "multipleOf", kind: CompletionItemKind.Value },
      { label: "not", kind: CompletionItemKind.Value },
      { label: "oneOf", kind: CompletionItemKind.Value },
      { label: "pattern", kind: CompletionItemKind.Value },
      { label: "patternProperties", kind: CompletionItemKind.Value },
      { label: "properties", kind: CompletionItemKind.Value },
      { label: "required", kind: CompletionItemKind.Value },
      { label: "title", kind: CompletionItemKind.Value },
      { label: "type", kind: CompletionItemKind.Value },
      { label: "uniqueItems", kind: CompletionItemKind.Value }
    ]);
  });

  test("No completions when the node is not a property", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": ""
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 11
      }
    });

    expect(response).to.eql([]);
  });

  test("No completions when the parent is not a schema", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "properties": {
    ""
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 3,
        character: 5
      }
    });

    expect(response).to.eql([]);
  });
});
