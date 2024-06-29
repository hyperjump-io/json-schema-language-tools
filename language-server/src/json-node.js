import * as JsonPointer from "@hyperjump/json-pointer";
import * as Instance from "@hyperjump/json-schema/annotated-instance/experimental";
import { getNodeValue } from "jsonc-parser";

/**
 * @import * as Type from "./json-node.js"
 * @import { Node } from "jsonc-parser"
 */


/** @type Type.fromJsonc */
export const fromJsonc = (node, uri = "", pointer = "", parent = undefined) => {
  const jsonNode = cons(uri, pointer, getNodeValue(node), node.type, [], parent, node.offset, node.length);

  switch (node.type) {
    case "array":
      jsonNode.children = node.children?.map((child, index) => {
        const itemPointer = JsonPointer.append(`${index}`, pointer);
        return fromJsonc(child, uri, itemPointer, jsonNode);
      }) ?? [];
      break;

    case "object":
      jsonNode.children = node.children?.map((child) => {
        const keyNode = /** @type Node */ (child.children?.[0]);
        const propertyPointer = JsonPointer.append(getNodeValue(keyNode), pointer);
        return fromJsonc(child, uri, propertyPointer, jsonNode);
      }) ?? [];
      break;

    case "property":
      jsonNode.children = node.children?.map((child) => {
        return fromJsonc(child, uri, pointer, jsonNode);
      }) ?? [];
      break;
  }

  return jsonNode;
};

/** @type Type.cons */
export const cons = (uri, pointer, value, type, children, parent, offset, textLength) => {
  const node = /** @type Type.JsonNode */ (Instance.cons(uri, pointer, value, type, children, parent));
  node.offset = offset;
  node.textLength = textLength;

  return node;
};

export {
  get, uri, value, typeOf, has, length,
  step, iter, keys, values, entries,
  allNodes,
  setAnnotation, annotation, annotatedWith
} from "@hyperjump/json-schema/annotated-instance/experimental";

