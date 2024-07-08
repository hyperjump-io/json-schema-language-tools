import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  DidChangeTextDocumentNotification,
  PublishDiagnosticsNotification
} from "vscode-languageserver";
import { getTestClient, closeDocument, initializeServer, openDocument, setupWorkspace, tearDownWorkspace } from "../test-utils.js";
import documentSettings from "./document-settings.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";
import validationErrorsFeature from "./validation-errors.js";
import { resolveIri } from "@hyperjump/uri";

import type { Connection } from "vscode-languageserver";


describe("Feature - Watch File Patterns", () => {
  let client: Connection;
  let documentUri: string;
  let documentUriB: string;
  let workspaceFolder: string;

  beforeAll(async () => {
    client = getTestClient([
      workspace,
      documentSettings,
      schemaRegistry,
      validationErrorsFeature
    ]);

    workspaceFolder = await setupWorkspace({
      "subject.schema.json": `{}`,
      "subjectB.schema.json": `{}`
    });

    const init = { workspaceFolders: [
      {
        name: "root",
        uri: workspaceFolder
      }
    ] };

    const settings = {
      "schemaFilePatterns": ["**/subjectB.schema.json"]
    };

    await initializeServer(client, init, settings);

    documentUri = resolveIri("./subject.schema.json", `${workspaceFolder}/`);
    documentUriB = resolveIri("./subjectB.schema.json", `${workspaceFolder}/`);
    await openDocument(client, documentUri);
    await openDocument(client, documentUriB);
  });

  afterAll(async () => {
    await closeDocument(client, documentUri);
    await closeDocument(client, documentUriB);

    await tearDownWorkspace(client, workspaceFolder);
  });

  test("watches only specified files", async () => {
    const diagnosticsPromise = new Promise<string>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.uri);
      });
    });

    await client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri: documentUriB, version: 1 },
      contentChanges: []
    });

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.equal(documentUriB);
  });
});
