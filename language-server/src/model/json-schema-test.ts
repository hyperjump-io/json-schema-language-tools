import fs from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { toAbsoluteIri } from "@hyperjump/uri";
import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { getSchema, compile, interpret } from "@hyperjump/json-schema/experimental";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseTree } from "jsonc-parser";
import * as JsonNode from "./json-node.js";

import type { SchemaObject } from "@hyperjump/json-schema/draft-2020-12";
import type { CompiledSchema } from "@hyperjump/json-schema/experimental";
import type { Json } from "@hyperjump/json-pointer";


type Suite = {
  description: string;
  schema: SchemaObject;
  tests: Test[];
};

type Test = {
  description: string;
  data: Json;
  valid: boolean;
};

const shouldSkip = (skip: Set<string>, path: string[]) => {
  let key = "";
  for (const segment of path) {
    key = `${key}|${segment}`;
    if (skip.has(key)) {
      return true;
    }
  }
  return false;
};

const testSuitePath = `${import.meta.dirname}/../../../node_modules/json-schema-test-suite`;

const addRemotes = (dialectId: string, filePath = `${testSuitePath}/remotes`, url = "") => {
  fs.readdirSync(filePath, { withFileTypes: true })
    .forEach((entry) => {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const remote = JSON.parse(fs.readFileSync(`${filePath}/${entry.name}`, "utf8")) as SchemaObject;
        if (!remote.$schema || toAbsoluteIri(remote.$schema as string) === dialectId) {
          registerSchema(remote, `http://localhost:1234${url}/${entry.name}`, dialectId);
        }
      } else if (entry.isDirectory()) {
        addRemotes(dialectId, `${filePath}/${entry.name}`, `${url}/${entry.name}`);
      }
    });
};

export const runTestSuite = (draft: string, dialectId: string, skip: Set<string>) => {
  const testSuiteFilePath = `${testSuitePath}/tests/${draft}`;

  describe(`${draft} ${dialectId}`, () => {
    beforeAll(() => {
      addRemotes(dialectId);
    });

    fs.readdirSync(testSuiteFilePath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .forEach((entry) => {
        const file = `${testSuiteFilePath}/${entry.name}`;

        describe(entry.name, () => {
          const suites = JSON.parse(fs.readFileSync(file, "utf8")) as Suite[];

          suites.forEach((suite) => {
            describe(suite.description, () => {
              let url: string;
              let compiled: CompiledSchema;

              beforeAll(async () => {
                if (shouldSkip(skip, [draft, entry.name, suite.description])) {
                  return;
                }
                url = `http://${draft}-test-suite.json-schema.org/${encodeURI(suite.description)}`;
                registerSchema(suite.schema, url, dialectId);
                const schema = await getSchema(url);
                compiled = await compile(schema);
              });

              afterAll(() => {
                unregisterSchema(url);
              });

              suite.tests.forEach((test) => {
                if (shouldSkip(skip, [draft, entry.name, suite.description, test.description])) {
                  it.skip(test.description, () => { /* empty */ });
                } else {
                  it(test.description, () => {
                    const instanceJson = JSON.stringify(test.data, null, "  ");
                    const textDocument = TextDocument.create(url, "json", 1, instanceJson);
                    const json = textDocument.getText();
                    const root = parseTree(json, [], {
                      disallowComments: false,
                      allowTrailingComma: true,
                      allowEmptyContent: true
                    });
                    if (root) {
                      const instance = JsonNode.fromJsonc(root);
                      const output = interpret(compiled, instance);
                      expect(output.valid).to.equal(test.valid);
                    } else {
                      expect.fail("Failed to parse JSON instance");
                    }
                  });
                }
              });
            });
          });
        });
      });
  });
};
