import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  DidChangeWatchedFilesNotification,
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { resolveIri } from "@hyperjump/uri";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { TestClient } from "../test-client.js";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";
import validationErrorsFeature from "./validation-errors.js";
import { setupWorkspace, tearDownWorkspace } from "../test-utils.js";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "./document-settings.js";


describe("Feature - Custom Dialects", () => {
  let client: TestClient<DocumentSettings>;
  let workspaceFolder: string;
  let documentUriB: string;
  let documentUri: string;

  beforeEach(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      semanticTokens,
      schemaRegistry,
      validationErrorsFeature
    ]);
    workspaceFolder = await setupWorkspace({
      "subjectB.schema.json": `{
        "$id": "https://example.com/my-dialect",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$dynamicAnchor": "meta",

        "$vocabulary": {
          "https://json-schema.org/draft/2020-12/vocab/core": true,
          "https://json-schema.org/draft/2020-12/vocab/applicator": true,
          "https://json-schema.org/draft/2020-12/vocab/validation": true
        }
      }`,
      "subject.schema.json": `{
        "$schema": "https://example.com/my-dialect"
      }`
    });
    documentUriB = resolveIri("./subjectB.schema.json", `${workspaceFolder}/`);
    documentUri = resolveIri("./subject.schema.json", `${workspaceFolder}/`);

    await client.start({
      workspaceFolders: [
        {
          name: "root",
          uri: workspaceFolder
        }
      ]
    });
  });

  afterEach(async () => {
    await client.stop();
    await tearDownWorkspace(workspaceFolder);
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
