import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";
import validationErrorsFeature from "./validation-errors.js";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "./document-settings.js";


describe("Feature - Validation Errors", () => {
  let client: TestClient<DocumentSettings>;

  beforeEach(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      semanticTokens,
      schemaRegistry,
      validationErrorsFeature
    ]);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test.each([
    [42, [`Expected a string or array`]],
    ["invalid", [`Expected one of: "array", "boolean", "integer", "null", "number", "object", or "string"`]],
    [["array", "invalid"], [`Expected one of: "array", "boolean", "integer", "null", "number", "object", or "string"`]],
    [["array", "invalid", "alsoInvalid"], [
      `Expected one of: "array", "boolean", "integer", "null", "number", "object", or "string"`,
      `Expected one of: "array", "boolean", "integer", "null", "number", "object", or "string"`
    ]]
  ])("invalid types", async (value, expected) => {
    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": ${JSON.stringify(value)}
    }`);


    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    const messages = diagnostics.map((diagnostic) => diagnostic.message);
    expect(messages).to.eql(expected);
  });

  test("minimum", async () => {
    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "maxLength": -1
    }`);
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Must be greater than or equal to 0");
  });

  test("exclusiveMinimum", async () => {
    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "multipleOf": 0
    }`);
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Must be greater than 0");
  });

  test("additionalProperties", async () => {
    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": {
        "name": { "type": 42 }
      }
    }`);
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Expected a string or array");
  });

  test("pattern", async () => {
    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$anchor": "9"
    }`);
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Must match the pattern /^[A-Za-z_][-A-Za-z0-9._]*$/");
  });

  test("minItems", async () => {
    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": []
    }`);
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("A minimum of 1 items are required");
  });

  test("uniqueItems", async () => {
    await client.openDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "required": ["item_id", "item_id"] }
}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Expected all items to be unique. "item_id" appears multiple times.`);
  });

  test("dependencies", async () => {
    await client.openDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "exclusiveMaximum": true
}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Property "maximum" is required`);
  });

  test("$ref", async () => {
    await client.openDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/foo",
  "$defs": {
    "foo": { "type": 42 }
  }
}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Expected a string or array`);
  });

  test("$dynamicRef", async () => {
    await client.openDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$dynamicRef": "#foo",
  "$defs": {
    "foo": {
      "$id": "dynamic",
      "$dynamicAnchor": "foo",
      "type": 42
    },
    "default": {
      "$dyanmicAnchor": "foo"
    }
  }
}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Expected a string or array`);
  });
});
