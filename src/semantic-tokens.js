import { getKeywordId } from "@hyperjump/json-schema/experimental";
import { entries, iter, values } from "./tree-sitter.js";
import { getNode, toAbsoluteUri } from "./util.js";


export const getSemanticTokens = function* (tree) {
  const dialectId = JSON.parse(getNode(tree, "/$schema").text);
  yield* schemaHandler(tree.rootNode.firstChild, dialectId);
};

const schemaHandler = function* (node, dialectId) {
  for (const [keyNode, valueNode] of entries(node)) {
    const keywordName = JSON.parse(keyNode.text);
    const keywordId = keywordName === "$schema"
      ? "https://json-schema.org/keyword/schema"
      : getKeywordId(keywordName, dialectId);

    if (keywordId) {
      if (keywordId === "https://json-schema.org/keyword/comment") {
        yield { keywordNode: keyNode.parent, tokenType: "comment" };
      } else if (toAbsoluteUri(keywordId) !== "https://json-schema.org/keyword/unknown") {
        yield { keywordNode: keyNode, tokenType: "keyword" };
        yield* getKeywordHandler(keywordId)(valueNode, dialectId);
      }
    }
  }
};

const schemaMapHandler = function* (node, dialectId) {
  for (const schemaNode of values(node)) {
    yield* schemaHandler(schemaNode, dialectId);
  }
};

const schemaArrayHandler = function* (node, dialectId) {
  for (const schemaNode of iter(node)) {
    yield* schemaHandler(schemaNode, dialectId);
  }
};

const noopKeywordHandler = function* () {};
const getKeywordHandler = (keywordId) => keywordId in keywordHandlers ? keywordHandlers[keywordId] : noopKeywordHandler;

const keywordHandlers = {
  "https://json-schema.org/keyword/additionalProperties": schemaHandler,
  "https://json-schema.org/keyword/allOf": schemaArrayHandler,
  "https://json-schema.org/keyword/anyOf": schemaArrayHandler,
  "https://json-schema.org/keyword/contains": schemaHandler,
  "https://json-schema.org/keyword/definitions": schemaMapHandler,
  "https://json-schema.org/keyword/dependentSchemas": schemaMapHandler,
  "https://json-schema.org/keyword/if": schemaHandler,
  "https://json-schema.org/keyword/then": schemaHandler,
  "https://json-schema.org/keyword/else": schemaHandler,
  "https://json-schema.org/keyword/items": schemaArrayHandler,
  "https://json-schema.org/keyword/not": schemaHandler,
  "https://json-schema.org/keyword/oneOf": schemaArrayHandler,
  "https://json-schema.org/keyword/patternProperties": schemaMapHandler,
  "https://json-schema.org/keyword/prefixItems": schemaArrayHandler,
  "https://json-schema.org/keyword/properties": schemaMapHandler,
  "https://json-schema.org/keyword/propertyNames": schemaHandler,
  "https://json-schema.org/keyword/unevaluatedItems": schemaHandler,
  "https://json-schema.org/keyword/unevaluatedProperties": schemaHandler
};
