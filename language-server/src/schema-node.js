import * as JsonNode from "./json-node.js";


// eslint-disable-next-line import/export
export const cons = (uri, pointer, value, type, children, parent, offset, textLength, dialectUri, anchors) => {
  const node = JsonNode.cons(uri, pointer, value, type, children, parent, offset, textLength);
  node.dialectUri = dialectUri;
  node.anchors = anchors;

  return node;
};

// eslint-disable-next-line import/export
export * from "./json-node.js";
