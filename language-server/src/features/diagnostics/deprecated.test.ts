import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DiagnosticSeverity, DiagnosticTag, PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";

import type { Diagnostic } from "vscode-languageserver";


describe("Feature - Deprecated", () => {
  let client: TestClient;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("test deprecated 2020-12", async () => {
    await client.writeDocument("./subject.schema.json", `{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "definitions": {}
  }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Use '$defs'. 'definitions' was replaced with '$defs' in 2019-09");
  });

  test("test deprecated 2019-09", async () => {
    await client.writeDocument("./subject.schema.json", `{
    "$schema": "https://json-schema.org/draft/2019-09/schema",
    "definitions": {}
  }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Use '$defs'. 'definitions' was replaced with '$defs' in 2019-09");
  });

  test("test diganostics type", async () => {
    await client.writeDocument("./subject.schema.json", `{
    "$schema": "https://json-schema.org/draft/2019-09/schema",
    "definitions": {}
  }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.severity).to.eql(DiagnosticSeverity.Warning);
  });

  test("test diganostics tag", async () => {
    await client.writeDocument("./subject.schema.json", `{
    "$schema": "https://json-schema.org/draft/2019-09/schema",
    "definitions": {}
  }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.tags).to.eql([DiagnosticTag.Deprecated]);
  });

  test("test diganostics range", async () => {
    await client.writeDocument("./subject.schema.json", `{
    "$schema": "https://json-schema.org/draft/2019-09/schema",
    "definitions": {}
  }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    const expectedRange = {
      start: { line: 2, character: 4 },
      end: { line: 2, character: 21 }
    };

    expect(diagnostics[0]?.range).to.eql(expectedRange);
  });
});
