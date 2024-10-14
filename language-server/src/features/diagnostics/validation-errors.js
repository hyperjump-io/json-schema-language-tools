import * as Browser from "@hyperjump/browser";
import jsonStringify from "json-stringify-deterministic";
import * as SchemaNode from "../../model/schema-node.js";

/**
 * @import { SchemaObject } from "@hyperjump/json-schema"
 * @import { Json } from "@hyperjump/json-pointer"
 * @import { SchemaNode as SchemaNodeType } from "../../model/schema-node.js"
 * @import { SchemaError } from "../../model/schema-document.js"
 * @import { DiagnosticsProvider, ValidationDiagnostic } from "./diagnostics.js"
 */


/** @implements DiagnosticsProvider */
export class ValidationErrorsDiagnosticsProvider {
  constructor() {
  }

  /** @type DiagnosticsProvider["getDiagnostics"] */
  async getDiagnostics(schemaDocument) { // eslint-disable-line @typescript-eslint/require-await
    const diagnostics = [];

    for (const diagnostic of this.#invalidNodes(schemaDocument.errors)) {
      diagnostics.push(diagnostic);
    }

    return diagnostics;
  }

  /** @type (errors: SchemaError[]) => Generator<ValidationDiagnostic> */
  * #invalidNodes(errors) {
    for (const error of errors) {
      for (const diagnostic of this.#toErrorMessage(error)) {
        yield diagnostic;
      }
    }
  }

  /** @type (error: SchemaError) => Generator<ValidationDiagnostic> */
  * #toErrorMessage(error) {
    if (error.message) {
      yield {
        instance: error.instanceNode,
        message: error.message,
        severity: error.severity
      };
    } else if (error.keywordNode) {
      if (error.keyword === "https://json-schema.org/keyword/additionalProperties") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/allOf") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/anyOf") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/const") {
        /** @type ReturnType<typeof Browser.value<Json>> */
        const constValue = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Expected : ${JSON.stringify(constValue)}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/contains") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/dependentRequired") {
        /** @type ReturnType<typeof Browser.value<Record<string, string[]>>> */
        const dependentRequired = Browser.value(error.keywordNode);

        /** @type ReturnType<typeof SchemaNode.value<Record<string, unknown>>> */
        const object = SchemaNode.value(error.instanceNode);
        for (const propertyName in dependentRequired) {
          if (propertyName in object) {
            for (const required of dependentRequired[propertyName]) {
              if (!(required in object)) {
                yield {
                  instance: error.instanceNode,
                  message: `Property ${required} is required.`
                };
              }
            }
          }
        }
      } else if (error.keyword === "https://json-schema.org/keyword/dynamicRef") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/draft-2020-12/dynamicRef") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/enum") {
        /** @type unknown[] */
        const enumValue = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Expected one of: ${toListMessage(enumValue.map((value) => JSON.stringify(value)))}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/exclusiveMaximum") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const exclusiveMaximum = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Must be less than ${exclusiveMaximum}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/exclusiveMinimum") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const exclusiveMinimum = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Must be greater than ${exclusiveMinimum}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/items") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/maxItems") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const maxItems = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `A maximum of ${maxItems} items are allowed`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/maxLength") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const maxLength = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `A maximum of ${maxLength} characters are allowed.`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/maxProperties") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const maxProperties = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `A maximum of ${maxProperties} properties are allowed.`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/maximum") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const maximum = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Must be less than or equal to ${maximum}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/minItems") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const minItems = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `A minimum of ${minItems} items are required`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/minLength") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const minLength = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `A minimum of ${minLength} characters are required`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/minProperties") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const minProperties = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `A minimum of ${minProperties} properties are required`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/minimum") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const minimum = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Must be greater than or equal to ${minimum}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/multipleOf") {
        /** @type ReturnType<typeof Browser.value<number>> */
        const multipleOf = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Must be a multiple of ${multipleOf}`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/pattern") {
        /** @type ReturnType<typeof Browser.value<string>> */
        const pattern = Browser.value(error.keywordNode);
        yield {
          instance: error.instanceNode,
          message: `Must match the pattern /${pattern.replace("/", "\\/")}/`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/prefixItems") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/properties") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/propertyNames") {
        yield {
          instance: error.instanceNode,
          message: `Object contains invalid property names`
        };
      } else if (error.keyword === "https://json-schema.org/keyword/ref") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/required") {
        /** @type ReturnType<typeof Browser.value<string[]>> */
        const required = Browser.value(error.keywordNode);

        /** @type ReturnType<typeof SchemaNode.value<Record<string, unknown>>> */
        const object = SchemaNode.value(error.instanceNode);
        for (const propertyName of required) {
          if (!(propertyName in object)) {
            yield {
              instance: error.instanceNode,
              message: `Property ${propertyName} is required.`
            };
          }
        }
      } else if (error.keyword === "https://json-schema.org/keyword/type") {
        /** @type ReturnType<typeof Browser.value<string | string[]>> */
        const type = Browser.value(error.keywordNode);
        if (Array.isArray(type)) {
          yield {
            instance: error.instanceNode,
            message: `Expected ${["a", "o"].includes(type[0][0]) ? "an" : "a"} ${toListMessage(type)}`
          };
        } else {
          yield {
            instance: error.instanceNode,
            message: `Expected ${["a", "o"].includes(type[0]) ? "an" : "a"} ${type}`
          };
        }
      } else if (error.keyword === "https://json-schema.org/keyword/if") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/then") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/else") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/unevaluatedItems") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/unevaluatedProperties") {
        // Skip
      } else if (error.keyword === "https://json-schema.org/keyword/uniqueItems") {
        /** @type Record<string, SchemaNodeType[]> */
        const matches = {};
        for (const item of SchemaNode.iter(error.instanceNode)) {
          const match = jsonStringify(SchemaNode.value(item));
          if (!(match in matches)) {
            matches[match] = [];
          }
          matches[match].push(item);
        }
        for (const match in matches) {
          if (matches[match].length > 1) {
            for (const node of matches[match]) {
              yield {
                instance: node,
                message: `All items must be unique`
              };
            }
          }
        }
      } else if (error.keyword === "https://json-schema.org/keyword/draft-04/dependencies") {
        /** @type ReturnType<typeof Browser.value<Record<string, SchemaObject | string[]>>> */
        const dependencies = Browser.value(error.keywordNode);
        for (const property in dependencies) {
          if (Array.isArray(dependencies[property])) {
            const required = dependencies[property];

            /** @type ReturnType<typeof SchemaNode.value<Record<string, unknown>>> */
            const object = SchemaNode.value(error.instanceNode);
            for (const propertyName of required) {
              if (!(propertyName in object)) {
                yield {
                  instance: error.instanceNode,
                  message: `Property "${propertyName}" is required`
                };
              }
            }
          }
        }
      } else {
        const keyword = error.keywordNode.cursor.split("/").pop();
        yield {
          instance: error.instanceNode,
          message: `Fails JSON Schema constraint '${keyword}'`
        };
      }
    }
  }
}

/** @type (list: string[]) => string */
const toListMessage = (list) => {
  if (list.length === 1) {
    return list[0];
  } else if (list.length === 2) {
    return `${list[0]} or ${list[1]}`;
  } else {
    const lastItem = list.pop();
    const result = list.join(", ");
    return `${result}, or ${lastItem}`;
  }
};
