import { getKeywordId } from "@hyperjump/json-schema/experimental";
import * as Instance from "./json-instance.js";
import { toAbsoluteUri } from "./util.js";


export const getSemanticTokens = function* (schemaDocument) {
  for (const { schemaResource, dialectUri } of schemaDocument.schemaResources) {
    yield* schemaHandler(schemaResource, dialectUri);
  }
};

const schemaHandler = function* (schemaResource, dialectUri) {
  for (const [keyNode, valueNode] of Instance.entries(schemaResource)) {
    const keywordName = Instance.value(keyNode);
    const keywordId = keywordIdFor(keywordName, dialectUri);

    if (keywordId) {
      if (keywordId === "https://json-schema.org/keyword/comment") {
        yield { keywordInstance: keyNode.parent, tokenType: "comment" };
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

const schemaMapHandler = function* (schemaResource, dialectUri) {
  for (const schemaNode of Instance.values(schemaResource)) {
    yield* schemaHandler(schemaNode, dialectUri);
  }
};

const schemaArrayHandler = function* (schemaResource, dialectUri) {
  for (const schemaNode of Instance.iter(schemaResource)) {
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
