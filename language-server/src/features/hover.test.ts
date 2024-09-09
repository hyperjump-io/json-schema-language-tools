import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { HoverRequest, MarkupKind } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import hover from "./hover.js";

import type { Hover, MarkupContent } from "vscode-languageserver";
import type { DocumentSettings } from "../configuration.js";


describe("Feature - Hover", () => {
  let client: TestClient<DocumentSettings>;

  beforeAll(async () => {
    client = new TestClient([hover]);
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  test("capabilities", () => {
    expect(client.serverCapabilities?.hoverProvider).to.equal(true);
  });

  describe("match response", () => {
    let response: Hover | null;
    let documentUri: string;

    beforeAll(async () => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 1,
          character: 3
        }
      });
    });

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test("kind", async () => {
      const contents = response?.contents as MarkupContent;
      expect(contents.kind).to.eql(MarkupKind.Markdown);
    });

    test("range", () => {
      expect(response?.range).to.eql({
        start: { line: 1, character: 2 },
        end: { line: 1, character: 10 }
      });
    });
  });

  describe("hover on keyword value", () => {
    let response: Hover | null;
    let documentUri: string;

    beforeAll(async () => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Foo"
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 12
        }
      });
    });

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test("should not have a message", () => {
      expect(response).to.equal(null);
    });
  });

  describe("hover on a key with a keyword name, but not in a schema", () => {
    let response: Hover | null;
    let documentUri: string;

    beforeAll(async () => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "properties": {
    "title": {}
  }
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 3,
          character: 6
        }
      });
    });

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test("should not have a message", () => {
      expect(response).to.equal(null);
    });
  });

  describe("2020-12", () => {
    let documentUri: string;

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test.each([
      // Applicators
      ["prefixItems", "[{}]"],
      ["items", "{}"],
      ["contains", "{}"],
      ["additionalProperties", "{}"],
      ["properties", "{}"],
      ["patternProperties", "{}"],
      ["dependentSchemas", "{}"],
      ["propertyNames", "{}"],
      ["if", "{}"],
      ["then", "{}"],
      ["else", "{}"],
      ["allOf", "[{}]"],
      ["anyOf", "[{}]"],
      ["oneOf", "[{}]"],
      ["not", "{}"],

      // Content
      ["contentMediaType", "\"\""],
      ["contentEncoding", "\"\""],
      ["contentSchema", "{}"],

      // Core
      ["$id", "\"\""],
      ["$anchor", "\"foo\""],
      ["$ref", "\"\""],
      ["$dynamicRef", "\"\""],
      ["$dynamicAnchor", "\"foo\""],
      ["$vocabulary", "{}"],
      ["$comment", "\"\""],
      ["$defs", "{}"],

      // Format
      ["format", "\"\""],

      // Meta-data
      ["title", "\"\""],
      ["description", "\"\""],
      ["default", "true"],
      ["deprecated", "false"],
      ["readOnly", "true"],
      ["writeOnly", "false"],
      ["examples", "[]"],

      // Unevaluated
      ["unevaluatedItems", "true"],
      ["unevaluatedProperties", "true"],

      // Validation
      ["multipleOf", "1"],
      ["maximum", "42"],
      ["exclusiveMaximum", "42"],
      ["minimum", "42"],
      ["exclusiveMinimum", "42"],
      ["maxLength", "42"],
      ["minLength", "42"],
      ["pattern", "\"\""],
      ["maxItems", "42"],
      ["minItems", "42"],
      ["uniqueItems", "false"],
      ["maxContains", "1"],
      ["minContains", "1"],
      ["maxProperties", "1"],
      ["minProperties", "1"],
      ["required", "[]"],
      ["dependentRequired", "{}"],
      ["const", "true"],
      ["enum", "[]"],
      ["type", "\"object\""]
    ])("%s should have a message", async (keyword, value) => {
      documentUri = await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",${keyword === "$vocabulary" ? `"$id": "https://example.com/schema",` : ""}
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      const contents = response?.contents as MarkupContent;
      expect(contents.value).to.not.be.empty; // eslint-disable-line @typescript-eslint/no-unused-expressions
    });

    test.each([
      // Applicators
      ["additionalItems", "true"],
      ["dependencies", "{}"],

      // Core
      ["id", "\"\""],
      ["$recursiveRef", "\"#\""],
      ["$recursiveAnchor", "true"],
      ["definitions", "{}"]
    ])("%s should not have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      expect(response).to.equal(null);
    });
  });

  describe("2019-09", () => {
    let documentUri: string;

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test.each([
      // Applicators
      ["additionalItems", "true"],
      ["unevaluatedItems", "true"],
      ["items", "true"],
      ["contains", "true"],
      ["additionalProperties", "true"],
      ["unevaluatedProperties", "true"],
      ["properties", "{}"],
      ["patternProperties", "{}"],
      ["dependentSchemas", "{}"],
      ["propertyNames", "{}"],
      ["if", "true"],
      ["then", "true"],
      ["else", "true"],
      ["allOf", "[{}]"],
      ["anyOf", "[{}]"],
      ["oneOf", "[{}]"],
      ["not", "{}"],

      // Content
      ["contentMediaType", "\"\""],
      ["contentEncoding", "\"\""],
      ["contentSchema", "{}"],

      // Core
      ["$id", "\"\""],
      ["$anchor", "\"foo\""],
      ["$ref", "\"\""],
      ["$recursiveRef", "\"\""],
      ["$recursiveAnchor", "true"],
      ["$vocabulary", "{}"],
      ["$comment", "\"\""],
      ["$defs", "{}"],

      // Format
      ["format", "\"\""],

      // Meta-data
      ["title", "\"\""],
      ["description", "\"\""],
      ["default", "\"\""],
      ["deprecated", "true"],
      ["readOnly", "true"],
      ["writeOnly", "true"],
      ["examples", "[]"],

      // Validation
      ["multipleOf", "1"],
      ["maximum", "1"],
      ["exclusiveMaximum", "1"],
      ["minimum", "1"],
      ["exclusiveMinimum", "1"],
      ["maxLength", "1"],
      ["minLength", "1"],
      ["pattern", "\"\""],
      ["maxItems", "1"],
      ["minItems", "1"],
      ["uniqueItems", "true"],
      ["maxContains", "1"],
      ["minContains", "1"],
      ["maxProperties", "1"],
      ["minProperties", "1"],
      ["required", "[]"],
      ["dependentRequired", "{}"],
      ["const", "1"],
      ["enum", "[]"],
      ["type", "\"object\""]
    ])("%s should have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2019-09/schema",${keyword === "$vocabulary" ? `"$id": "https://example.com/schema",` : ""}
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      const contents = response?.contents as MarkupContent;
      expect(contents.value).to.not.be.empty; // eslint-disable-line @typescript-eslint/no-unused-expressions
    });

    test.each([
      // Applicators
      ["dependencies", "{}"],
      ["prefixItems", "[{}]"],

      // Core
      ["id", "\"\""],
      ["$dynamicRef", "\"#foo\""],
      ["$dynamicAnchor", "\"foo\""],
      ["definitions", "{}"]
    ])("%s should not have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2019-09/schema",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      expect(response).to.equal(null);
    });
  });

  describe("draft-07", () => {
    let documentUri: string;

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test.each([
      // ["$id", "\"\""], // TODO: Add missing description
      ["$ref", "\"\""],
      ["$comment", "\"\""],
      ["title", "\"\""],
      ["description", "\"\""],
      ["default", "\"\""],
      ["readOnly", "true"],
      ["writeOnly", "true"],
      ["examples", "[]"],
      ["multipleOf", "1"],
      ["maximum", "1"],
      ["exclusiveMaximum", "1"],
      ["minimum", "1"],
      ["exclusiveMinimum", "1"],
      ["maxLength", "1"],
      ["minLength", "1"],
      ["pattern", "\"\""],
      ["additionalItems", "true"],
      ["items", "true"],
      ["maxItems", "1"],
      ["minItems", "1"],
      ["uniqueItems", "true"],
      ["contains", "{}"],
      ["maxProperties", "1"],
      ["minProperties", "1"],
      ["required", "[\"foo\"]"],
      ["additionalProperties", "true"],
      ["definitions", "{}"],
      ["properties", "{}"],
      ["patternProperties", "{}"],
      // ["dependencies", "{}"], // TODO: Add missing description
      ["propertyNames", "{}"],
      ["const", "1"],
      ["enum", "[1]"],
      ["type", "\"object\""],
      ["format", "\"\""],
      ["contentMediaType", "\"\""],
      ["contentEncoding", "\"\""],
      ["if", "true"],
      ["then", "true"],
      ["else", "true"],
      ["allOf", "[{}]"],
      ["anyOf", "[{}]"],
      ["oneOf", "[{}]"],
      ["not", "{}"]
    ])("%s should have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      const contents = response?.contents as MarkupContent;
      expect(contents.value).to.not.be.empty; // eslint-disable-line @typescript-eslint/no-unused-expressions
    });

    test.each([
      ["dependentSchemas", "{}"],
      ["dependentRequired", "{}"],
      ["prefixItems", "[{}]"],
      ["minContains", "1"],
      ["maxContains", "1"],
      ["id", "\"\""],
      ["$dynamicRef", "\"#foo\""],
      ["$dynamicAnchor", "\"foo\""],
      ["$recursiveRef", "\"#\""],
      ["$recursiveAnchor", "true"],
      ["unevaluatedProperties", "true"],
      ["unevaluatedItems", "true"],
      ["$defs", "{}"]
    ])("%s should not have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      expect(response).to.equal(null);
    });
  });

  describe("draft-06", () => {
    let documentUri: string;

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test.each([
      // ["$id", "\"\""], // TODO: Add missing description
      ["$ref", "\"\""],
      ["title", "\"\""],
      ["description", "\"\""],
      ["default", "\"\""],
      ["examples", "[]"],
      ["multipleOf", "1"],
      ["maximum", "1"],
      ["exclusiveMaximum", "1"],
      ["minimum", "1"],
      ["exclusiveMinimum", "1"],
      ["maxLength", "1"],
      ["minLength", "1"],
      ["pattern", "\"\""],
      ["additionalItems", "true"],
      ["items", "true"],
      ["maxItems", "1"],
      ["minItems", "1"],
      ["uniqueItems", "true"],
      ["contains", "{}"],
      ["maxProperties", "1"],
      ["minProperties", "1"],
      ["required", "[\"foo\"]"],
      ["additionalProperties", "{}"],
      ["definitions", "{}"],
      ["properties", "{}"],
      ["patternProperties", "{}"],
      // ["dependencies", "{}"], // TODO: Add missing description
      ["propertyNames", "{}"],
      ["const", "1"],
      ["enum", "[1]"],
      ["type", "\"object\""],
      ["format", "\"\""],
      ["allOf", "[{}]"],
      ["anyOf", "[{}]"],
      ["oneOf", "[{}]"],
      ["not", "{}"]
    ])("%s should have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-06/schema#",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      const contents = response?.contents as MarkupContent;
      expect(contents.value).to.not.be.empty; // eslint-disable-line @typescript-eslint/no-unused-expressions
    });

    test.each([
      ["dependentSchemas", "{}"],
      ["dependentRequired", "{}"],
      ["prefixItems", "[{}]"],
      ["if", "{}"],
      ["then", "{}"],
      ["else", "{}"],
      ["minContains", "1"],
      ["maxContains", "1"],
      ["id", "\"\""],
      ["$dynamicRef", "\"#foo\""],
      ["$dynamicAnchor", "\"foo\""],
      ["$recursiveRef", "\"#\""],
      ["$recursiveAnchor", "true"],
      ["unevaluatedProperties", "true"],
      ["unevaluatedItems", "true"],
      ["$defs", "{}"]
    ])("%s should not have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-06/schema#",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      expect(response).to.equal(null);
    });
  });

  describe("draft-04", () => {
    let documentUri: string;

    afterEach(async () => {
      await client.closeDocument(documentUri);
    });

    test.each([
      // ["id", "\"\""], // TODO: Add missing description
      ["title", "\"\""],
      ["description", "\"\""],
      ["default", "\"\""],
      ["multipleOf", "1"],
      // ["maximum", "1"],
      // ["exclusiveMaximum", "true, \"maximum\": 1"], // TODO: Add missing description
      // ["minimum", "1"],
      // ["exclusiveMinimum", "true, \"minimum\": 1"], // TODO: Add missing description
      ["maxLength", "1"],
      ["minLength", "1"],
      ["pattern", "\"\""],
      ["additionalItems", "{}"],
      ["items", "{}"],
      ["maxItems", "1"],
      ["minItems", "1"],
      ["uniqueItems", "true"],
      ["maxProperties", "1"],
      ["minProperties", "1"],
      ["required", "[\"foo\"]"],
      ["additionalProperties", "{}"],
      ["definitions", "{}"],
      ["properties", "{}"],
      ["patternProperties", "{}"],
      // ["dependencies", "{}"], // TODO: Add missing description
      ["enum", "[1]"],
      ["type", "\"object\""],
      ["format", "\"\""],
      ["allOf", "[{}]"],
      ["anyOf", "[{}]"],
      ["oneOf", "[{}]"],
      ["not", "{}"]
    ])("%s should have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      const contents = response?.contents as MarkupContent;
      expect(contents.value).to.not.be.empty; // eslint-disable-line @typescript-eslint/no-unused-expressions
    });

    test.each([
      ["dependentSchemas", "{}"],
      ["dependentRequired", "{}"],
      ["prefixItems", "[{}]"],
      ["if", "{}"],
      ["then", "{}"],
      ["else", "{}"],
      ["contains", "{}"],
      ["minContains", "1"],
      ["maxContains", "1"],
      ["$id", "\"\""],
      ["$dynamicRef", "\"#foo\""],
      ["$dynamicAnchor", "\"foo\""],
      ["$recursiveRef", "\"#\""],
      ["$recursiveAnchor", "true"],
      ["unevaluatedProperties", "true"],
      ["unevaluatedItems", "true"],
      ["$defs", "{}"]
    ])("%s should not have a message", async (keyword, value) => {
      await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "${keyword}": ${value}
}`);
      documentUri = await client.openDocument("./subject.schema.json");

      const response = await client.sendRequest(HoverRequest.type, {
        textDocument: { uri: documentUri },
        position: {
          line: 2,
          character: 2
        }
      });

      expect(response).to.equal(null);
    });
  });
});
