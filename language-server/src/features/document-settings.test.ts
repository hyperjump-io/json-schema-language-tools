import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  ConfigurationRequest,
  DidChangeTextDocumentNotification,
  PublishDiagnosticsNotification
} from "vscode-languageserver";
import { getTestClient, closeDocument, initializeServer, openDocument } from "../test-utils.js";
import documentSettings from "./document-settings.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";
import validationErrorsFeature from "./validation-errors.js";

import type { Connection, Diagnostic } from "vscode-languageserver";


describe("Feature - Document Settings", () => {
  let client: Connection;
  let documentUri: string;

  beforeAll(async () => {
    client = getTestClient([
      workspace,
      documentSettings,
      schemaRegistry,
      validationErrorsFeature
    ]);
    const init = {};
    const settings = { "defaultDialect": "https://json-schema.org/draft/2020-12/schema" };
    await initializeServer(client, init, settings);
  });

  afterAll(async () => {
    await closeDocument(client, documentUri);
  });

  test("test default dialect", async () => {
    documentUri = await openDocument(client, "./subject.schema.json", `{}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri: documentUri, version: 1 },
      contentChanges: []
    });

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("test no dialect", async () => {
    documentUri = await openDocument(client, "./subject.schema.json", `{}`);

    client.onRequest(ConfigurationRequest.type, () => {
      return [{}];
    });

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri: documentUri, version: 1 },
      contentChanges: []
    });

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("No dialect");
  });

  test("test unknown dialect", async () => {
    documentUri = await openDocument(client, "./subject.schema.json", `{ "$schema": "" }`);

    client.onRequest(ConfigurationRequest.type, () => {
      return [{}];
    });

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri: documentUri, version: 1 },
      contentChanges: []
    });

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown dialect");
  });

  test("test unknown dialect when default dialect is unknown", async () => {
    documentUri = await openDocument(client, "./subject.schema.json", `{}`);

    client.onRequest(ConfigurationRequest.type, () => {
      return [{ "defaultDialect": "" }];
    });

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri: documentUri, version: 1 },
      contentChanges: []
    });

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown dialect");
  });
});
