import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DefinitionRequest } from "vscode-languageserver";
import { TestClient } from "../test/test-client.ts";


describe("Feature - Goto Definition", () => {
  let client: TestClient;

  beforeEach(async () => {
    client = new TestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  test("no defintions", async () => {
    await client.writeDocument("./subject.schema.json", `{}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 0,
        character: 1
      }
    });

    expect(response).to.eql([]);
  });

  test("don't return definitions that do not match location", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/locations", 
  "$defs": {
    "names": {
      
    },
    "locations": {
      
    }
  },
}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 11
      }
    });

    expect(response).to.eql([{
      uri: documentUri,
      range: {
        start: { line: 7, character: 17 },
        end: { line: 9, character: 5 }
      }
    }]);
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

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 20
      }
    });

    expect(response).to.eql([
      {
        uri: documentUri,
        range: {
          start: { line: 4, character: 13 },
          end: { line: 6, character: 5 }
        }
      }
    ]);
  });
  test("match one definition", async () => {
    await client.writeDocument("./subject.schema.json", `{
  "$schema":"https://json-schema.org/draft/2020-12/schema",
  "$ref": "#/$defs/names", 
  "$defs":{
    "names": {
      
    }
  },
}`);
    const documentUri = await client.openDocument("./subject.schema.json");

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 18
      }
    });

    expect(response).to.eql([
      {
        uri: documentUri,
        range: {
          start: { line: 4, character: 13 },
          end: { line: 6, character: 5 }
        }
      }
    ]);
  });

  test("cross file definition", async () => {
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

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUriB },
      position: {
        line: 2,
        character: 20
      }
    });

    expect(response).to.eql([
      {
        uri: documentUriA,
        range: {
          start: { line: 3, character: 14 },
          end: { line: 5, character: 5 }
        }
      }
    ]);
  });

  test("match self identified externally", { retry: 3 }, async () => {
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

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 2,
        character: 37
      }
    });

    expect(response).to.eql([
      {
        uri: documentUriB,
        range: {
          start: { line: 4, character: 13 },
          end: { line: 6, character: 5 }
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

    const response = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 5,
        character: 30
      }
    });

    expect(response).to.eql([
      {
        uri: documentUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 7, character: 1 }
        }
      }
    ]);
  });
});
