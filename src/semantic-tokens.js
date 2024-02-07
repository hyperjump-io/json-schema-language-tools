import { getKeywordId } from "@hyperjump/json-schema/experimental";
import { toAbsoluteUri } from "./util.js";


export const getSemanticTokens = function* (instance, dialectId) {
  for (const [keyNode, valueNode] of instance.entries()) {
    const keywordName = keyNode.value();
    const keywordId = keywordName === "$schema"
      ? "https://json-schema.org/keyword/schema"
      : getKeywordId(keywordName, dialectId);

    if (keywordId) {
      if (keywordId === "https://json-schema.org/keyword/comment") {
        yield { keywordInstance: keyNode.parent(), tokenType: "comment" };
      } else if (toAbsoluteUri(keywordId) !== "https://json-schema.org/keyword/unknown") {
        yield { keywordInstance: keyNode, tokenType: "keyword" };
        yield* getKeywordHandler(keywordId)(valueNode, dialectId);
      }
    }
  }
};

const schemaMapHandler = function* (instance, dialectId) {
  for (const schemaNode of instance.values()) {
    yield* getSemanticTokens(schemaNode, dialectId);
  }
};

const schemaArrayHandler = function* (instance, dialectId) {
  for (const schemaNode of instance.iter()) {
    yield* getSemanticTokens(schemaNode, dialectId);
  }
};

const noopKeywordHandler = function* () {};
const getKeywordHandler = (keywordId) => keywordId in keywordHandlers ? keywordHandlers[keywordId] : noopKeywordHandler;

const keywordHandlers = {
  "https://json-schema.org/keyword/additionalProperties": getSemanticTokens,
  "https://json-schema.org/keyword/allOf": schemaArrayHandler,
  "https://json-schema.org/keyword/anyOf": schemaArrayHandler,
  "https://json-schema.org/keyword/contains": getSemanticTokens,
  "https://json-schema.org/keyword/definitions": schemaMapHandler,
  "https://json-schema.org/keyword/dependentSchemas": schemaMapHandler,
  "https://json-schema.org/keyword/if": getSemanticTokens,
  "https://json-schema.org/keyword/then": getSemanticTokens,
  "https://json-schema.org/keyword/else": getSemanticTokens,
  "https://json-schema.org/keyword/items": schemaArrayHandler,
  "https://json-schema.org/keyword/not": getSemanticTokens,
  "https://json-schema.org/keyword/oneOf": schemaArrayHandler,
  "https://json-schema.org/keyword/patternProperties": schemaMapHandler,
  "https://json-schema.org/keyword/prefixItems": schemaArrayHandler,
  "https://json-schema.org/keyword/properties": schemaMapHandler,
  "https://json-schema.org/keyword/propertyNames": getSemanticTokens,
  "https://json-schema.org/keyword/unevaluatedItems": getSemanticTokens,
  "https://json-schema.org/keyword/unevaluatedProperties": getSemanticTokens
};
