import { SemanticTokensBuilder } from "vscode-languageserver";

/**
 * @import { SemanticTokensClientCapabilities, SemanticTokensLegend } from "vscode-languageserver"
 * @import { TextDocument } from "vscode-languageserver-textdocument"
 * @import { Server } from "../build-server.js"
 * @import { SchemaRegistry } from "../schema-registry.js"
 * @import { Configuration } from "../configuration.js"
 * @import { SchemaDocument } from "../schema-document.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
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

export class SemanticTokensFeature {
  /** @type Legend */
  #semanticTokensLegend;

  /**
   * @param {Server} server
   * @param {SchemaRegistry} schemas
   * @param {Configuration} configuration
   */
  constructor(server, schemas, configuration) {
    this.#semanticTokensLegend = {
      tokenTypes: {},
      tokenModifiers: {}
    };

    server.onInitialize(({ capabilities }) => {
      const semanticTokens = capabilities.textDocument?.semanticTokens;
      return {
        capabilities: semanticTokens ? {
          semanticTokensProvider: {
            legend: this.#buildSemanticTokensLegend(semanticTokens),
            range: false,
            full: {
              delta: true
            }
          }
        } : {}
      };
    });

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

      const semanticTokens = this.#getSemanticTokens(schemaDocument);
      // VSCode requires this list to be in order. Neovim doesn't care.
      for (const { keywordInstance, tokenType, tokenModifier } of this.#sortSemanticTokens(semanticTokens, schemaDocument.textDocument)) {
        const startPosition = schemaDocument.textDocument.positionAt(keywordInstance.offset);
        builder.push(
          startPosition.line,
          startPosition.character,
          keywordInstance.textLength,
          this.#semanticTokensLegend.tokenTypes[tokenType] ?? 0,
          tokenModifier !== undefined ? this.#semanticTokensLegend.tokenModifiers[tokenModifier] ?? 0 : 0
        );
      }
    };

    server.languages.semanticTokens.on(async ({ textDocument }) => {
      if (!await configuration.isSchema(textDocument.uri)) {
        return { data: [] };
      }

      const builder = getTokenBuilder(textDocument.uri);
      await buildTokens(builder, textDocument.uri);

      return builder.build();
    });

    server.languages.semanticTokens.onDelta(async ({ textDocument, previousResultId }) => {
      const builder = getTokenBuilder(textDocument.uri);
      builder.previousResult(previousResultId);
      await buildTokens(builder, textDocument.uri);

      return builder.buildEdits();
    });
  }

  /** @type (capability: SemanticTokensClientCapabilities) => SemanticTokensLegend */
  #buildSemanticTokensLegend(capability) {
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
        this.#semanticTokensLegend.tokenTypes[tokenType] = tokenTypes.length;
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
        this.#semanticTokensLegend.tokenModifiers[tokenModifier] = tokenModifiers.length;
        tokenModifiers.push(tokenModifier);
      }
    }

    return { tokenTypes, tokenModifiers };
  }

  /** @type (semanticTokens: Generator<KeywordToken>, textDocument: TextDocument) => KeywordToken[] */
  #sortSemanticTokens(semanticTokens, textDocument) {
    return [...semanticTokens].sort((a, b) => {
      const aStartPosition = textDocument.positionAt(a.keywordInstance.offset);
      const bStartPosition = textDocument.positionAt(b.keywordInstance.offset);

      return aStartPosition.line === bStartPosition.line
        ? aStartPosition.character - bStartPosition.character
        : aStartPosition.line - bStartPosition.line;
    });
  }

  /** @type (schemaDocument: SchemaDocument) => Generator<KeywordToken> */
  * #getSemanticTokens(schemaDocument) {
    for (const schemaResource of schemaDocument.schemaResources) {
      yield* this.#allKeywords(schemaResource);
    }
  }

  /** @type (node: SchemaNodeType) => Generator<KeywordToken> */
  * #allKeywords(node) {
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
      yield* this.#allKeywords(child);
    }
  }
}
