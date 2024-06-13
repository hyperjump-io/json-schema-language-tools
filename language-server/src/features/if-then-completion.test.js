import { beforeAll, describe, expect, test } from "vitest";
import { CompletionRequest, InitializeRequest, InitializedNotification } from "vscode-languageserver/node.js";
import completion from "./completion.js";
import ifThenCompletionFeature, { ifThenPatternCompletion } from "./if-then-completion.js";
import { getTestClient, openDocument } from "../test-utils.js";


describe("Feature - if/then completion", () => {
  let client;

  beforeAll(async () => {
    client = getTestClient([completion, ifThenCompletionFeature]);
    const init = {
      capabilities: {}
    };
    await client.sendRequest(InitializeRequest, init);
    await client.sendNotification(InitializedNotification);
  });

  test("if/then completion with colon", async () => {
    const documentUri = "file://path/to/workspace/subject1.schema.json";
    await openDocument(client, documentUri, `{
  "if":
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 7
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);

    expect(response).to.eql(ifThenPatternCompletion);
  });

  test("if/then completion with space", async () => {
    const documentUri = "file://path/to/workspace/subject2.schema.json";
    await openDocument(client, documentUri, `{
  "if": 
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 8
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);

    expect(response).to.eql(ifThenPatternCompletion);
  });

  test("if/then completion on property key", async () => {
    const documentUri = "file://path/to/workspace/subject3.schema.json";
    await openDocument(client, documentUri, `{
  "if":
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 3
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);

    expect(response).to.eql([]);
  });

  test("if/then completion on property value", async () => {
    const documentUri = "file://path/to/workspace/subject4.schema.json";
    await openDocument(client, documentUri, `{
  "if": ""
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 9
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);

    expect(response).to.eql([]);
  });

  test("if/then completion without colon", async () => {
    const documentUri = "file://path/to/workspace/subject5.schema.json";
    await openDocument(client, documentUri, `{
  "if"
}`);

    /**
     * @type {import("vscode-languageserver/node.js").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 5
      }
    };

    const response = await client.sendRequest(CompletionRequest.type, params);

    expect(response).to.eql([]);
  });
});
