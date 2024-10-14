import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "../../services/configuration.js";


describe("Feature - Custom Dialects", () => {
  let client: TestClient<DocumentSettings>;
  let documentUriB: string;
  let documentUri: string;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();

    documentUriB = await client.writeDocument("./subjectB.schema.json", `{
      "$id": "https://example.com/my-dialect",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$dynamicAnchor": "meta",

      "$vocabulary": {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      }
    }`);
    documentUri = await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://example.com/my-dialect"
    }`);
  });

  afterEach(async () => {
    await client.stop();
  });

  test("Registered dialect schema", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument(documentUriB);
    await client.openDocument(documentUri);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("Unregister dialect schema", async () => {
    let diagnostics: Diagnostic[] = [];
    client.onNotification(PublishDiagnosticsNotification.type, (params) => {
      diagnostics = params.diagnostics;
    });

    await client.deleteDocument(documentUriB);

    expect(diagnostics[0]?.message).to.eql("Unknown dialect");
  });
});
