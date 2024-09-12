import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DiagnosticSeverity, PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test-client.js";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "../configuration.js";


describe("Feature - Validate $vocabulary", () => {
  let client: TestClient<DocumentSettings>;

  beforeEach(async () => {
    client = new TestClient();
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

    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": true
      }
    }`);
    await client.openDocument("./subject.schema.json");

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

    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": false
      }
    }`);
    await client.openDocument("./subject.schema.json");

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

    await client.writeDocument("./my-dialect.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": true
      }
    }`);
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://example.com/my-dialect"
    }`);

    await client.openDocument("./my-dialect.schema.json");
    await diagnosticsPromise;

    diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown dialect");
  });
});
