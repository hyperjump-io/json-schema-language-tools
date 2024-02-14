import { compile, interpret, getSchema, getKeyword, subscribe, unsubscribe, DETAILED } from "@hyperjump/json-schema/experimental";


export const validate = async (uri, instance) => {
  loadKeywordSupport();
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
        const keywordHandler = getKeyword(resultNode.keyword);
        if (keywordHandler?.annotation) {
          const annotation = keywordHandler.annotation(resultNode.ast);
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

const loadKeywordSupport = () => {
  const title = getKeyword("https://json-schema.org/keyword/title");
  if (title) {
    title.annotation = identity;
  }

  const description = getKeyword("https://json-schema.org/keyword/description");
  if (description) {
    description.annotation = identity;
  }

  const _default = getKeyword("https://json-schema.org/keyword/default");
  if (_default) {
    _default.annotation = identity;
  }

  const deprecated = getKeyword("https://json-schema.org/keyword/deprecated");
  if (deprecated) {
    deprecated.annotation = identity;
  }

  const readOnly = getKeyword("https://json-schema.org/keyword/readOnly");
  if (readOnly) {
    readOnly.annotation = identity;
  }

  const writeOnly = getKeyword("https://json-schema.org/keyword/writeOnly");
  if (writeOnly) {
    writeOnly.annotation = identity;
  }

  const examples = getKeyword("https://json-schema.org/keyword/examples");
  if (examples) {
    examples.annotation = identity;
  }

  const format = getKeyword("https://json-schema.org/keyword/format");
  if (format) {
    format.annotation = identity;
  }

  const contentMediaType = getKeyword("https://json-schema.org/keyword/contentMediaType");
  if (contentMediaType) {
    contentMediaType.annotation = identity;
  }

  const contentEncoding = getKeyword("https://json-schema.org/keyword/contentEncoding");
  if (contentEncoding) {
    contentEncoding.annotation = identity;
  }

  const contentSchema = getKeyword("https://json-schema.org/keyword/contentSchema");
  if (contentSchema) {
    contentSchema.annotation = identity;
  }

  const unknown = getKeyword("https://json-schema.org/keyword/unknown");
  if (unknown) {
    unknown.annotation = identity;
  }
};
