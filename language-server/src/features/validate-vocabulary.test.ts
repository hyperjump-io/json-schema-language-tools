import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DiagnosticSeverity, PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import documentSettings from "./document-settings.js";
import workspace from "./workspace.js";
import semanticTokens from "./semantic-tokens.js";
import schemaRegistry from "./schema-registry.js";
import validationErrors from "./validation-errors.js";

import type { DocumentSettings } from "./document-settings.js";
import type { Diagnostic } from "vscode-languageserver";


describe("Feature - Validate $vocabulary", () => {
  let client: TestClient<DocumentSettings>;

  beforeEach(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      semanticTokens,
      schemaRegistry,
      validationErrors
    ]);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("a custom dialect with an unknown vocabulary should include an error diagnostic", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": true
      }
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown vocabulary");
    expect(diagnostics[0].severity).to.eql(DiagnosticSeverity.Error);
  });

  test("a custom dialect with an unknown optional vocabulary should include a warning diagnostic", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": false
      }
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown optional vocabulary");
    expect(diagnostics[0].severity).to.eql(DiagnosticSeverity.Warning);
  });

  test("a custom dialect with an unknown vocabulary should not be registered", async () => {
    let diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./my-dialect.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": true
      }
    }`);
    await diagnosticsPromise;

    diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{
      "$schema": "https://example.com/my-dialect"
    }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown dialect");
  });
});
