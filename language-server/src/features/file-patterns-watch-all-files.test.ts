import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  PublishDiagnosticsNotification,
  DidChangeWatchedFilesNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
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

    const init = {
      workspaceFolders: [
        {
          name: "root",
          uri: workspaceFolder
        }
      ]
    };

    await initializeServer(client, init);

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

  test("watches all files", async () => {
    const validatedSchemasPromise = new Promise((resolve) => {
      let schemaUris: string[];

      client.onRequest(WorkDoneProgressCreateRequest.type, ({ token }) => {
        client.onProgress(WorkDoneProgress.type, token, ({ kind }) => {
          if (kind === "begin") {
            schemaUris = [];
          } else if (kind === "end") {
            resolve(schemaUris);
          }
        });
      });

      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        schemaUris.push(params.uri);
      });
    });

    await client.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: []
    });

    const validatedSchemas = await validatedSchemasPromise;
    expect(validatedSchemas).to.contains(documentUri);
    expect(validatedSchemas).to.contains(documentUriB);
  });
});
