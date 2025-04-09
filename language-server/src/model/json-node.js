import * as JsonPointer from "@hyperjump/json-pointer";
import * as Instance from "@hyperjump/json-schema/annotated-instance/experimental";
import { getNodeValue } from "jsonc-parser";

/**
 * @import { Node } from "jsonc-parser"
 * @import { Json } from "@hyperjump/json-pointer";
 */


/**
 * @typedef {{
 *   baseUri: string;
 *   pointer: string;
 *   type: JsonType;
 *   children: JsonNode[];
 *   parent?: JsonNode;
 *   root: JsonNode;
 *   valid: boolean;
 *   errors: Record<string, string>;
 *   annotations: Record<string, Record<string, unknown>>;
 *   offset: number;
 *   textLength: number;
 * }} JsonNode
 *
 * @typedef {"object" | "array" | "string" | "number" | "boolean" | "null" | "property"} JsonType
 */

/** @type (node: Node, uri?: string, pointer?: string, parent?: JsonNode) => JsonNode */
export const fromJsonc = (node, uri = "", pointer = "", parent = undefined) => {
  /** @type unknown */
  const value = getNodeValue(node);
  const jsonNode = cons(uri, pointer, /** @type Json */ (value), node.type, [], parent, node.offset, node.length);

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
        /** @type unknown */
        const key = getNodeValue(keyNode);
        const propertyPointer = JsonPointer.append(/** @type string */ (key), pointer);
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

/**
 * @type (
 *   baseUri: string,
 *   pointer: string,
 *   value: Json | undefined,
 *   type: JsonType,
 *   children: JsonNode[],
 *   parent: JsonNode | undefined,
 *   offset: number,
 *   textLength: number
 * ) => JsonNode;
 */
export const cons = (uri, pointer, value, type, children, parent, offset, textLength) => {
  const node = /** @type JsonNode */ (Instance.cons(uri, pointer, value, type, children, parent));
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
