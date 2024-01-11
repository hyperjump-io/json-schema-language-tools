import * as Browser from "@hyperjump/browser";
import { getSchema, getKeywordName } from "@hyperjump/json-schema/experimental";
import { getNode, pointerFromUri } from "./util.js";


const skipKeyword = new Set([
  "https://json-schema.org/evaluation/validate",
  "https://json-schema.org/keyword/ref",
  "https://json-schema.org/keyword/allOf",
  "https://json-schema.org/keyword/anyOf",
  "https://json-schema.org/keyword/properties"
]);
export const invalidNodes = async function* (outputUnit, dialect, tree) {
  if (!skipKeyword.has(outputUnit.keyword)) {
    const pointer = pointerFromUri(outputUnit.instanceLocation);
    yield [
      getNode(tree, pointer),
      await toErrorMessage(outputUnit, dialect)
    ];
  }

  for (const error of outputUnit.errors) {
    yield* invalidNodes(error, dialect, tree);
  }
};

const toErrorMessage = async (outputUnit, dialect) => {
  if (outputUnit.keyword === "https://json-schema.org/keyword/enum") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const enumValue = Browser.value(schema);
    return `Expected one of: ${JSON.stringify(enumValue)}`;
  } else if (outputUnit.keyword === "https://json-schema.org/keyword/type") {
    const schema = await getSchema(outputUnit.absoluteKeywordLocation);
    const type = Browser.value(schema);
    return `Expected a(n) ${type}`;
  } else {
    const keyword = getKeywordName(dialect, outputUnit.keyword);
    return `Fails JSON Schema constraint '${keyword}'`;
  }
};
