import fs from "node:fs";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { getSchema, compile } from "@hyperjump/json-schema/experimental";
import { interpret } from "@hyperjump/json-schema/annotations/experimental";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";
import * as JsonNode from "./json-node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseTree } from "jsonc-parser";

import type { SchemaObject } from "@hyperjump/json-schema/draft-2020-12";
import type { CompiledSchema } from "@hyperjump/json-schema/experimental";
import type { Json } from "@hyperjump/json-pointer";
import type { JsonNode as JsonNodeType } from "./json-node.js";


type Suite = {
  description: string;
  suite: TestCase[];
};

type TestCase = {
  description: string;
  compatibility: string;
  schema: SchemaObject;
  tests: Test[];
};

type Test = {
  instance: Json;
  assertions: Assertion[];
};

type Assertion = {
  location: string;
  keyword: string;
  expected: unknown[];
};

const host = "https://annotations.json-schema.hyperjump.io";

const testSuiteFilePath = "../node_modules/json-schema-test-suite/annotations/tests";

describe("annotations", () => {
  testRunner(2020, "https://json-schema.org/draft/2020-12/schema");
  testRunner(2019, "https://json-schema.org/draft/2019-09/schema");
  testRunner(7, "http://json-schema.org/draft-07/schema");
  testRunner(6, "http://json-schema.org/draft-06/schema");
  testRunner(4, "http://json-schema.org/draft-04/schema");
});

const testRunner = (version: number, dialect: string) => {
  describe(dialect, () => {
    fs.readdirSync(testSuiteFilePath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .forEach((entry) => {
        const file = `${testSuiteFilePath}/${entry.name}`;
        const suite = JSON.parse(fs.readFileSync(file, "utf8")) as Suite;

        for (const testCase of suite.suite) {
          if (!isCompatible(testCase.compatibility, version)) {
            continue;
          }

          describe(testCase.description + "\n" + JSON.stringify(testCase.schema, null, "  "), () => {
            let id: string;
            let compiled: CompiledSchema;

            beforeAll(async () => {
              id = `${host}/${encodeURI(suite.description)}`;
              registerSchema(testCase.schema, id, dialect);
              const schema = await getSchema(id);
              compiled = await compile(schema);
            });

            afterAll(() => {
              unregisterSchema(id);
            });

            for (const subject of testCase.tests) {
              describe("Instance: " + JSON.stringify(subject.instance), () => {
                let instance: JsonNodeType;

                beforeAll(() => {
                  const instanceJson = JSON.stringify(subject.instance, null, "  ");
                  const textDocument = TextDocument.create(id, "json", 1, instanceJson);
                  const json = textDocument.getText();
                  const root = parseTree(json, [], {
                    disallowComments: false,
                    allowTrailingComma: true,
                    allowEmptyContent: true
                  });
                  if (root) {
                    instance = JsonNode.fromJsonc(root);
                    interpret(compiled, instance);
                  }
                });

                for (const assertion of subject.assertions) {
                  test(`${assertion.keyword} annotations at '${assertion.location}' should be ${JSON.stringify(assertion.expected)}`, () => {
                    const subject = JsonNode.get(`#${assertion.location}`, instance);
                    const annotations = subject ? JsonNode.annotation(subject, assertion.keyword, dialect) : [];
                    expect(annotations).to.eql(Object.values(assertion.expected));
                  });
                }
              });
            }
          });
        }
      });
  });
};

const isCompatible = (compatibility: string | undefined, versionUnderTest: number) => {
  if (compatibility === undefined) {
    return true;
  }

  const constraints = compatibility.split(",");
  for (const constraint of constraints) {
    const matches = /(?<operator><=|>=|=)?(?<version>\d+)/.exec(constraint);
    if (!matches) {
      throw Error(`Invalid compatibility string: ${compatibility}`);
    }

    const operator = matches[1] ?? ">=";
    const version = parseInt(matches[2], 10);

    switch (operator) {
      case ">=":
        if (versionUnderTest < version) {
          return false;
        }
        break;
      case "<=":
        if (versionUnderTest > version) {
          return false;
        }
        break;
      case "=":
        if (versionUnderTest !== version) {
          return false;
        }
        break;
      default:
        throw Error(`Unsupported contraint operator: ${operator}`);
    }
  }

  return true;
};
