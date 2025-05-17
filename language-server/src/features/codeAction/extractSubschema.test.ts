import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { CodeActionRequest } from "vscode-languageserver";
import { TestClient } from "../../test/test-client.ts";

describe("Feature - CodeAction: Extract subSchema to $defs", () => {
  let client: TestClient;
  let documentUri: string;

  beforeAll(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.closeDocument(documentUri);
  });

  afterAll(async () => {
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
                  end: {
                    character: 5,
                    line: 7
                  },
                  start: {
                    character: 13,
                    line: 4
                  }
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
                  end: {
                    character: 3,
                    line: 8
                  },
                  start: {
                    character: 3,
                    line: 8
                  }
                }
              }
            ],
            textDocument: {
              uri: documentUri,
              version: null
            }
          }
        ]
      },
      kind: "refactor.extract",
      title: "Extract 'def1' to $defs"
    };
    expect(codeActions?.[0]).toMatchObject(expectedCodeAction);
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
                  end: {
                    character: 5,
                    line: 8
                  },
                  start: {
                    character: 11,
                    line: 5
                  }
                }
              },
              {
                newText: `,
    "def2": {
      "type": "integer",
      "minimum": 0
    }`,
                range: {
                  end: {
                    character: 5,
                    line: 13
                  },
                  start: {
                    character: 5,
                    line: 13
                  }
                }
              }
            ],
            textDocument: {
              uri: documentUri,
              version: null
            }
          }
        ]
      },
      kind: "refactor.extract",
      title: "Extract 'def2' to definitions"
    };
    expect(codeActions?.[0]).toMatchObject(expectedCodeAction);
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
    expect(codeActions?.[0].title).toBe("Extract 'def1' to $defs");
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
});
