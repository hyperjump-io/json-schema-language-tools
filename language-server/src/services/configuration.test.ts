import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test/test-client.ts";

import type { Diagnostic } from "vscode-languageserver";


describe("Feature - Document Settings", () => {
  let client: TestClient;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("test default dialect", async () => {
    await client.changeConfiguration({ defaultDialect: "https://json-schema.org/draft/2020-12/schema" });
    await client.writeDocument("./subject.schema.json", `{}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("test no dialect", async () => {
    await client.writeDocument("./subject.schema.json", `{}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("No dialect");
  });

  test("test unknown dialect", async () => {
    await client.writeDocument("./subject.schema.json", `{ "$schema": "" }`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Unknown dialect");
  });

  test("test unknown dialect when default dialect is unknown", async () => {
    await client.changeConfiguration({ defaultDialect: "https://example.com/unknown-dialect" });
    await client.writeDocument("./subject.schema.json", `{}`);

    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0]?.message).to.eql("Unknown dialect");
  });

  test("watches only specified files", async () => {
    await client.changeConfiguration({ schemaFilePatterns: ["subjectB.schema.json"] });
    await client.writeDocument("./subject.schema.json", "{}", true);
    await client.writeDocument("./subjectB.schema.json", "{}");

    const diagnosticsPromise = new Promise<string>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.uri);
      });
    });
    await client.openDocument("./subject.schema.json");
    const documentUriB = await client.openDocument("./subjectB.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.equal(documentUriB);
  });
});
