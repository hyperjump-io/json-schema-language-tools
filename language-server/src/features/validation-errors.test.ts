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

  test("type (singular)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": 42
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Expected an object");
  });

  test("type (array)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": true
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Expected a string or array");
  });

  test("enum", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "invalid"
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Expected one of: "array", "boolean", "integer", "null", "number", "object", or "string"`);
  });

  test("minimum", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "maxLength": -1
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Must be greater than or equal to 0");
  });

  test("exclusiveMinimum", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "multipleOf": 0
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Must be greater than 0");
  });

  test("additionalProperties", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": {
        "name": { "type": 42 }
      }
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Expected a string or array");
  });

  test("pattern", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$anchor": "9"
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Must match the pattern /^[A-Za-z_][-A-Za-z0-9._]*$/");
  });

  test("minItems", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": []
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("A minimum of 1 items are required");
  });

  test("uniqueItems", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "required": ["item_id", "item_id"] }
}`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`All items must be unique`);
    expect(diagnostics[1].message).to.eql(`All items must be unique`);
  });

  test("dependencies", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "exclusiveMaximum": true
}`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Property "maximum" is required`);
  });

  test("$ref", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/foo",
  "$defs": {
    "foo": { "type": 42 }
  }
}`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Expected a string or array`);
  });

  test("$dynamicRef", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/subject",
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

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql(`Expected a string or array`);
  });
});
