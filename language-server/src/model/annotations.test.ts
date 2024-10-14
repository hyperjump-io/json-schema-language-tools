import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { getSchema, compile, interpret } from "@hyperjump/json-schema/experimental";
import * as JsonNode from "./json-node.js";
import { toAbsoluteUri } from "../util/util.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseTree } from "jsonc-parser";

import type { SchemaObject } from "@hyperjump/json-schema/draft-2020-12";
import type { CompiledSchema } from "@hyperjump/json-schema/experimental";
import type { Json } from "@hyperjump/json-pointer";
import type { JsonNode as JsonNodeType } from "./json-node.js";


type Suite = {
  title: string;
  schema: SchemaObject;
  subjects: Subject[];
};

type Subject = {
  instance: Json;
  assertions: Assertion[];
};

type Assertion = {
  location: string;
  keyword: string;
  expected: unknown[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dialectId = "https://json-schema.org/draft/2020-12/schema";
const host = "https://annotations.json-schema.hyperjump.io";

const testSuiteFilePath = `${__dirname}/annotation-tests`;

describe("Annotations", () => {
  fs.readdirSync(testSuiteFilePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .forEach((entry) => {
      const file = `${testSuiteFilePath}/${entry.name}`;
      const suites = JSON.parse(fs.readFileSync(file, "utf8")) as Suite[];

      suites.forEach((suite) => {
        describe(suite.title + "\n" + JSON.stringify(suite.schema, null, "  "), () => {
          let id: string;
          let compiled: CompiledSchema;

          beforeAll(async () => {
            id = `${host}/${encodeURI(suite.title)}`;
            registerSchema(suite.schema, id, dialectId);
            const schema = await getSchema(id);
            compiled = await compile(schema);
          });

          afterAll(() => {
            unregisterSchema(id);
          });

          suite.subjects.forEach((subject) => {
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

              subject.assertions.forEach((assertion) => {
                it(`${assertion.keyword} annotations at '${assertion.location}' should be ${JSON.stringify(assertion.expected)}`, () => {
                  const dialect = suite.schema.$schema ? toAbsoluteUri(suite.schema.$schema as string) : dialectId;
                  const subject = JsonNode.get(assertion.location, instance);
                  const annotations = subject ? JsonNode.annotation(subject, assertion.keyword, dialect) : [];
                  expect(annotations).to.eql(assertion.expected);
                });
              });
            });
          });
        });
      });
    });
});
