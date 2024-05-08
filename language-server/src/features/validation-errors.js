import * as Browser from "@hyperjump/browser";
import { subscribe } from "../pubsub.js";


export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
      for await (const [instance, message] of invalidNodes(schemaDocument.errors)) {
        diagnostics.push({ instance, message });
      }
    });
  }
};

export const invalidNodes = async function* (errors) {
  for (const error of errors) {
    for await (const message of toErrorMessage(error)) {
      yield [error.instanceNode, message];
    }
  }
};

const toErrorMessage = async function* (error) {
  if (error.keyword === "https://json-schema.org/keyword/schema") {
    yield error.message;
  } else if (error.keyword === "https://json-schema.org/keyword/additionalProperties") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/allOf") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/anyOf") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/const") {
    const constValue = Browser.value(error.keywordNode);
    yield `Expected : ${JSON.stringify(constValue)}`;
  } else if (error.keyword === "https://json-schema.org/keyword/contains") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/dependentRequired") {
    const dependentRequired = Browser.value(error.keywordNode);

    const object = error.instanceNode.value();
    for (const propertyName in dependentRequired) {
      if (propertyName in object) {
        for (const required of dependentRequired[propertyName]) {
          if (!(required in object)) {
            yield `Property ${required} is required.`;
          }
        }
      }
    }
  } else if (error.keyword === "https://json-schema.org/keyword/dynamicRef") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/draft-2020-12/dynamicRef") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/enum") {
    const enumValue = Browser.value(error.keywordNode);
    yield `Expected one of: ${enumValue.map((value) => JSON.stringify(value, null, "  ")).join(", ")}`;
  } else if (error.keyword === "https://json-schema.org/keyword/exclusiveMaximum") {
    const exclusiveMaximum = Browser.value(error.keywordNode);
    yield `Must be less than ${exclusiveMaximum}`;
  } else if (error.keyword === "https://json-schema.org/keyword/exclusiveMinimum") {
    const exclusiveMinimum = Browser.value(error.keywordNode);
    yield `Must be greater than ${exclusiveMinimum}`;
  } else if (error.keyword === "https://json-schema.org/keyword/items") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/maxItems") {
    const maxItems = Browser.value(error.keywordNode);
    yield `Too many items. A maximum of ${maxItems} are allowed.`;
  } else if (error.keyword === "https://json-schema.org/keyword/maxLength") {
    const maxLength = Browser.value(error.keywordNode);
    yield `A maximum of ${maxLength} characters are allowed.`;
  } else if (error.keyword === "https://json-schema.org/keyword/maxProperties") {
    const maxProperties = Browser.value(error.keywordNode);
    yield `A maximum of ${maxProperties} properties are allowed.`;
  } else if (error.keyword === "https://json-schema.org/keyword/maximum") {
    const maximum = Browser.value(error.keywordNode);
    yield `Must be less than or equal to ${maximum}`;
  } else if (error.keyword === "https://json-schema.org/keyword/minItems") {
    const minItems = Browser.value(error.keywordNode);
    yield `A minimum of ${minItems} are required.`;
  } else if (error.keyword === "https://json-schema.org/keyword/minLength") {
    const minLength = Browser.value(error.keywordNode);
    yield `A minimum of ${minLength} characters are required.`;
  } else if (error.keyword === "https://json-schema.org/keyword/minProperties") {
    const minProperties = Browser.value(error.keywordNode);
    yield `A minimum of ${minProperties} properties are required.`;
  } else if (error.keyword === "https://json-schema.org/keyword/minimum") {
    const minimum = Browser.value(error.keywordNode);
    yield `Must be greater than or equal to ${minimum}`;
  } else if (error.keyword === "https://json-schema.org/keyword/multipleOf") {
    const multipleOf = Browser.value(error.keywordNode);
    yield `Must be a multiple of ${multipleOf}`;
  } else if (error.keyword === "https://json-schema.org/keyword/pattern") {
    const pattern = Browser.value(error.keywordNode);
    yield `Must match the pattern /${pattern.replace("/", "\\/")}/`;
  } else if (error.keyword === "https://json-schema.org/keyword/prefixItems") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/properties") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/propertyNames") {
    yield `Object contains invalid property names`;
  } else if (error.keyword === "https://json-schema.org/keyword/ref") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/keyword/required") {
    const required = Browser.value(error.keywordNode);

    const object = error.instanceNode.value();
    for (const propertyName of required) {
      if (!(propertyName in object)) {
        yield `Property ${propertyName} is required.`;
      }
    }
  } else if (error.keyword === "https://json-schema.org/keyword/type") {
    const type = Browser.value(error.keywordNode);
    yield `Expected a(n) ${type}`;
  } else if (error.keyword === "https://json-schema.org/evaluation/unevaluatedItems") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/evaluation/unevaluatedProperties") {
    // Skip
  } else if (error.keyword === "https://json-schema.org/evaluation/uniqueItems") {
    yield `All items must be unique`;
  } else if (error.keyword === "https://json-schema.org/evaluation/validate") {
    if (Browser.value(error.keywordNode) === false) {
      yield `No value allowed`;
    }
  } else {
    const keyword = error.keywordNode.cursor.split("/").pop();
    yield `Fails JSON Schema constraint '${keyword}'`;
  }
};
