import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PublishDiagnosticsNotification, ShowMessageRequest, ShowMessageRequestParams } from "vscode-languageserver";
import { TestClient } from "../test/test-client.ts";
import { wait } from "../test/test-utils.ts";
import { DENY_ACTION, GET_TRUSTED_VOCABULARIES, TRUST_ACTION, TRUST_VOCABULARY } from "./trusted-vocabularies.js";

import type { Diagnostic } from "vscode-languageserver";


const vocabularySource = (id: number) => `
export default ({ addKeyword, defineVocabulary }) => {
  addKeyword({
    id: "https://example.com/keyword/custom-${id}",
    compile: () => null,
    interpret: () => true
  });
  defineVocabulary("https://example.com/vocab/custom-${id}", {
    "custom": "https://example.com/keyword/custom-${id}"
  });
};
`;

const dialectSchema = (id: number) => `{
  "$id": "https://example.com/dialect/custom-${id}",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$dynamicAnchor": "meta",

  "$vocabulary": {
    "https://json-schema.org/draft/2020-12/vocab/core": true,
    "https://example.com/vocab/custom-${id}": true
  }
}`;

describe("Service - Custom Vocabularies", () => {
  let client: TestClient;
  let prompts: ShowMessageRequestParams[];
  let messages: ShowMessageRequestParams[];
  let answer: string | undefined;
  let trusted: string[];
  let trustedWrites: string[];
  let requestedUrls: string[];

  // The vocabulary registry is global to the process and can't be unloaded, so
  // every test gets its own vocabulary and dialect URIs.
  let id = 0;

  const stubEsmSh = (source = vocabularySource(id), status = 200) => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve(new Response(source, { status }));
    }));
  };

  // Diagnostics can be published more than once while a document settles, so
  // use the last one rather than the first.
  const diagnosticsFor = async (path: string) => {
    let diagnostics: Diagnostic[] = [];
    client.onNotification(PublishDiagnosticsNotification.type, (params) => {
      diagnostics = params.diagnostics;
    });
    await client.openDocument(path);
    await wait(200);
    return diagnostics;
  };

  beforeEach(async () => {
    prompts = [];
    messages = [];
    answer = TRUST_ACTION;
    trusted = [];
    trustedWrites = [];
    requestedUrls = [];
    id++;
    stubEsmSh();

    client = new TestClient();
    client.onRequest(ShowMessageRequest.type, (params) => {
      // Messages without actions are notices, not questions
      if (!params.actions?.length) {
        messages.push(params);
        return null;
      }
      prompts.push(params);
      return answer ? { title: answer } : null;
    });
    client.onRequest(GET_TRUSTED_VOCABULARIES, () => trusted);
    client.onRequest(TRUST_VOCABULARY, (specifier: string) => {
      trustedWrites.push(specifier);
      trusted.push(specifier);
    });
    await client.start();
    await client.writeDocument("./dialect.schema.json", dialectSchema(id));
    await client.writeDocument("./subject.schema.json", `{
      "$schema": "https://example.com/dialect/custom-${id}",
      "custom": true
    }`);
  });

  afterEach(async () => {
    await client.stop();
    vi.unstubAllGlobals();
  });

  test("asks before loading, then loads the vocabulary from esm.sh", async () => {
    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"] });
    await wait(100);

    expect(prompts).to.have.length(1);
    expect(prompts[0]?.message).to.include("my-vocabulary@1.0.0");
    expect(prompts[0]?.actions?.map(({ title }) => title)).to.eql([TRUST_ACTION, DENY_ACTION]);
    expect(requestedUrls).to.eql(["https://esm.sh/my-vocabulary@1.0.0?standalone"]);
    expect(trustedWrites).to.eql(["my-vocabulary@1.0.0"]);

    // The dialect depends on the vocabulary, so it's only valid once it has loaded
    const diagnostics = await diagnosticsFor("./dialect.schema.json");
    expect(diagnostics).to.eql([]);
  });

  test("does not download or run anything when the user declines", async () => {
    answer = DENY_ACTION;

    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"] });
    await wait(100);

    expect(prompts).to.have.length(1);
    expect(requestedUrls).to.eql([]);
    expect(trustedWrites).to.eql([]);

    const diagnostics = await diagnosticsFor("./dialect.schema.json");
    expect(diagnostics[0]?.message).to.eql("Unknown vocabulary");
  });

  test("dismissing the prompt is the same as declining", async () => {
    answer = undefined;

    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"] });
    await wait(100);

    expect(requestedUrls).to.eql([]);
    expect(trustedWrites).to.eql([]);
  });

  test("does not ask again for a vocabulary the client already trusts", async () => {
    trusted.push("my-vocabulary@1.0.0");

    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"] });
    await wait(100);

    expect(prompts).to.eql([]);
    expect(requestedUrls).to.eql(["https://esm.sh/my-vocabulary@1.0.0?standalone"]);
  });

  test("trust applies to an exact version only", async () => {
    trusted.push("my-vocabulary@1.0.0");

    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.1"] });
    await wait(100);

    expect(prompts).to.have.length(1);
    expect(prompts[0]?.message).to.include("my-vocabulary@1.0.1");
  });

  test("does not prompt again for a declined vocabulary when configuration changes", async () => {
    answer = DENY_ACTION;

    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"] });
    await wait(100);
    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"], defaultDialect: "https://json-schema.org/draft/2020-12/schema" });
    await wait(100);

    expect(prompts).to.have.length(1);
  });

  test("does not load the same vocabulary twice", async () => {
    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"] });
    await wait(100);
    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@1.0.0"], defaultDialect: "https://json-schema.org/draft/2020-12/schema" });
    await wait(100);

    expect(requestedUrls).to.have.length(1);
  });

  test.each([
    "my-vocabulary",
    "my-vocabulary@latest",
    "my-vocabulary@^1.0.0",
    "my-vocabulary@1.0.0/../../evil",
    "my-vocabulary@1.0.0?alias=evil",
    "https://evil.example.com/vocabulary.js",
    "../local-file.js"
  ])("rejects '%s' without prompting or downloading", async (specifier) => {
    await client.changeConfiguration({ customVocabularies: [specifier] });
    await wait(100);

    expect(prompts).to.eql([]);
    expect(requestedUrls).to.eql([]);
    expect(messages[0]?.message).to.include("Invalid custom vocabulary");
  });

  test("a package that fails to download doesn't stop the server", async () => {
    stubEsmSh("Not Found", 404);

    await client.changeConfiguration({ customVocabularies: ["missing-vocabulary@1.0.0"] });
    await wait(100);

    expect(messages[0]?.message).to.include("Unable to load custom vocabulary");
  });

  test("a package without a default export function doesn't stop the server", async () => {
    stubEsmSh("export const nope = 1;");

    await client.changeConfiguration({ customVocabularies: ["bad-vocabulary@1.0.0"] });
    await wait(100);

    expect(messages[0]?.message).to.include("default export");
  });
});

describe("Service - Custom Vocabularies with a client that can't persist trust", () => {
  let client: TestClient;
  let prompts: number;

  beforeEach(async () => {
    prompts = 0;
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(vocabularySource(0)))));

    client = new TestClient();
    client.onRequest(ShowMessageRequest.type, () => {
      prompts++;
      return { title: TRUST_ACTION };
    });
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
    vi.unstubAllGlobals();
  });

  test("still loads once the user confirms", async () => {
    await client.changeConfiguration({ customVocabularies: ["my-vocabulary@2.0.0"] });
    await wait(100);

    expect(prompts).to.equal(1);
  });
});
