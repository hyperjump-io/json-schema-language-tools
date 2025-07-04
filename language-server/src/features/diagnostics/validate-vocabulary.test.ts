import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DiagnosticSeverity, PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";

import type { Diagnostic } from "vscode-languageserver";


describe("Feature - Validate $vocabulary", () => {
  let client: TestClient;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("a custom dialect with an unknown vocabulary should include an error diagnostic", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": true
      }
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Unknown vocabulary");
    expect(diagnostics[0]?.severity).to.eql(DiagnosticSeverity.Error);
  });

  test("a custom dialect with an unknown optional vocabulary should include a warning diagnostic", async () => {
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$id": "https://example.com/my-dialect",
      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://example.com/my-vocabulary": false
      }
    }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Unknown optional vocabulary");
    expect(diagnostics[0]?.severity).to.eql(DiagnosticSeverity.Warning);
  });

  test("a custom dialect with an unknown vocabulary should not be registered", async () => {
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

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Unknown dialect");
  });
});
