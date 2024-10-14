import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../test/test-client.ts";
import { PublishDiagnosticsNotification } from "vscode-languageserver";

import type { DocumentSettings } from "./configuration.js";


describe("Feature - workspace (neovim)", () => {
  let client: TestClient<DocumentSettings>;
  let documentUriA: string;
  let documentUriB: string;

  beforeAll(async () => {
    client = new TestClient();
    await client.start({
      capabilities: {
        workspace: {
          didChangeWatchedFiles: {
            dynamicRegistration: false
          }
        }
      }
    });

    documentUriA = await client.writeDocument("./subjectA.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);
    documentUriB = await client.writeDocument("./subjectB.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);
  });

  afterAll(async () => {
    await client.stop();
  });

  test("capabilities", () => {
    expect(client.serverCapabilities?.workspace).to.eql({
      workspaceFolders: {
        changeNotifications: true,
        supported: true
      }
    });
  });

  test("a change to a watched file should validate the workspace", async () => {
    const schemaUris: string[] = [];

    client.onNotification(PublishDiagnosticsNotification.type, (params) => {
      schemaUris.push(params.uri);
    });

    await client.writeDocument("./subjectB.schema.json", `{ "$schema": "https://json-schema.org/draft/2020-12/schema" }`);

    expect(schemaUris).to.eql([documentUriA, documentUriB]);
  });

  test.todo("changing the workspace folders should validate the workspace", () => {
    // DidChangeWorkspaceFoldersNotification
  });
});
