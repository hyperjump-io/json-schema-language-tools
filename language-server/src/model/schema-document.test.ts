import { describe, expect, test } from "vitest";
import { fromJson } from "./schema-document.js";
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-04";


describe("Schema AST", () => {
  test("parsing an empty document is undefined", () => {
    const schemaNode = fromJson(``, "file:///path/to/subject.schema.json");

    expect(schemaNode).to.equal(undefined);
  });

  test.each([
    [`42`, "number"],
    [`true`, "boolean"],
    [`null`, "null"],
    [`"foo"`, "string"],
    [`{}`, "object"],
    [`[]`, "array"]
  ])("Every JSON type can be parsed: %s", (json, type) => {
    const schemaNode = fromJson(json, "file:///path/to/subject.schema.json");
    expect(schemaNode?.type).to.equal(type);
  });

  test.each([
    `42`,
    `true`,
    `null`,
    `"foo"`,
    `{}`,
    `[]`
  ])("the root is always a schema: %s", (json) => {
    const schemaNode = fromJson(json, "file:///path/to/subject.schema.json");
    expect(schemaNode?.isSchema).to.equal(true);
  });

  test("the dialectUri defaults to undefined", () => {
    const schemaNode = fromJson(`{}`, "file:///path/to/subject.schema.json");
    expect(schemaNode?.dialectUri).to.equal(undefined);
  });

  test("a schema without $schema should use the default dialect", () => {
    const dialectUri = "https://json-schema.org/draft/2020-12/schema";
    const schemaNode = fromJson(`{}`, "file:///path/to/subject.schema.json", dialectUri);
    expect(schemaNode?.dialectUri).to.equal(dialectUri);
  });

  test("a schema with $schema should use that over the default dialect", () => {
    const dialectUri = "http://json-schema.org/draft-07/schema";
    const schemaNode = fromJson(`{
  "$schema": "${dialectUri}#"
}`, "file:///path/to/subject.schema.json", "https://json-schema.org/draft/2020-12/schema");
    expect(schemaNode?.dialectUri).to.equal(dialectUri);
  });

  test("the baseUri defaults to the retrieval URI", () => {
    const retrievalUri = "file:///path/to/subject.schema.json";
    const schemaNode = fromJson(`{}`, retrievalUri);
    expect(schemaNode?.baseUri).to.equal(retrievalUri);
  });

  test("a schema's base URI should use $id", () => {
    const baseUri = "https://example.com/foo";
    const schemaNode = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "${baseUri}"
}`, "file:///path/to/subject.schema.json");
    expect(schemaNode?.baseUri).to.equal(baseUri);
  });

  test("the root is added to embbedded using its base URI", () => {
    const retrievalUri = "file:///path/to/subject.schema.json";
    const schemaNode = fromJson(`{}`, retrievalUri);
    expect(schemaNode?.embedded).to.eql({ [retrievalUri]: schemaNode });
  });

  // Pointers

  test("the pointer of the root node is ''", () => {
    const schemaNode = fromJson(`{}`, "file:///path/to/subject.schema.json");
    expect(schemaNode?.pointer).to.eql("");
  });

  test("pointers for properties", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[0].children[1];
    expect(schemaNode?.pointer).to.eql("/$schema");
  });

  test("pointers for arrays", () => {
    const root = fromJson(`[42]`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[0];
    expect(schemaNode?.pointer).to.eql("/0");
  });

  // Schema embedded in unknown locations

  test("unknown values without $schema or $id are never schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "foo": { "type": "string" }
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[1].children[1];

    expect(schemaNode?.isSchema).to.equal(false);
  });

  test("unknown values with an unknown $schema are embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "foo": { "$schema": "https://example.com/dialect" }
}`, "file:///path/to/subject.schema.json");

    expect(root?.children[1].children[1]).to.equal(undefined);
    expect(root && Object.keys(root.embedded).length).to.equal(2);
  });

  test("unknown values with a known $schema and no $id are not embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "foo": { "$schema": "http://json-schema.org/draft-07/schema#" }
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[1].children[1];

    expect(schemaNode?.isSchema).to.equal(false);
    expect(root && Object.keys(root.embedded).length).to.equal(1);
  });

  test("unknown values with a $id are embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "foo": { "$id": "https://example.com/foo" }
}`, "file:///path/to/subject.schema.json");

    expect(root?.children[1].children[1]).to.equal(undefined);
    expect(root?.embedded).to.haveOwnProperty("https://example.com/foo");
  });

  test("unknown values with $id matching parent dialect but not local dialect are not embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "foo": {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "$id": "https://example.com/foo"
  }
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[1].children[1];

    expect(schemaNode?.isSchema).to.equal(false);
    expect(root && Object.keys(root.embedded).length).to.equal(1);
  });

  // Known not to be schemas

  test("values known not to be schemas are never schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "const": { "$id": "https://example.com/foo" }
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[1].children[1];

    expect(schemaNode?.isSchema).to.equal(false);
    expect(root?.embedded).to.not.haveOwnProperty("https://example.com/foo");
  });

  test("values nest in values known not to be schemas are never schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "const": [{ "$id": "https://example.com/foo" }]
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[1].children[1].children[0];

    expect(schemaNode?.isSchema).to.equal(false);
    expect(root?.embedded).to.not.haveOwnProperty("https://example.com/foo");
  });

  // Embedded schemas

  test("schemas with $id are embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "foo": { "$id": "https://example.com/foo" }
  }
}`, "file:///path/to/subject.schema.json");

    expect(root?.children[1].children[1].children[0].children[1]).to.equal(undefined);
    expect(root?.embedded).to.haveOwnProperty("https://example.com/foo");
  });

  test("schemas with an unknown $schema are embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "foo": { "$schema": "https://example.com/dialect" }
  }
}`, "file:///path/to/subject.schema.json");

    expect(root?.children[1].children[1].children[0].children[1]).to.equal(undefined);
    expect(root && Object.keys(root.embedded).length).to.equal(2);
  });

  test("schemas with a known $schema and no $id are not embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "foo": { "$schema": "http://json-schema.org/draft-07/schema#" }
  }
}`, "file:///path/to/subject.schema.json");

    expect(root && Object.keys(root.embedded).length).to.equal(1);
  });

  test("schemas with $id matching parent dialect but not local dialect are not embedded schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "foo": {
      "$schema": "http://json-schema.org/draft-04/schema#",
      "$id": "https://example.com/foo"
    }
  }
}`, "file:///path/to/subject.schema.json");

    expect(root && Object.keys(root.embedded).length).to.equal(1);
  });

  // Sub-schemas

  test("property values are schemas", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "properties": {
    "foo": {}
  }
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[1].children[1].children[0].children[1];

    expect(schemaNode?.isSchema).to.equal(true);
  });

  // Keyword URIs

  test("the keywordUri of the root is undefined", () => {
    const schemaNode = fromJson(`{}`, "file:///path/to/subject.schema.json");
    expect(schemaNode?.keywordUri).to.equal(undefined);
  });

  test("the keywordUri is set for $schema", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}`, "file:///path/to/subject.schema.json");
    const schemaNode = root?.children[0].children[0];
    expect(schemaNode?.keywordUri).to.equal("https://json-schema.org/keyword/schema");
  });

  test("the keywordUri is set for both the key and the value, but not the property", () => {
    const root = fromJson(`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object"
}`, "file:///path/to/subject.schema.json");

    const schemaNode = root?.children[1];
    expect(schemaNode?.keywordUri).to.equal(undefined);

    const keySchemaNode = schemaNode?.children[0];
    expect(keySchemaNode?.keywordUri).to.equal("https://json-schema.org/keyword/type");

    const valueSchemaNode = schemaNode?.children[1];
    expect(valueSchemaNode?.keywordUri).to.equal("https://json-schema.org/keyword/type");
  });
});
