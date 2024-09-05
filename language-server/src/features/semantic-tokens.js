import { SemanticTokensBuilder } from "vscode-languageserver";
import { isSchema } from "./document-settings.js";

/**
 * @import { SemanticTokensClientCapabilities, SemanticTokensLegend } from "vscode-languageserver"
 * @import { TextDocument } from "vscode-languageserver-textdocument";
 * @import { Feature } from "../build-server.js"
 * @import { SchemaDocument } from "../schema-document.js";
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js";
 */


/**
 * @typedef {{
 *   tokenTypes: Record<string, number>,
 *   tokenModifiers: Record<string, number>
 * }} Legend
 *
 * @typedef {{
 *   keywordInstance: SchemaNodeType;
 *   tokenType: string;
 *   tokenModifier?: string;
 * }} KeywordToken
 */

/** @type Feature */
export default {
  async load(connection, schemas) {
    const tokenBuilders = new Map();

    schemas.onDidClose(({ document }) => {
      tokenBuilders.delete(document.textDocument.uri);
    });

    /** @type (uri: string) => SemanticTokensBuilder */
    const getTokenBuilder = (uri) => {
      if (!tokenBuilders.has(uri)) {
        tokenBuilders.set(uri, new SemanticTokensBuilder());
      }

      return tokenBuilders.get(uri);
    };

    /** @type (builder: SemanticTokensBuilder, uri: string) => Promise<void> */
    const buildTokens = async (builder, uri) => {
      const schemaDocument = await schemas.getOpen(uri);
      if (!schemaDocument) {
        return;
      }

      const semanticTokens = getSemanticTokens(schemaDocument);
      // VSCode requires this list to be in order. Neovim doesn't care.
      for (const { keywordInstance, tokenType, tokenModifier } of sortSemanticTokens(semanticTokens, schemaDocument.textDocument)) {
        const startPosition = schemaDocument.textDocument.positionAt(keywordInstance.offset);
        builder.push(
          startPosition.line,
          startPosition.character,
          keywordInstance.textLength,
          semanticTokensLegend.tokenTypes[tokenType] ?? 0,
          tokenModifier !== undefined ? semanticTokensLegend.tokenModifiers[tokenModifier] ?? 0 : 0
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

  async onShutdown() {
  }
};

/** @type Legend */
const semanticTokensLegend = {
  tokenTypes: {},
  tokenModifiers: {}
};

/** @type (capability: SemanticTokensClientCapabilities) => SemanticTokensLegend */
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

/** @type (semanticTokens: Generator<KeywordToken>, textDocument: TextDocument) => KeywordToken[] */
const sortSemanticTokens = (semanticTokens, textDocument) => {
  return [...semanticTokens].sort((a, b) => {
    const aStartPosition = textDocument.positionAt(a.keywordInstance.offset);
    const bStartPosition = textDocument.positionAt(b.keywordInstance.offset);

    return aStartPosition.line === bStartPosition.line
      ? aStartPosition.character - bStartPosition.character
      : aStartPosition.line - bStartPosition.line;
  });
};

/** @type (schemaDocument: SchemaDocument) => Generator<KeywordToken> */
const getSemanticTokens = function* (schemaDocument) {
  for (const schemaResource of schemaDocument.schemaResources) {
    yield* allKeywords(schemaResource);
  }
};

/** @type (node: SchemaNodeType) => Generator<KeywordToken> */
const allKeywords = function* (node) {
  if (node.type === "property") {
    const keyNode = node.children[0];
    if (keyNode.keywordUri) {
      if (keyNode.keywordUri === "https://json-schema.org/keyword/comment") {
        yield { keywordInstance: node, tokenType: "comment" };
      } else if (!keyNode.keywordUri.startsWith("https://json-schema.org/keyword/unknown#")) {
        yield { keywordInstance: keyNode, tokenType: "keyword" };
      }
    }
  }

  for (const child of node.children) {
    yield* allKeywords(child);
  }
};
