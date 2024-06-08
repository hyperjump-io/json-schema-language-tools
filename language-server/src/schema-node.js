import * as JsonPointer from "@hyperjump/json-pointer";
import { reduce } from "@hyperjump/pact";
import { resolveIri } from "@hyperjump/uri";
import * as JsonNode from "./json-node.js";
import { getSchemaResource } from "./features/schema-registry.js";
import { toAbsoluteUri, uriFragment } from "./util.js";


// eslint-disable-next-line import/export
export const cons = (uri, pointer, value, type, children, parent, offset, textLength, dialectUri, anchors) => {
  const node = JsonNode.cons(uri, pointer, value, type, children, parent, offset, textLength);
  node.dialectUri = dialectUri;
  node.anchors = anchors;

  return node;
};

// eslint-disable-next-line import/export
export const get = (uri, node) => {
  const schemaId = toAbsoluteUri(resolveIri(uri, node?.baseUri));
  const schemaResource = getSchemaResource(schemaId);
  if (!schemaResource) {
    return;
  }

  const fragment = uriFragment(uri);
  const pointer = fragment === "" || fragment[0] === "/" ? fragment : node.anchors[fragment];
  if (typeof pointer !== "string") {
    return;
  }

  return reduce((node, segment) => {
    segment = segment === "-" && JsonNode.typeOf(node) === "array" ? JsonNode.length(node) : segment;
    return JsonNode.step(segment, node);
  }, schemaResource, JsonPointer.pointerSegments(pointer));
};

// eslint-disable-next-line import/export
export * from "./json-node.js";
