import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { SemanticTokensRequest } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import semanticTokensFeature from "./semantic-tokens.js";
import workspace from "./workspace.js";
import type { DocumentSettings } from "./document-settings.js";
import documentSettings from "./document-settings.js";


describe("Feature - Semantic Tokens", () => {
  let client: TestClient<DocumentSettings>;
  let documentUri: string;

  beforeAll(async () => {
    client = new TestClient([
      documentSettings,
      semanticTokensFeature,
      workspace
    ]);

    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  test("semantic tokens on a watched file", async () => {
    await client.changeConfiguration({ "schemaFilePatterns": ["**/subject.schema.json"] });
    documentUri = await client.openDocument("subject.schema.json", `{"$schema":"http://json-schema.org/draft-07/schema#",
"type": "string",
"minLength": 10,
"maxLength": 5
}`);

    const response = await client.sendRequest(SemanticTokensRequest.type, {
      textDocument: { uri: documentUri }
    });

    expect(response?.data).to.eql([0, 1, 9, 1, 0, 1, 0, 6, 1, 0, 1, 0, 11, 1, 0, 1, 0, 11, 1, 0]);
  });

  test("no semantic tokens", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{
"type": "string",
"minLength": 10,
"maxLength": 5}`);

    const response = await client.sendRequest(SemanticTokensRequest.type, {
      textDocument: { uri: documentUri }
    });

    expect(response?.data).to.eql([]);
  });

  test("no semantic tokens on an unwatched file", async () => {
    await client.changeConfiguration({ "schemaFilePatterns": ["**/subject.schema.json"] });
    documentUri = await client.openDocument("subjectB.schema.json", `{"$schema":"http://json-schema.org/draft-07/schema#",
      "type": "string",
      "minLength": 10,
      "maxLength": 5
      }`);

    const response = await client.sendRequest(SemanticTokensRequest.type, {
      textDocument: { uri: documentUri }
    });

    expect(response?.data).to.eql([]);
  });

  test("change in watch file patterns refreshes tokens", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{"$schema":"http://json-schema.org/draft-07/schema#",
"type": "string",
"minLength": 10,
"maxLength": 5
}`);

    await client.changeConfiguration({ "schemaFilePatterns": ["**/subjectC.schema.json"] });

    const response = await client.sendRequest(SemanticTokensRequest.type, {
      textDocument: { uri: documentUri }
    });

    expect(response?.data).to.eql([]);
  });

  test("a property in not in a schema should not be highlighted", async () => {
    await client.changeConfiguration({ "schemaFilePatterns": ["**/subject.schema.json"] });
    documentUri = await client.openDocument("subject.schema.json", `{
"$schema":"http://json-schema.org/draft-07/schema#",
"properties": {
"items": {}
}
}`);

    const response = await client.sendRequest(SemanticTokensRequest.type, {
      textDocument: { uri: documentUri }
    });

    const expected: number[] = [1, 0, 9, 1, 0, 1, 0, 12, 1, 0];
    expect(response?.data).to.eql(expected);
  });

  describe("2020-12", () => {
    let documentUri: string;

    afterAll(async () => {
      await client.closeDocument(documentUri);
    });


    test.each([
      // Applicators
      ["prefixItems", "[{}]", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["items", "{}", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],
      ["contains", "{}", [1, 2, 9, 1, 0, 1, 2, 10, 1, 0]],
      ["additionalProperties", "{}", [1, 2, 9, 1, 0, 1, 2, 22, 1, 0]],
      ["properties", "{}", [1, 2, 9, 1, 0, 1, 2, 12, 1, 0]],
      ["patternProperties", "{}", [1, 2, 9, 1, 0, 1, 2, 19, 1, 0]],
      ["dependentSchemas", "{}", [1, 2, 9, 1, 0, 1, 2, 18, 1, 0]],
      ["propertyNames", "{}", [1, 2, 9, 1, 0, 1, 2, 15, 1, 0]],
      ["if", "{}", [1, 2, 9, 1, 0, 1, 2, 4, 1, 0]],
      ["then", "{}", [1, 2, 9, 1, 0, 1, 2, 6, 1, 0]],
      ["else", "{}", [1, 2, 9, 1, 0, 1, 2, 6, 1, 0]],
      ["allOf", "[{}]", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],
      ["anyOf", "[{}]", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],
      ["oneOf", "[{}]", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],
      ["not", "{}", [1, 2, 9, 1, 0, 1, 2, 5, 1, 0]],

      // Content
      ["contentMediaType", "\"\"", [1, 2, 9, 1, 0, 1, 2, 18, 1, 0]],
      ["contentEncoding", "\"\"", [1, 2, 9, 1, 0, 1, 2, 17, 1, 0]],
      ["contentSchema", "{}", [1, 2, 9, 1, 0, 1, 2, 15, 1, 0]],

      // Core
      ["$id", "\"\"", [1, 2, 9, 1, 0, 1, 2, 5, 1, 0]],
      ["$anchor", "\"foo\"", [1, 2, 9, 1, 0, 1, 2, 9, 1, 0]],
      ["$ref", "\"\"", [1, 2, 9, 1, 0, 1, 2, 6, 1, 0]],
      ["$dynamicRef", "\"\"", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["$dynamicAnchor", "\"foo\"", [1, 2, 9, 1, 0, 1, 2, 16, 1, 0]],
      ["$vocabulary", "{}", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["$comment", "\"\"", [1, 2, 9, 1, 0, 1, 2, 14, 2, 0]],
      ["$defs", "{}", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],

      // Format
      ["format", "\"\"", [1, 2, 9, 1, 0, 1, 2, 8, 1, 0]],

      // Meta-data
      ["title", "\"\"", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],
      ["description", "\"\"", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["default", "true", [1, 2, 9, 1, 0, 1, 2, 9, 1, 0]],
      ["deprecated", "false", [1, 2, 9, 1, 0, 1, 2, 12, 1, 0]],
      ["readOnly", "true", [1, 2, 9, 1, 0, 1, 2, 10, 1, 0]],
      ["writeOnly", "false", [1, 2, 9, 1, 0, 1, 2, 11, 1, 0]],
      ["examples", "[]", [1, 2, 9, 1, 0, 1, 2, 10, 1, 0]],

      // Unevaluated
      ["unevaluatedItems", "true", [1, 2, 9, 1, 0, 1, 2, 18, 1, 0]],
      ["unevaluatedProperties", "true", [1, 2, 9, 1, 0, 1, 2, 23, 1, 0]],

      // Validation
      ["multipleOf", "1", [1, 2, 9, 1, 0, 1, 2, 12, 1, 0]],
      ["maximum", "42", [1, 2, 9, 1, 0, 1, 2, 9, 1, 0]],
      ["exclusiveMaximum", "42", [1, 2, 9, 1, 0, 1, 2, 18, 1, 0]],
      ["minimum", "42", [1, 2, 9, 1, 0, 1, 2, 9, 1, 0]],
      ["exclusiveMinimum", "42", [1, 2, 9, 1, 0, 1, 2, 18, 1, 0]],
      ["maxLength", "42", [1, 2, 9, 1, 0, 1, 2, 11, 1, 0]],
      ["minLength", "42", [1, 2, 9, 1, 0, 1, 2, 11, 1, 0]],
      ["pattern", "\"\"", [1, 2, 9, 1, 0, 1, 2, 9, 1, 0]],
      ["maxItems", "42", [1, 2, 9, 1, 0, 1, 2, 10, 1, 0]],
      ["minItems", "42", [1, 2, 9, 1, 0, 1, 2, 10, 1, 0]],
      ["uniqueItems", "false", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["maxContains", "1", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["minContains", "1", [1, 2, 9, 1, 0, 1, 2, 13, 1, 0]],
      ["maxProperties", "1", [1, 2, 9, 1, 0, 1, 2, 15, 1, 0]],
      ["minProperties", "1", [1, 2, 9, 1, 0, 1, 2, 15, 1, 0]],
      ["required", "[]", [1, 2, 9, 1, 0, 1, 2, 10, 1, 0]],
      ["dependentRequired", "{}", [1, 2, 9, 1, 0, 1, 2, 19, 1, 0]],
      ["const", "true", [1, 2, 9, 1, 0, 1, 2, 7, 1, 0]],
      ["enum", "[]", [1, 2, 9, 1, 0, 1, 2, 6, 1, 0]],
      ["type", "\"object\"", [1, 2, 9, 1, 0, 1, 2, 6, 1, 0]]
    ])("%s should be highlighted", async (keyword, value, expected) => {
      documentUri = await client.openDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "${keyword}": ${value}
}`);

      const response = await client.sendRequest(SemanticTokensRequest.type, {
        textDocument: { uri: documentUri }
      });

      expect(response?.data).to.eql(expected);
    });


    test.each([
      // Applicators
      ["additionalItems", "true", [1, 2, 9, 1, 0]],
      ["dependencies", "{}", [1, 2, 9, 1, 0]],

      // Core
      ["id", "\"\"", [1, 2, 9, 1, 0]],
      ["$recursiveRef", "\"#\"", [1, 2, 9, 1, 0]],
      ["$recursiveAnchor", "true", [1, 2, 9, 1, 0]],
      ["definitions", "{}", [1, 2, 9, 1, 0]]
    ])("%s should not be highlighted", async (keyword, value, expected) => {
      documentUri = await client.openDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "${keyword}": ${value}
}`);

      const response = await client.sendRequest(SemanticTokensRequest.type, {
        textDocument: { uri: documentUri }
      });

      expect(response?.data).to.eql(expected);
    });
  });
});

