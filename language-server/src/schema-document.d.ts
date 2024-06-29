import type { SchemaDocument as SchemaDoc } from "@hyperjump/json-schema/experimental";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SchemaNode } from "./schema-node.js";
import type { Node } from "jsonc-parser";


export type SchemaDocument = {
  textDocument: TextDocument,
  schemaResources: SchemaNode[],
  errors: SchemaError[]
};

export type SchemaError = {
  keyword: string;
  keywordNode?: Browser<SchemaDoc>;
  instanceNode: SchemaNode,
  message?: string
};

export const cons: (textDocument: TextDocument) => SchemaDocument;
export const fromTextDocument: (textDocument: TextDocument, contextDialectUri?: string) => Promise<SchemaDocument>;
export const buildSchemaResources: (
  document: SchemaDocument,
  node: Node,
  uri?: string,
  dialectUri?: string,
  pointer?: string,
  parent?: SchemaNode,
  anchors?: Record<string, string>
) => SchemaNode;
export const getEmbeddedDialectUri: (node: Node, dialectUri?: string) => string | undefined;
export const fromInstanceLocation: (document: SchemaDocument, instanceLocation: string) => SchemaNode | undefined;
export const findNodeAtOffset: (document: SchemaDocument, offset: number) => SchemaNode | undefined;
export const _findNodeAtOffset: (node: SchemaNode, offset: number, includeRightBound?: boolean) => SchemaNode | undefined;
export const contains: (node: SchemaNode, offset: number, includeRightBound?: boolean) => boolean;
export const nodeStep: (node: Node, key?: string) => Node | undefined;
