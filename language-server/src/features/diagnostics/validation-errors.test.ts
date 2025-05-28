import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";

import type { Diagnostic } from "vscode-languageserver";


describe("Feature - Validation Errors", () => {
  let client: TestClient;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("type (singular)", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": 42
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Expected an object");
  });

  test("type (array)", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": true
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Expected a string or array");
  });

  test("enum", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "invalid"
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql(`Expected one of: "array", "boolean", "integer", "null", "number", "object", or "string"`);
  });

  test("minimum", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "maxLength": -1
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Must be greater than or equal to 0");
  });

  test("exclusiveMinimum", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "multipleOf": 0
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Must be greater than 0");
  });

  test("additionalProperties", async () => {
    await client.writeDocument("./subject.schema.json", `{
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
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Expected a string or array");
  });

  test("pattern", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$anchor": "9"
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Must match the pattern /^[A-Za-z_][-A-Za-z0-9._]*$/");
  });

  test("minItems", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": []
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("A minimum of 1 items are required");
  });

  test("uniqueItems", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "required": ["item_id", "item_id"] }
}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql(`All items must be unique`);
    expect(diagnostics[1]?.message).to.eql(`All items must be unique`);
  });

  test("dependencies", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "exclusiveMaximum": true
}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql(`Property "maximum" is required`);
  });

  test("$ref", async () => {
    await client.writeDocument("./subject.schema.json", `{
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
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql(`Expected a string or array`);
  });

  test("$dynamicRef", async () => {
    await client.writeDocument("./subject.schema.json", `{
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

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql(`Expected a string or array`);
  });
});
