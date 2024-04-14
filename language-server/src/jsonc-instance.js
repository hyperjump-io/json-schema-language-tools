import { findNodeAtOffset, parseTree, getNodePath, getNodeValue } from "jsonc-parser";
import * as JsonPointer from "@hyperjump/json-pointer";
import { getKeywordId } from "@hyperjump/json-schema/experimental";
import { find, some } from "@hyperjump/pact";
import { toAbsoluteUri, uriFragment } from "./util.js";


export class JsoncInstance {
  constructor(textDocument, root, node, pointer, annotations) {
    this.textDocument = textDocument;
    this.root = root;
    this.node = node;
    this.pointer = pointer;
    this.annotations = annotations;
  }

  static fromTextDocument(textDocument) {
    const json = textDocument.getText();
    const root = parseTree(json, [], {
      disallowComments: false,
      allowTrailingComma: true,
      allowEmptyContent: true
    });

    return new JsoncInstance(textDocument, root, root, "", {});
  }

  _fromNode(node, pointer) {
    return new JsoncInstance(this.textDocument, this.root, node, pointer, this.annotations);
  }

  asEmbedded() {
    const instance = new JsoncInstance(this.textDocument, this.node, this.node, "", {});

    const parent = this.node.parent;
    const index = parent.type === "property" ? 1 : parent.children.findIndex((node) => node === this.node);
    parent.children[index] = {
      type: "boolean",
      offset: this.node.offset,
      length: 0
    };
    delete this.node.parent;

    return instance;
  }

  uri() {
    return `#${this.pointer}`;
  }

  value() {
    if (this.node === undefined) {
      return undefined;
    } else {
      return getNodeValue(this.node);
    }
  }

  has(key) {
    return some((propertyName) => propertyName.value() === key, this.keys());
  }

  typeOf() {
    return this.node?.type ?? "undefined";
  }

  step(propertyName) {
    let node;

    if (this.typeOf() === "object") {
      const pair = find((pair) => getNodeValue(pair.children[0]) === propertyName, this.node.children);
      node = pair?.children[1];
    } else if (this.typeOf() === "array") {
      const index = parseInt(propertyName, 10);
      node = this.node.children[index];
    }

    const pointer = JsonPointer.append(propertyName, this.pointer);
    return this._fromNode(node, pointer);
  }

  * entries() {
    if (this.typeOf() !== "object") {
      return;
    }

    for (const propertyNode of this.node.children) {
      if (!propertyNode.children[1]) {
        continue;
      }
      const propertyName = propertyNode.children[0].value;
      const pointer = JsonPointer.append(propertyName, this.pointer);
      yield [
        this._fromNode(propertyNode.children[0], pointer),
        this._fromNode(propertyNode.children[1], pointer)
      ];
    }
  }

  * iter() {
    if (this.typeOf() !== "array") {
      return;
    }

    for (let itemIndex = 0; itemIndex < this.node.children.length; itemIndex++) {
      const itemNode = this.node.children[itemIndex];
      const pointer = JsonPointer.append(`${itemIndex}`, this.pointer);
      yield this._fromNode(itemNode, pointer);
    }
  }

  * keys() {
    if (this.typeOf() !== "object") {
      return;
    }

    for (const propertyNode of this.node.children) {
      const propertyNameNode = propertyNode.children[0];
      const pointer = JsonPointer.append(propertyNameNode.value, this.pointer);
      yield this._fromNode(propertyNameNode, pointer);
    }
  }

  * values() {
    if (this.typeOf() !== "object") {
      return;
    }

    for (const propertyNode of this.node.children) {
      const propertyName = propertyNode.children[0].value;
      const pointer = JsonPointer.append(propertyName, this.pointer);
      yield this._fromNode(propertyNode.children[1], pointer);
    }
  }

  length() {
    if (this.typeOf() !== "array") {
      return;
    }

    return this.node.children.length;
  }

  get(uri) {
    const schemaId = toAbsoluteUri(uri);
    if (schemaId !== "") {
      throw Error(`Not a local reference: ${uri}`);
    }

    const pointer = uriFragment(uri);
    const node = findNodeAtPointer(this.root, [...pointerSegments(pointer)]);
    return this._fromNode(node, node ? pointer : "");
  }

  annotation(keyword, dialectId = "https://json-schema.org/draft/2020-12/schema") {
    const keywordId = getKeywordId(keyword, dialectId);
    return this.annotations[this.pointer]?.[keywordId] || [];
  }

  annotate(keyword, value) {
    const instance = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    instance.annotations = {
      ...this.annotations,
      [this.pointer]: {
        ...this.annotations[this.pointer],
        [keyword]: [
          value,
          ...this.annotations[this.pointer]?.[keyword] || []
        ]
      }
    };

    return instance;
  }

  annotatedWith(keyword, dialectId = "https://json-schema.org/draft/2020-12/schema") {
    const instances = [];

    const keywordId = getKeywordId(keyword, dialectId);
    for (const instancePointer in this.annotations) {
      if (keywordId in this.annotations[instancePointer]) {
        instances.push(this.get(`#${instancePointer}`));
      }
    }

    return instances;
  }

  parent() {
    return this._fromNode(this.node.parent, this.pointer);
  }

  startPosition() {
    return this.textDocument.positionAt(this.node.offset);
  }

  endPosition() {
    return this.textDocument.positionAt(this.node.offset + this.node.length);
  }

  textLength() {
    return this.node.length;
  }

  getInstanceAtPosition(position) {
    const offset = this.textDocument.offsetAt(position);
    const node = findNodeAtOffset(this.root, offset);
    if (node && node.type !== "property") {
      const pathToNode = getNodePath(node);
      const pointer = pathToNode.reduce((pointer, segment) => JsonPointer.append(segment, pointer), "");
      return this._fromNode(node, pointer);
    } else {
      return this._fromNode(undefined, "");
    }
  }
}

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

const findNodeAtPointer = (root, path) => {
  let node = root;
  for (const segment of path) {
    if (!node) {
      return;
    }

    if (node.type === "object") {
      const propertyNode = node.children.find((propertyNode) => propertyNode.children[0].value === segment);
      node = propertyNode?.children[1];
    } else if (node.type === "array") {
      const index = parseInt(segment, 10);
      node = node.children[index];
    } else {
      return;
    }
  }

  return node;
};
