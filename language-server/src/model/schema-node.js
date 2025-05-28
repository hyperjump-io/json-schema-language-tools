import * as JsonNode from "./json-node.js";
import { normalizeUri } from "../util/util.js";

/**
 * @import { Json } from "@hyperjump/json-pointer"
 * @import { JsonType } from "./json-node.js"
 */


/**
 * @typedef {{
 *   baseUri: string;
 *   pointer: string;
 *   type: JsonType;
 *   children: SchemaNode[];
 *   parent?: SchemaNode;
 *   root: SchemaNode;
 *   valid: boolean;
 *   errors: Record<string, string>;
 *   annotations: Record<string, Record<string, unknown>>;
 *   offset: number;
 *   textLength: number;
 *   dialectUri?: string;
 *   anchors: Record<string, string>;
 *   isSchema: boolean;
 *   isEmbeddedSchema: boolean;
 *   keywordUri: string | undefined;
 *   embedded: Record<string, SchemaNode>;
 * }} SchemaNode
 */

/**
 * @type (
 *   baseUri: string,
 *   pointer: string,
 *   value: Json | undefined,
 *   type: JsonType,
 *   parent: SchemaNode | undefined,
 *   offset: number,
 *   textLength: number,
 *   dialectUri: string | undefined
 * ) => SchemaNode
 */
export const cons = (uri, pointer, value, type, parent, offset, textLength, dialectUri) => {
  const node = /** @type SchemaNode */ (JsonNode.cons(uri, pointer, value, type, [], parent, offset, textLength));
  node.baseUri = normalizeUri(node.baseUri);
  node.dialectUri = dialectUri;
  node.anchors = parent?.anchors ?? {};
  node.embedded = parent?.embedded ?? {};
  node.isEmbeddedSchema = false;

  if (node.baseUri !== parent?.baseUri) {
    node.embedded[uri] = node;
    node.root = node;
    node.isSchema = true;
  } else {
    node.isSchema = false;
  }

  return node;
};

export {
  uri, value, typeOf, has, length,
  step, iter, keys, values, entries,
  allNodes,
  annotation, annotatedWith
} from "./json-node.js";
