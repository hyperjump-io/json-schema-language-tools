import * as JsonPointer from "@hyperjump/json-pointer";
import * as Instance from "@hyperjump/json-schema/annotated-instance/experimental";
import { getNodeValue } from "jsonc-parser";


export const fromJsonc = (node, uri = "", pointer = "", parent = undefined) => {
  const jsonNode = cons(uri, pointer, getNodeValue(node), node.type, [], parent, node.offset, node.length);

  switch (node.type) {
    case "array":
      jsonNode.children = node.children.map((child, index) => {
        const itemPointer = JsonPointer.append(index, pointer);
        return fromJsonc(child, uri, itemPointer, jsonNode);
      });
      break;

    case "object":
      jsonNode.children = node.children.map((child) => {
        const propertyPointer = JsonPointer.append(getNodeValue(child.children[0]), pointer);
        return fromJsonc(child, uri, propertyPointer, jsonNode);
      });
      break;

    case "property":
      jsonNode.children = node.children.map((child) => {
        return fromJsonc(child, uri, pointer, jsonNode);
      });
      break;
  }

  return jsonNode;
};

// eslint-disable-next-line import/export
export const cons = (uri, pointer, value, type, children, parent, offset, textLength) => {
  const node = Instance.cons(uri, pointer, value, type, children, parent);
  node.offset = offset;
  node.textLength = textLength;

  return node;
};

// eslint-disable-next-line import/export
export const annotation = (node, keyword, dialect = "https://json-schema.org/draft/2020-12/schema") => {
  return Instance.annotation(node, keyword, dialect);
};

export const findNodeAtOffset = (node, offset, includeRightBound = false) => {
  if (contains(node, offset, includeRightBound)) {
    for (let i = 0; i < node.children.length && node.children[i].offset <= offset; i++) {
      const item = findNodeAtOffset(node.children[i], offset, includeRightBound);
      if (item) {
        return item;
      }
    }

    return node;
  }
};

const contains = (node, offset, includeRightBound = false) => {
  return (offset >= node.offset && offset < (node.offset + node.textLength))
    || includeRightBound && (offset === (node.offset + node.textLength));
};

// eslint-disable-next-line import/export
export * from "@hyperjump/json-schema/annotated-instance/experimental";
