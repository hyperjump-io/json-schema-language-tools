import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CodeAction, CodeActionRequest, TextDocumentEdit } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";

describe("Feature - CodeAction: Extract subSchema to $defs", () => {
  let client: TestClient;
  let documentUri: string;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.closeDocument(documentUri);
    await client.stop();
  });

  test("Creating defs if not present", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 4, character: 13 },
        end: { line: 7, character: 5 }
      },
      context: { diagnostics: [] }
    });
    const expectedCodeAction = {
      edit: {
        documentChanges: [
          {
            edits: [
              {
                newText: `{ "$ref": "#/$defs/def1" }`,
                range: {
                  end: { character: 5, line: 7 },
                  start: { character: 13, line: 4 }
                }
              },
              {
                newText: `,
  "$defs": {
    "def1": {
      "type": "string",
      "format": "email"
    }
  }`,
                range: {
                  end: { character: 3, line: 8 },
                  start: { character: 3, line: 8 }
                }
              }
            ],
            textDocument: { uri: documentUri, version: null }
          }
        ]
      },
      kind: "refactor.extract",
      title: "Extract 'def1' to $defs"
    };
    expect(codeActions?.[0]).to.eql(expectedCodeAction);
  });

  test("Handling existing defs with incremental names def1,def2", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "foo": { "$ref": "#/definitions/foo" },
    "bar": {
      "type": "integer",
      "minimum": 0
    }
  },
  "definitions": {
    "def1": {
      "type": "string"
    }
  }

}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 5, character: 11 },
        end: { line: 8, character: 5 }
      },
      context: { diagnostics: [] }
    });
    const expectedCodeAction = {
      edit: {
        documentChanges: [
          {
            edits: [
              {
                newText: `{ "$ref": "#/definitions/def2" }`,
                range: {
                  end: { line: 8, character: 5 },
                  start: { line: 5, character: 11 }
                }
              },
              {
                newText: `,
    "def2": {
      "type": "integer",
      "minimum": 0
    }`,
                range: {
                  end: { character: 5, line: 13 },
                  start: { character: 5, line: 13 }
                }
              }
            ],
            textDocument: { uri: documentUri, version: null }
          }
        ]
      },
      kind: "refactor.extract",
      title: "Extract 'def2' to definitions"
    };
    expect(codeActions?.[0]).to.eql(expectedCodeAction);
  });

  test("codeAction trigger when valid selection is made", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 4, character: 13 },
        end: { line: 7, character: 5 }
      },
      context: { diagnostics: [] }
    });
    expect(codeActions?.[0].title).to.equal("Extract 'def1' to $defs");
  });

  test("no CodeAction trigger when selection is a single cursor point", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 5, character: 6 },
        end: { line: 5, character: 6 }
      },
      context: { diagnostics: [] }
    });
    expect(codeActions).to.eql([]);
  });

  test("extracted subSchema is added properly in empty definition node", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "bar": {
      "type": "integer",
      "minimum": 0
    }
  },
  "definitions": {
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 4, character: 11 },
        end: { line: 7, character: 5 }
      },
      context: { diagnostics: [] }
    });
    const expectedCodeAction = {
      edit: {
        documentChanges: [
          {
            edits: [
              {
                newText: `{ "$ref": "#/definitions/def1" }`,
                range: {
                  end: { line: 7, character: 5 },
                  start: { line: 4, character: 11 }
                }
              },
              {
                newText: `
    "def1": {
      "type": "integer",
      "minimum": 0
    }`,
                range: {
                  end: { character: 18, line: 9 },
                  start: { character: 18, line: 9 }
                }
              }
            ],
            textDocument: { uri: documentUri, version: null }
          }
        ]
      },
      kind: "refactor.extract",
      title: "Extract 'def1' to definitions"
    };
    expect(codeActions?.[0]).to.eql(expectedCodeAction);
  });

  test("no codeAction trigger when selection is not a subSchema", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 2, character: 7 },
        end: { line: 6, character: 13 }
      },
      context: { diagnostics: [] }
    });
    expect(codeActions).to.eql([]);
  });

  test("when extracting a schema in an embedded schema, it gets added to the embedded schema and not the root schema", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$id": "https://example.com/schemas/customer",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "first_name": { "type": "string" },
    "last_name": { "type": "string" },
    "shipping_address": { "$ref": "/schemas/address" },
    "billing_address": { "$ref": "/schemas/address" }
  },
  "required": ["first_name", "last_name", "shipping_address", "billing_address"],
  "$defs": {
    "address": {
      "$id": "https://example.com/schemas/address",
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "street_address": { "type": "string" },
        "city": { "type": "string" },
        "state": { "$ref": "#/definitions/state" }
      },
      "required": ["street_address", "city", "state"],
      "definitions": {
        "state": { "enum": ["CA", "NY", "... etc ..."] }
      }
    }
  }
}`);
    documentUri = await client.openDocument("subject.schema.json");

    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 17, character: 26 },
        end: { line: 17, character: 46 }
      },
      context: { diagnostics: [] }
    });
    const expectedCodeAction = {
      edit: {
        documentChanges: [
          {
            edits: [
              {
                newText: `{ "$ref": "#/definitions/def1" }`,
                range: {
                  start: { line: 17, character: 26 },
                  end: { line: 17, character: 46 }
                }
              },
              {
                newText: `,
        "def1": { "type": "string" }`,
                range: {
                  end: { character: 56, line: 23 },
                  start: { character: 56, line: 23 }
                }
              }
            ],
            textDocument: { uri: documentUri, version: null }
          }
        ]
      },
      kind: "refactor.extract",
      title: "Extract 'def1' to definitions"
    };
    expect(codeActions?.[0]).to.eql(expectedCodeAction);
  });

  test("Definition node should be added at the end of the schema", async () => {
    await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  }
}`);
    const documentUri = await client.openDocument("subject.schema.json");
    const codeActions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri: documentUri },
      range: {
        start: { line: 4, character: 13 },
        end: { line: 7, character: 5 }
      },
      context: { diagnostics: [] }
    });
    const firstAction = codeActions?.[0] as CodeAction;
    const documentChange = firstAction.edit?.documentChanges?.[0] as TextDocumentEdit;
    const edits = documentChange.edits;
    expect(edits?.[1]?.range?.start).to.eql({ line: 8, character: 3 });
    expect(edits?.[1]?.range?.end).to.eql({ line: 8, character: 3 });
  });

  describe("should maintain indentation as per used in the schema", () => {
    test("checking for the indentation: 2 spaces", async () => {
      await client.changeConfiguration(
        undefined,
        {
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false
        },
        {
          eol: "\n"
        }
      );
      await client.writeDocument("subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    }
  }
}`);
      documentUri = await client.openDocument("subject.schema.json");

      const codeActions = await client.sendRequest(CodeActionRequest.type, {
        textDocument: { uri: documentUri },
        range: {
          start: { line: 4, character: 12 },
          end: { line: 6, character: 5 }
        },
        context: { diagnostics: [] }
      });
      const firstAction = codeActions?.[0] as CodeAction;
      const documentChange = firstAction.edit?.documentChanges?.[0] as TextDocumentEdit;
      const edits = documentChange.edits;
      expect(edits?.[1].newText).to.eql(`,
  "$defs": {
    "def1": {
      "type": "string"
    }
  }`);
    });

    test("checking for the indentation: 4 spaces", async () => {
      await client.changeConfiguration(
        undefined,
        {
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: false
        },
        {
          eol: "\n"
        }
      );
      await client.writeDocument("subject.schema.json", `{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "name": {
            "type": "string"
        }
    }
}`);
      documentUri = await client.openDocument("subject.schema.json");

      const codeActions = await client.sendRequest(CodeActionRequest.type, {
        textDocument: { uri: documentUri },
        range: {
          start: { line: 4, character: 16 },
          end: { line: 6, character: 11 }
        },
        context: { diagnostics: [] }
      });
      const firstAction = codeActions?.[0] as CodeAction;
      const documentChange = firstAction.edit?.documentChanges?.[0] as TextDocumentEdit;
      const edits = documentChange.edits;
      expect(edits?.[1].newText).to.eql(`,
    "$defs": {
        "def1": {
            "type": "string"
        }
    }`);
    });
  });
});
