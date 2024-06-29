import type { Json } from "@hyperjump/json-pointer";


export const cons: (
  baseUri: string,
  pointer: string,
  value: Json,
  type: JsonNodeType,
  children: SchemaNode[],
  parent?: SchemaNode,
  offset: number,
  textLength: number,
  dialectUri?: string,
  anchors: Record<string, string>
) => SchemaNode;
export const get: (url: string, context: SchemaNode) => SchemaNode | undefined;
export const uri: (node: SchemaNode) => string;
export const value: <A>(node: SchemaNode) => A;
export const has: (key: string, node: SchemaNode) => boolean;
export const typeOf: (node: SchemaNode) => JsonType;
export const step: (key: string, node: SchemaNode) => SchemaNode;
export const iter: (node: SchemaNode) => Generator<SchemaNode>;
export const keys: (node: SchemaNode) => Generator<SchemaNode>;
export const values: (node: SchemaNode) => Generator<SchemaNode>;
export const entries: (node: SchemaNode) => Generator<[SchemaNode, SchemaNode]>;
export const length: (node: SchemaNode) => number;

export const allNodes: (node: SchemaNode) => Generator<SchemaNode>;

export const setAnnotation: (keywordUri: string, schemaLocation: string, value: string) => void;
export const annotation: <A>(instance: SchemaNode, keyword: string, dialectUri?: string) => A[];
export const annotatedWith: (instance: SchemaNode, keyword: string, dialectUri?: string) => SchemaNode[];

export type SchemaNode = {
  baseUri: string;
  pointer: string;
  type: JsonNodeType;
  children: SchemaNode[];
  parent?: SchemaNode;
  root: SchemaNode;
  valid: boolean;
  errors: Record<string, string>;
  annotations: Record<string, Record<string, unknown>>;
  offset: number;
  textLength: number;
  dialectUri?: string;
  anchors: Record<string, string>;
};
