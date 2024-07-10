import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { CompletionRequest } from "vscode-languageserver";
import { TestClient } from "../test-client.js";
import completion from "./completion.js";
import ifThenCompletionFeature, { ifThenPatternCompletion } from "./if-then-completion.js";

import type { DocumentSettings } from "./document-settings.js";


describe("Feature - if/then completion", () => {
  let client: TestClient<DocumentSettings>;
  let documentUri: string;

  beforeAll(async () => {
    client = new TestClient([completion, ifThenCompletionFeature]);
    await client.start();
  });

  afterEach(async () => {
    await client.closeDocument(documentUri);
  });

  afterAll(async () => {
    await client.stop();
  });

  test("if/then completion with colon", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{
  "if":
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 7
      }
    });

    expect(response).to.eql(ifThenPatternCompletion);
  });

  test("if/then completion with space", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{
  "if": 
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 8
      }
    });

    expect(response).to.eql(ifThenPatternCompletion);
  });

  test("if/then completion on property key", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{
  "if":
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 3
      }
    });

    expect(response).to.eql([]);
  });

  test("if/then completion on property value", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{
  "if": ""
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 9
      }
    });

    expect(response).to.eql([]);
  });

  test("if/then completion without colon", async () => {
    documentUri = await client.openDocument("subject.schema.json", `{
  "if"
}`);

    const response = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 5
      }
    });

    expect(response).to.eql([]);
  });
});
