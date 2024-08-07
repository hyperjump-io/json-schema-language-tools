import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import schemaRegistry from "./schema-registry.js";
import workspace from "./workspace.js";
import validationErrorsFeature from "./validation-errors.js";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "./document-settings.js";


describe("Feature - Document Settings", () => {
  let client: TestClient<DocumentSettings>;

  beforeEach(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      semanticTokens,
      schemaRegistry,
      validationErrorsFeature
    ]);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("test default dialect", async () => {
    await client.changeConfiguration({ defaultDialect: "https://json-schema.org/draft/2020-12/schema" });

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{}`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("test no dialect", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{}`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("No dialect");
  });

  test("test unknown dialect", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{ "$schema": "" }`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown dialect");
  });

  test("test unknown dialect when default dialect is unknown", async () => {
    await client.changeConfiguration({ defaultDialect: "https://example.com/unknown-dialect" });

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.openDocument("./subject.schema.json", `{}`);

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Unknown dialect");
  });

  test("watches only specified files", async () => {
    await client.changeConfiguration({ "schemaFilePatterns": ["**/subjectB.schema.json"] });

    const diagnosticsPromise = new Promise<string>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.uri);
      });
    });

    await client.openDocument("./subject.schema.json", "{}");
    const documentUriB = await client.openDocument("./subjectB.schema.json", "{}");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.equal(documentUriB);
  });
});
