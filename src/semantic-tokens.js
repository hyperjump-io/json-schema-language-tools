import { getKeywordId } from "@hyperjump/json-schema/experimental";
import { toAbsoluteUri } from "./util.js";


export const getSemanticTokens = (schemaResources) => {
  const semanticTokens = allSemanticTokens(schemaResources);
  return sortSemanticTokens(semanticTokens);
};

const allSemanticTokens = function* (schemaResources) {
  for (const { dialectUri, schemaInstance } of schemaResources) {
    yield* schemaHandler(schemaInstance, dialectUri);
  }
};

const sortSemanticTokens = (semanticTokens) => {
  return [...semanticTokens].sort((a, b) => {
    const aStartPosition = a.keywordInstance.startPosition();
    const bStartPosition = b.keywordInstance.startPosition();

    return aStartPosition.line === bStartPosition.line
      ? aStartPosition.character - bStartPosition.character
      : aStartPosition.line - bStartPosition.line;
  });
};

const schemaHandler = function* (schemaInstance, dialectUri) {
  for (const [keyNode, valueNode] of schemaInstance.entries()) {
    const keywordName = keyNode.value();
    const keywordId = keywordIdFor(keywordName, dialectUri);

    if (keywordId) {
      if (keywordId === "https://json-schema.org/keyword/comment") {
        yield { keywordInstance: keyNode.parent(), tokenType: "comment" };
      } else if (toAbsoluteUri(keywordId) !== "https://json-schema.org/keyword/unknown") {
        yield { keywordInstance: keyNode, tokenType: "keyword" };
        yield* getKeywordHandler(keywordId)(valueNode, dialectUri);
      }
    }
  }
};

const keywordIdFor = (keywordName, dialectUri) => {
  try {
    return keywordName === "$schema"
      ? "https://json-schema.org/keyword/schema"
      : getKeywordId(keywordName, dialectUri);
  } catch (error) {
    return;
  }
};

const schemaMapHandler = function* (schemaInstance, dialectUri) {
  for (const schemaNode of schemaInstance.values()) {
    yield* schemaHandler(schemaNode, dialectUri);
  }
};

const schemaArrayHandler = function* (schemaInstance, dialectUri) {
  for (const schemaNode of schemaInstance.iter()) {
    yield* schemaHandler(schemaNode, dialectUri);
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
