import {
  compile,
  interpret,
  getSchema,
  getKeywordName,
  subscribe,
  unsubscribe,
  DETAILED
} from "@hyperjump/json-schema/experimental";
import { toAbsoluteUri } from "./util.js";


export const validate = async (uri, instance) => {
  const schema = await getSchema(uri);
  const compiled = await compile(schema);
  return annotateInterpret(compiled, instance);
};

const annotateInterpret = ({ ast, schemaUri }, instance) => {
  const output = [instance];
  const subscriptionToken = subscribe("result", outputHandler(output));

  try {
    const validationResult = interpret({ ast, schemaUri }, instance, DETAILED);
    return [validationResult, output[0]];
  } finally {
    unsubscribe("result", subscriptionToken);
  }
};

const outputHandler = (output) => {
  let isPassing = true;
  const instanceStack = [];

  return (message, resultNode) => {
    if (message === "result.start") {
      instanceStack.push(output[0]);
      isPassing = true;
    } else if (message === "result" && isPassing) {
      output[0] = output[0].get(`#${resultNode.instanceLocation.pointer}`);

      if (resultNode.valid) {
        if (resultNode.keyword in keywordHandlers) {
          const annotation = keywordHandlers[resultNode.keyword](resultNode.ast);
          output[0] = output[0].annotate(resultNode.keyword, annotation);
        }
      } else {
        output[0] = instanceStack[instanceStack.length - 1];
        isPassing = false;
      }
    } else if (message === "result.end") {
      instanceStack.pop();
    }
  };
};

const identity = (a) => a;

const keywordHandlers = {
  "https://json-schema.org/keyword/title": identity,
  "https://json-schema.org/keyword/description": identity,
  "https://json-schema.org/keyword/default": identity,
  "https://json-schema.org/keyword/deprecated": identity,
  "https://json-schema.org/keyword/readOnly": identity,
  "https://json-schema.org/keyword/writeOnly": identity,
  "https://json-schema.org/keyword/examples": identity,
  "https://json-schema.org/keyword/format": identity,
  "https://json-schema.org/keyword/contentMediaType": identity,
  "https://json-schema.org/keyword/contentEncoding": identity,
  "https://json-schema.org/keyword/contentSchema": identity,
  "https://json-schema.org/keyword/unknown": identity
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
