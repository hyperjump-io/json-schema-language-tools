import * as JsonPointer from "@hyperjump/json-pointer";
import { reduce } from "@hyperjump/pact";
import * as JsonNode from "./json-node.js";
import { allSchemaDocuments } from "./features/schema-registry.js";
import { toAbsoluteUri, uriFragment, resolveIri, normalizeUri } from "./util.js";

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
 * ) => SchemaNode;
 */
export const cons = (uri, pointer, value, type, parent, offset, textLength, dialectUri) => {
  const node = /** @type SchemaNode */ (JsonNode.cons(uri, pointer, value, type, [], parent, offset, textLength));
  node.baseUri = normalizeUri(node.baseUri);
  node.dialectUri = dialectUri;
  node.anchors = parent?.anchors ?? {};
  node.embedded = parent?.embedded ?? {};

  if (node.baseUri !== parent?.baseUri) {
    node.embedded[uri] = node;
    node.root = node;
    node.isSchema = true;
  } else {
    node.isSchema = false;
  }

  return node;
};

/** @type (url: string, context: SchemaNode) => SchemaNode | undefined */
export const get = (uri, node) => {
  const schemaId = toAbsoluteUri(resolveIri(uri, node?.baseUri));
  const schemaResource = getSchemaResource(schemaId, node);
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

/** @type (uri: string, node: SchemaNode) => SchemaNode | undefined */
const getSchemaResource = (uri, node) => {
  for (const embeddedSchemaUri in node.embedded) {
    if (embeddedSchemaUri === uri) {
      return node.embedded[embeddedSchemaUri];
    }
  }

  for (const schemaDocument of allSchemaDocuments()) {
    if (schemaDocument.schemaResources[0].baseUri === uri) {
      return schemaDocument.schemaResources[0];
    }
  }
};

export {
  uri, value, typeOf, has, length,
  step, iter, keys, values, entries,
  allNodes,
  setAnnotation, annotation, annotatedWith
} from "./json-node.js";
