import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ReferencesRequest } from "vscode-languageserver";
import { TestClient } from "../test-client.js";

import type { DocumentSettings } from "../configuration.js";


describe("Feature - References", () => {
  let client: TestClient<DocumentSettings>;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("no references", async () => {
    await client.writeDocument("./subject.schema.json", `{}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(ReferencesRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 0,
        character: 1
      },
      context: { includeDeclaration: false }
    });

    expect(response).to.eql([]);
  });

  test("don't return references that do not match location", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/locations", 
  "$defs":{
    "names": {
      
    },
    "locations": {
      
    }
  },
}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(ReferencesRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 5,
        character: 4
      },
      context: { includeDeclaration: false }
    });

    expect(response).to.eql([]);
  });

  test("match one reference", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/names", 
  "$defs":{
    "names": {
      
    }
  },
}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(ReferencesRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 5,
        character: 4
      },
      context: { includeDeclaration: false }
    });

    expect(response).to.eql([
      {
        "uri": documentUri,
        "range": {
          "start": { "line": 2, "character": 10 },
          "end": { "line": 2, "character": 25 }
        }
      }
    ]);
  });

  test("cross file reference", async () => {
    await client.writeDocument("./subjectA.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "person": {

    }
  }
}
`);
    await client.writeDocument("./subjectB.schema.json", `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "./subjectA.schema.json#/definitions/person"
}
`);

    const documentUriA = await client.openDocument("./subjectA.schema.json");
    const documentUriB = await client.openDocument("./subjectB.schema.json");

    const response = await client.sendRequest(ReferencesRequest.type, {
      textDocument: { uri: documentUriA },
      position: {
        line: 4,
        character: 4
      },
      context: { includeDeclaration: false }
    });

    expect(response).to.eql([
      {
        "uri": documentUriB,
        "range": {
          "start": { "line": 0, "character": 0 },
          "end": { "line": 3, "character": 1 }
        }
      }
    ]);
  });

  test("match self identified externally", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema":"http://json-schema.org/draft-07/schema#",
  "$ref": "https://example.com/schemas/two#/definitions/names", 
}`);
    await client.writeDocument("./subjectB.schema.json", `{
  "$schema":"http://json-schema.org/draft-07/schema#", 
  "$id": "https://example.com/schemas/two", 
  "definitions":{
    "names": {
      
    }
  }
}`);

    const documentUri = await client.openDocument("./subject.schema.json");
    const documentUriB = await client.openDocument("./subjectB.schema.json");

    const response = await client.sendRequest(ReferencesRequest.type, {
      textDocument: { uri: documentUriB },
      position: {
        line: 5,
        character: 4
      },
      context: { includeDeclaration: false }
    });

    expect(response).to.eql([
      {
        "uri": documentUri,
        "range": {
          "start": { "line": 0, "character": 0 },
          "end": { "line": 3, "character": 1 }
        }
      }
    ]);
  });

  test("match self identified internally", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema":"http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/person.json",
  "type": "object",
  "properties": {
    "names": { "$ref": "https://example.com/person.json" }
   }  
}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(ReferencesRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 46
      },
      context: { includeDeclaration: false }
    });

    expect(response).to.eql([
      {
        "uri": documentUri,
        "range": {
          "start": { "line": 5, "character": 13 },
          "end": { "line": 5, "character": 58 }
        }
      }
    ]);
  });
});
