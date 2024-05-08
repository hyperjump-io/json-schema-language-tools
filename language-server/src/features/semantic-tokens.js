import { SemanticTokensBuilder } from "vscode-languageserver";
import { getKeywordId } from "@hyperjump/json-schema/experimental";
import * as Instance from "../json-instance.js";
import { getSchemaDocument } from "./schema-documents.js";
import { toAbsoluteUri } from "../util.js";
import { isSchema } from "./document-settings.js";


export default {
  onInitialize({ capabilities }) {
    return {
      semanticTokensProvider: {
        legend: buildSemanticTokensLegend(capabilities.textDocument?.semanticTokens),
        range: false,
        full: {
          delta: true
        }
      }
    };
  },

  onInitialized(connection, documents) {
    const tokenBuilders = new Map();

    documents.onDidClose(({ document }) => {
      tokenBuilders.delete(document.uri);
    });

    const getTokenBuilder = (uri) => {
      if (!tokenBuilders.has(uri)) {
        tokenBuilders.set(uri, new SemanticTokensBuilder());
      }

      return tokenBuilders.get(uri);
    };

    const buildTokens = async (builder, uri) => {
      const textDocument = documents.get(uri);
      const schemaDocument = await getSchemaDocument(connection, textDocument);
      const semanticTokens = getSemanticTokens(schemaDocument);
      for (const { keywordInstance, tokenType, tokenModifier } of sortSemanticTokens(semanticTokens, textDocument)) {
        const startPosition = textDocument.positionAt(keywordInstance.offset);
        builder.push(
          startPosition.line,
          startPosition.character,
          keywordInstance.textLength,
          semanticTokensLegend.tokenTypes[tokenType] ?? 0,
          semanticTokensLegend.tokenModifiers[tokenModifier] ?? 0
        );
      }
    };

    connection.languages.semanticTokens.on(async ({ textDocument }) => {
      if (!isSchema(textDocument.uri)) {
        return { data: [] };
      }

      const builder = getTokenBuilder(textDocument.uri);
      await buildTokens(builder, textDocument.uri);

      return builder.build();
    });

    connection.languages.semanticTokens.onDelta(async ({ textDocument, previousResultId }) => {
      const builder = getTokenBuilder(textDocument.uri);
      builder.previousResult(previousResultId);
      await buildTokens(builder, textDocument.uri);

      return builder.buildEdits();
    });
  }
};

const semanticTokensLegend = {
  tokenTypes: {},
  tokenModifiers: {}
};

const buildSemanticTokensLegend = (capability) => {
  const clientTokenTypes = new Set(capability.tokenTypes);
  const serverTokenTypes = [
    "property",
    "keyword",
    "comment",
    "string",
    "regexp"
  ];

  const tokenTypes = [];
  for (const tokenType of serverTokenTypes) {
    if (clientTokenTypes.has(tokenType)) {
      semanticTokensLegend.tokenTypes[tokenType] = tokenTypes.length;
      tokenTypes.push(tokenType);
    }
  }

  const clientTokenModifiers = new Set(capability.tokenModifiers);
  const serverTokenModifiers = [
  ];

  const tokenModifiers = [];
  for (const tokenModifier of serverTokenModifiers) {
    if (clientTokenModifiers.has(tokenModifier)) {
      semanticTokensLegend.tokenModifiers[tokenModifier] = tokenModifiers.length;
      tokenModifiers.push(tokenModifier);
    }
  }

  return { tokenTypes, tokenModifiers };
};

// VSCode requires this list to be in order. Neovim doesn't care.
const sortSemanticTokens = (semanticTokens, textDocument) => {
  return [...semanticTokens].sort((a, b) => {
    const aStartPosition = textDocument.positionAt(a.keywordInstance.offset);
    const bStartPosition = textDocument.positionAt(b.keywordInstance.offset);

    return aStartPosition.line === bStartPosition.line
      ? aStartPosition.character - bStartPosition.character
      : aStartPosition.line - bStartPosition.line;
  });
};

const getSemanticTokens = function* (schemaDocument) {
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
