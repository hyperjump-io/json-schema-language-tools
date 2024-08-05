import * as JsonPointer from "@hyperjump/json-pointer";
import { reduce } from "@hyperjump/pact";
import * as JsonNode from "./json-node.js";
import { getSchemaResource } from "./features/schema-registry.js";
import { toAbsoluteUri, uriFragment, resolveIri } from "./util.js";

/**
 * @import { Json } from "@hyperjump/json-pointer"
 * @import { JsonNodeType } from "./json-node.js"
 */


/**
 * @typedef {{
 *   baseUri: string;
 *   pointer: string;
 *   type: JsonNodeType;
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
 * }} SchemaNode
 */

/**
 * @type (
 *   baseUri: string,
 *   pointer: string,
 *   value: Json,
 *   type: JsonNodeType,
 *   children: SchemaNode[],
 *   parent: SchemaNode | undefined,
 *   offset: number,
 *   textLength: number,
 *   dialectUri: string | undefined,
 *   anchors: Record<string, string>
 * ) => SchemaNode;
 */
export const cons = (uri, pointer, value, type, children, parent, offset, textLength, dialectUri, anchors) => {
  const node = /** @type SchemaNode */ (JsonNode.cons(uri, pointer, value, type, children, parent, offset, textLength));
  node.dialectUri = dialectUri;
  node.anchors = anchors;

  return node;
};

/** @type (url: string, context: SchemaNode) => SchemaNode | undefined */
export const get = (uri, node) => {
  const schemaId = toAbsoluteUri(resolveIri(uri, node?.baseUri));
  const schemaResource = node.baseUri === schemaId ? node : getSchemaResource(schemaId);
  if (!schemaResource) {
    return;
  }

  const fragment = uriFragment(uri);
  const pointer = fragment === "" || fragment[0] === "/" ? fragment : schemaResource.anchors[fragment];
  if (typeof pointer !== "string") {
    return;
  }

  return reduce((/** @type SchemaNode | undefined */ node, segment) => {
    if (node === undefined) {
      return;
    }

    segment = segment === "-" && JsonNode.typeOf(node) === "array" ? `${JsonNode.length(node)}` : segment;
    return JsonNode.step(segment, node);
  }, schemaResource.root, JsonPointer.pointerSegments(pointer));
};

export {
  uri, value, typeOf, has, length,
  step, iter, keys, values, entries,
  allNodes,
  setAnnotation, annotation, annotatedWith
} from "./json-node.js";
