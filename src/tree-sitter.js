import Parser from "tree-sitter";
import Json from "tree-sitter-json";
import { find, pipe } from "@hyperjump/pact";


export const parser = new Parser();
parser.setLanguage(Json);

export const entries = function* (node) {
  if (node.type !== "object") {
    return;
  }

  for (const child of node.children) {
    const pairNode = child.type === "ERROR" ? child.firstChild : child;

    if (pairNode.type === "pair") {
      yield [
        pairNode.child(0),
        pairNode.child(2)
      ];
    }
  }
};

export const iter = function* (node) {
  if (node.type !== "array") {
    return;
  }

  for (const child of node.children) {
    yield child.type === "ERROR" ? child.firstChild : child;
  }
};

export const values = function* (node) {
  if (node.type !== "object") {
    return;
  }

  for (const child of node.children) {
    const pairNode = child.type === "ERROR" ? child.firstChild : child;

    if (pairNode.type === "pair") {
      yield pairNode.child(2);
    }
  }
};

export const getNode = (tree, pointer = "") => {
  let node = tree.rootNode.firstChild;

  for (const segment of pointerSegments(pointer)) {
    if (node.type === "object") {
      const pair = pipe(
        entries(node),
        find(([propertyName]) => propertyName === segment)
      );

      return pair?.[1];
    } else if (node.type === "array") {
      node = node.child(parseInt(segment, 10) * 2 + 1);
    } else {
      return;
    }
  }

  return node;
};

const pointerSegments = function* (pointer) {
  if (pointer.length > 0 && pointer[0] !== "/") {
    throw Error(`Invalid JSON Pointer: '${pointer}'`);
  }

  let segmentStart = 1;
  let segmentEnd = 0;

  while (segmentEnd < pointer.length) {
    const position = pointer.indexOf("/", segmentStart);
    segmentEnd = position === -1 ? pointer.length : position;
    const segment = pointer.slice(segmentStart, segmentEnd);
    segmentStart = segmentEnd + 1;

    yield segment.toString().replace(/~1/g, "/").replace(/~0/g, "~");
  }
};
