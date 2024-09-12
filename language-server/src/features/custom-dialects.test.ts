import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  DidChangeWatchedFilesNotification,
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { TestClient } from "../test-client.js";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "../configuration.js";


describe("Feature - Custom Dialects", () => {
  let client: TestClient<DocumentSettings>;
  let documentUriB: string;
  let documentUri: string;

  beforeEach(async () => {
    client = new TestClient();

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

    await client.start();
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
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      let diagnostics: Diagnostic[];

      client.onRequest(WorkDoneProgressCreateRequest.type, ({ token }) => {
        client.onProgress(WorkDoneProgress.type, token, ({ kind }) => {
          if (kind === "end") {
            resolve(diagnostics);
          }
        });
      });

      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        diagnostics = params.diagnostics;
      });
    });

    await rm(fileURLToPath(documentUriB));
    await client.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: []
    });

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Unknown dialect");
  });
});
