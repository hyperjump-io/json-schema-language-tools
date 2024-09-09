import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../test-client.js";
import {
  PublishDiagnosticsNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { utimes } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import validateSchema from "./validate-schema.js";
import validateWorkspace from "./validate-workspace.js";
import workspace from "./workspace.js";

import type { DocumentSettings } from "../configuration.js";


describe("Feature - workspace (neovim)", () => {
  let client: TestClient<DocumentSettings>;
  let subjectSchemaUri: string;

  beforeAll(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      validateSchema,
      validateWorkspace,
      semanticTokens
    ]);

    subjectSchemaUri = await client.writeDocument("./subject.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/cshema" }`);

    await client.start({
      capabilities: {
        workspace: {
          didChangeWatchedFiles: {
            dynamicRegistration: false
          }
        }
      }
    });
  });

  afterAll(async () => {
    await client.stop();
  });

  test("capabilities", async () => {
    expect(client.serverCapabilities?.workspace).to.eql({
      workspaceFolders: {
        changeNotifications: true,
        supported: true
      }
    });
  });

  test("a change to a watched file should validate the workspace", async () => {
    const validatedSchemas = new Promise((resolve) => {
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

    await touch(fileURLToPath(subjectSchemaUri));

    expect(await validatedSchemas).to.include(subjectSchemaUri);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});

const touch = (path: string) => {
  const time = new Date();
  return utimes(path, time, time);
};
