import { SemanticTokensBuilder } from "vscode-languageserver";
import { getKeywordId } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../schema-node.js";
import { getSchemaDocument } from "./schema-registry.js";
import { toAbsoluteUri } from "../util.js";
import { isMatchedFile } from "./workspace.js";
import { fileURLToPath } from "node:url";
import { getDocumentSettings } from "./document-settings.js";

/**
 * @import * as Type from "./semantic-tokens.js"
 * @import { Feature } from "../build-server.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js";
 */


/** @type Feature */
export default {
  load(connection, documents) {
    const tokenBuilders = new Map();

    documents.onDidClose(({ document }) => {
      tokenBuilders.delete(document.uri);
    });

    /** @type Type.getTokenBuilder */
    const getTokenBuilder = (uri) => {
      if (!tokenBuilders.has(uri)) {
        tokenBuilders.set(uri, new SemanticTokensBuilder());
      }

      return tokenBuilders.get(uri);
    };

    /** @type Type.buildTokens */
    const buildTokens = async (builder, uri) => {
      const textDocument = documents.get(uri);
      if (!textDocument) {
        return;
      }

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
      const filePath = fileURLToPath(textDocument.uri);
      const settings = await getDocumentSettings(connection);
      const schemaFilePatterns = settings.schemaFilePatterns;
      if (!isMatchedFile(filePath, schemaFilePatterns)) {
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
  },

  onInitialize({ capabilities }) {
    const semanticTokens = capabilities.textDocument?.semanticTokens;
    return semanticTokens ? {
      semanticTokensProvider: {
        legend: buildSemanticTokensLegend(semanticTokens),
        range: false,
        full: {
          delta: true
        }
      }
    } : {};
  },

  async onInitialized() {
  },

  onShutdown() {
  }
};

/** @type Type.Legend */
const semanticTokensLegend = {
  tokenTypes: {},
  tokenModifiers: {}
};

/** @type Type.buildSemanticTokensLegend */
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
  /** @type string[] */
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
/** @type Type.sortSemanticTokens */
const sortSemanticTokens = (semanticTokens, textDocument) => {
  return [...semanticTokens].sort((a, b) => {
    const aStartPosition = textDocument.positionAt(a.keywordInstance.offset);
    const bStartPosition = textDocument.positionAt(b.keywordInstance.offset);

    return aStartPosition.line === bStartPosition.line
      ? aStartPosition.character - bStartPosition.character
      : aStartPosition.line - bStartPosition.line;
  });
};

/** @type Type.getSemanticTokens */
const getSemanticTokens = function* (schemaDocument) {
  for (const schemaResource of schemaDocument.schemaResources) {
    yield* schemaHandler(schemaResource);
  }
};

/** @type Type.schemaHandler */
const schemaHandler = function* (schemaResource) {
  for (const [keyNode, valueNode] of SchemaNode.entries(schemaResource)) {
    const keywordName = SchemaNode.value(keyNode);
    const keywordId = keywordIdFor(keywordName, schemaResource.dialectUri);

    if (keywordId) {
      if (keywordId === "https://json-schema.org/keyword/comment") {
        const node = /** @type SchemaNodeType */ (keyNode.parent);
        yield { keywordInstance: node, tokenType: "comment" };
      } else if (toAbsoluteUri(keywordId) !== "https://json-schema.org/keyword/unknown") {
        yield { keywordInstance: keyNode, tokenType: "keyword" };
        yield* getKeywordHandler(keywordId)(valueNode);
      }
    }
  }
};

/** @type Type.keywordIdFor */
const keywordIdFor = (keywordName, dialectUri) => {
  if (!dialectUri) {
    return;
  }

  try {
    return keywordName === "$schema"
      ? "https://json-schema.org/keyword/schema"
      : getKeywordId(keywordName, dialectUri);
  } catch (error) {
    return;
  }
};

/** @type Type.schemaHandler */
const schemaMapHandler = function* (schemaResource) {
  for (const schemaNode of SchemaNode.values(schemaResource)) {
    yield* schemaHandler(schemaNode);
  }
};

/** @type Type.schemaHandler */
const schemaArrayHandler = function* (schemaResource) {
  for (const schemaNode of SchemaNode.iter(schemaResource)) {
    yield* schemaHandler(schemaNode);
  }
};

const noopKeywordHandler = function* () {};

/** @type Type.getKeywordHandler */
const getKeywordHandler = (keywordId) => keywordId in keywordHandlers ? keywordHandlers[keywordId] : noopKeywordHandler;

/** @type Record<string, Type.schemaHandler> */
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
