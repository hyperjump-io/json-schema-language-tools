import { DETAILED, compile, getSchema, getKeywordName } from "@hyperjump/json-schema/experimental";
import { interpret } from "@hyperjump/json-schema/annotations/experimental";
import { toAbsoluteUri } from "./util.js";


export const annotate = async (uri, instance) => {
  const schema = await getSchema(uri);
  const compiled = await compile(schema);
  return interpret(compiled, instance, DETAILED);
};

export const decomposeSchemaDocument = function* (schemaInstance, contextDialectUri) {
  if (typeof contextDialectUri === "string") {
    contextDialectUri = toAbsoluteUri(contextDialectUri);
  }
  yield* _decomposeSchemaDocument(schemaInstance, contextDialectUri);
  yield { dialectUri: contextDialectUri, schemaInstance };
};

const _decomposeSchemaDocument = function* (schemaInstance, contextDialectUri) {
  if (schemaInstance.typeOf() === "object") {
    const embeddedDialectUri = getEmbeddedDialectUri(schemaInstance, contextDialectUri);

    if (embeddedDialectUri) {
      const embeddedSchemaInstance = schemaInstance.asEmbedded();
      yield* decomposeSchemaDocument(embeddedSchemaInstance, embeddedDialectUri);
    } else {
      for (const value of schemaInstance.values()) {
        yield* _decomposeSchemaDocument(value, contextDialectUri);
      }
    }
  } else if (schemaInstance.typeOf() === "array") {
    for (const item of schemaInstance.iter()) {
      yield* _decomposeSchemaDocument(item, contextDialectUri);
    }
  }
};

const getEmbeddedDialectUri = (schemaInstance, contextDialectUri) => {
  if (schemaInstance.pointer === "") {
    return;
  }

  const $schema = schemaInstance.step("$schema");
  if ($schema.typeOf() === "string") {
    return $schema.value();
  }

  const idToken = keywordNameFor("https://json-schema.org/keyword/id", contextDialectUri);
  if (idToken) {
    const id = schemaInstance.step(idToken);
    if (id.typeOf() === "string") {
      return contextDialectUri;
    }
  }

  const legacyIdToken = keywordNameFor("https://json-schema.org/keyword/draft-04/id", contextDialectUri);
  if (legacyIdToken) {
    const legacyId = schemaInstance.step(legacyIdToken);
    if (legacyId.typeOf() === "string" && legacyId.value()[0] !== "#") {
      return contextDialectUri;
    }
  }
};

/**
 *
 * @param {string} keywordUri
 * @param {string} dialectUri
 * @returns {string | undefined}
 */
export const keywordNameFor = (keywordUri, dialectUri) => {
  try {
    return getKeywordName(dialectUri, keywordUri);
  } catch (error) {
    return undefined;
  }
};
