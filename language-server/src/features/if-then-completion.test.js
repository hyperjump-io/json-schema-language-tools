import { beforeAll, describe, expect, test } from "vitest";
import { CompletionRequest } from "vscode-languageserver";
import completion from "./completion.js";
import ifThenCompletionFeature, { ifThenPatternCompletion } from "./if-then-completion.js";
import { getTestClient, initializeServer, openDocument } from "../test-utils.js";


describe("Feature - if/then completion", () => {
  let client;

  beforeAll(async () => {
    client = getTestClient([completion, ifThenCompletionFeature]);
    await initializeServer(client);
  });

  test("if/then completion with colon", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "if":
}`);

    /**
     * @type {import("vscode-languageserver").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 7
      }
    };

    const response = await client.sendRequest(CompletionRequest, params);

    expect(response).to.eql(ifThenPatternCompletion);
  });

  test("if/then completion with space", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "if": 
}`);

    /**
     * @type {import("vscode-languageserver").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 8
      }
    };

    const response = await client.sendRequest(CompletionRequest, params);

    expect(response).to.eql(ifThenPatternCompletion);
  });

  test("if/then completion on property key", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "if":
}`);

    /**
     * @type {import("vscode-languageserver").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 3
      }
    };

    const response = await client.sendRequest(CompletionRequest, params);

    expect(response).to.eql([]);
  });

  test("if/then completion on property value", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "if": ""
}`);

    /**
     * @type {import("vscode-languageserver").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 9
      }
    };

    const response = await client.sendRequest(CompletionRequest, params);

    expect(response).to.eql([]);
  });

  test("if/then completion without colon", async () => {
    const documentUri = await openDocument(client, "subject.schema.json", `{
  "if"
}`);

    /**
     * @type {import("vscode-languageserver").CompletionParams}
     */
    const params = {
      textDocument: { uri: documentUri },
      position: {
        line: 1,
        character: 5
      }
    };

    const response = await client.sendRequest(CompletionRequest, params);

    expect(response).to.eql([]);
  });
});
