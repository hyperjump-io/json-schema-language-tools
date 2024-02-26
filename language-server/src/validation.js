import * as Browser from "@hyperjump/browser";
import { getSchema } from "@hyperjump/json-schema/experimental";


export const invalidNodes = async function* (outputUnit) {
  const instance = outputUnit.instanceLocation;
  for await (const message of toErrorMessage(outputUnit)) {
    yield [instance, message];
  }

  for (const error of outputUnit.errors) {
    yield* invalidNodes(error);
  }
};

const toErrorMessage = async function* (outputUnit) {
  if (outputUnit.keyword === "https://json-schema.org/keyword/additionalProperties") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/allOf") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/anyOf") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/const") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const constValue = Browser.value(schema);
    yield `Expected : ${JSON.stringify(constValue)}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/contains") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/dependentRequired") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const dependentRequired = Browser.value(schema);

    const object = JSON.parse(outputUnit.instanceLocation.text);

    for (const propertyName in dependentRequired) {
      if (propertyName in object) {
        for (const required of dependentRequired[propertyName]) {
          if (!(required in object)) {
            yield `Property ${required} is required.`;
          }
        }
      }
    }
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/dynamicRef") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/draft-2020-12/dynamicRef") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/enum") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const enumValue = Browser.value(schema);
    yield `Expected one of: ${enumValue.map((value) => JSON.stringify(value, null, "  ")).join(", ")}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/exclusiveMaximum") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const exclusiveMaximum = Browser.value(schema);
    yield `Must be less than ${exclusiveMaximum}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/exclusiveMinimum") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const exclusiveMinimum = Browser.value(schema);
    yield `Must be greater than ${exclusiveMinimum}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/items") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/maxItems") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const maxItems = Browser.value(schema);
    yield `Too many items. A maximum of ${maxItems} are allowed.`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/maxLength") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const maxLength = Browser.value(schema);
    yield `A maximum of ${maxLength} characters are allowed.`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/maxProperties") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const maxProperties = Browser.value(schema);
    yield `A maximum of ${maxProperties} properties are allowed.`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/maximum") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const maximum = Browser.value(schema);
    yield `Must be less than or equal to ${maximum}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/minItems") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const minItems = Browser.value(schema);
    yield `A minimum of ${minItems} are required.`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/minLength") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const minLength = Browser.value(schema);
    yield `A minimum of ${minLength} characters are required.`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/minProperties") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const minProperties = Browser.value(schema);
    yield `A minimum of ${minProperties} properties are required.`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/minimum") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const minimum = Browser.value(schema);
    yield `Must be greater than or equal to ${minimum}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/multipleOf") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const multipleOf = Browser.value(schema);
    yield `Must be a multiple of ${multipleOf}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/pattern") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const pattern = Browser.value(schema);
    yield `Must match the pattern /${pattern.replace("/", "\\/")}/`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/prefixItems") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/properties") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/propertyNames") {
    yield `Object contains invalid property names`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/ref") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/required") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const required = Browser.value(schema);

    const object = JSON.parse(outputUnit.instanceLocation.text);

    for (const propertyName of required) {
      if (!(propertyName in object)) {
        yield `Property ${propertyName} is required.`;
      }
    }
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/type") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const type = Browser.value(schema);
    yield `Expected a(n) ${type}`;
  } else if (outputUnit.keyword === "https://json-schema.org/evaluation/unevaluatedItems") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/evaluation/unevaluatedProperties") {
    // Skip
  } else if (outputUnit.keyword === "https://json-schema.org/evaluation/uniqueItems") {
    yield `All items must be unique`;
  } else if (outputUnit.keyword === "https://json-schema.org/evaluation/validate") {
    if (outputUnit.errors.length === 0) {
      yield `No value allowed`;
    }
  } else {
    const keyword = outputUnit.absoluteKeywordLocation.split("/").pop();
    yield `Fails JSON Schema constraint '${keyword}'`;
  }
};
