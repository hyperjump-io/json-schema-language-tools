import { beforeAll, describe, expect, test } from "vitest";
import { CompletionRequest } from "vscode-languageserver";
import completion from "./completion.js";
import ifThenCompletionFeature, { ifThenPatternCompletion } from "./if-then-completion.js";
import { getTestClient, initializeServer, openDocument } from "../test-utils.js";

import type { Connection } from "vscode-languageserver";


describe("Feature - if/then completion", () => {
  let client: Connection;

  beforeAll(async () => {
    client = getTestClient([completion, ifThenCompletionFeature]);
    await initializeServer(client);
  });

  test("if/then completion with colon", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
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
    const documentUri = await openDocument(client, "subject.schema.json", `{
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
    const documentUri = await openDocument(client, "subject.schema.json", `{
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
    const documentUri = await openDocument(client, "subject.schema.json", `{
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
    const documentUri = await openDocument(client, "subject.schema.json", `{
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
