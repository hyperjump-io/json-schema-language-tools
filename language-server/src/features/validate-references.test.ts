import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import documentSettings from "./document-settings.js";
import semanticTokens from "./semantic-tokens.js";
import workspace from "./workspace.js";
import validateReferencesFeature from "./validate-references.js";

import type { Diagnostic } from "vscode-languageserver";
import type { DocumentSettings } from "./document-settings.js";


describe("Feature - Validate References Errors", () => {
  let client: TestClient<DocumentSettings>;

  beforeEach(async () => {
    client = new TestClient([
      workspace,
      documentSettings,
      semanticTokens,
      validateReferencesFeature
    ]);
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("invalid external reference", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "topics": {
      "$ref": "https://example.com/schemas/nonexistent.schema.json"
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Referenced schema doesn't exist");
  });

  test("valid external reference (file based)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subjectB.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#"
}`);
    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "topics": {
      "$ref": "./subjectB.schema.json"
    }
  }
}`);

    await client.openDocument("./subjectB.schema.json");
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("valid external reference (self identifying)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subjectB.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/schemas/person.json"
}`);
    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "topics": {
      "$ref": "http://example.com/schemas/person.json"
    }
  }
}`);

    await client.openDocument("./subjectB.schema.json");
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("valid local reference", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "topics": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/topic"
      }
    }
  },
  "definitions": {
    "topic": {
      "type": "string"
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("invalid local reference", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "topics": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/topic"
      }
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics[0].message).to.eql("Referenced schema doesn't exist");
  });

  test("valid external reference (file-based embedded)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "/embedded",
  "$defs": {
    "a": {
      "$id": "/embedded"
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("valid external reference (self-identified relative embedded)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/main",
  "$ref": "/embedded",
  "$defs": {
    "a": {
      "$id": "/embedded"
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("valid external reference (self-identified absolute embedded)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/main",
  "$ref": "/embedded",
  "$defs": {
    "a": {
      "$id": "https://example.com/embedded"
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("valid external/local reference (external)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "a": {}
  }
}`);
    await client.writeDocument("./subjectB.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "./subject.schema.json#/$defs/a"
  }
}`);

    await client.openDocument("./subject.schema.json");
    await client.openDocument("./subjectB.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });

  test("valid external/local reference (embedded)", async () => {
    const diagnosticsPromise = new Promise<Diagnostic[]>((resolve) => {
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        resolve(params.diagnostics);
      });
    });

    await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/subject",
  "$ref": "./external#/$defs/b",
  "$defs": {
    "a": {
      "$id": "./external",
      "$defs": {
        "b": {}
      }
    }
  }
}`);
    await client.openDocument("./subject.schema.json");

    const diagnostics = await diagnosticsPromise;
    expect(diagnostics).to.eql([]);
  });
});
