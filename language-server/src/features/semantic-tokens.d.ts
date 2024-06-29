import type {
  SemanticTokensBuilder,
  SemanticTokensClientCapabilities,
  SemanticTokensLegend
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SchemaDocument } from "../schema-document.js";
import type { SchemaNode } from "../schema-node.js";
import type { Feature } from "../build-server.js";


export type Legend = {
  tokenTypes: Record<string, number>,
  tokenModifiers: Record<string, number>
};

type SemanticToken = {
  keywordInstance: SchemaNode;
  tokenType: string;
  tokenModifier: string;
};

type KeywordToken = {
  keywordInstance: SchemaNode,
  tokenType: string
};

export const getTokenBuilder: (uri: string) => SemanticTokensBuilder;
export const buildTokens: (builder: SemanticTokensBuilder, uri: string) => Promise<void>;
export const buildSemanticTokensLegend: (capability: SemanticTokensClientCapabilities) => SemanticTokensLegend;
export const sortSemanticTokens: (semanticTokens: SemanticTokens, textDocument: TextDocument) => SemanticToken[];
export const getSemanticTokens: (schemaDocument: SchemaDocument) => Generator<KeywordToken>;
export const schemaHandler: (schemaResource: SchemaNode) => Generator<KeywordToken>;
export const keywordIdFor: (keywordName: string, dialectUri?: string) => string | undefined;
export const getKeywordHandler: (keywordId: string) => typeof schemaHandler;

declare const semanticTokens: Feature;
export default semanticTokens;
