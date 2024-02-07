import Parser from "tree-sitter";
import Json from "tree-sitter-json";
import * as JsonPointer from "@hyperjump/json-pointer";
import { getKeywordId } from "@hyperjump/json-schema/experimental";
import { count, drop, find, head, some } from "@hyperjump/pact";
import { toAbsoluteUri } from "./util.js";


export const parser = new Parser();
parser.setLanguage(Json);

export class TreeSitterInstance {
  constructor(tree, node = undefined, pointer = undefined, annotations = undefined) {
    this.tree = tree;
    this.node = node ?? tree.rootNode.firstChild;
    this.pointer = pointer ?? "";
    this.annotations = annotations ?? {};
  }

  static fromJson(json) {
    const tree = parser.parse(json);
    return new TreeSitterInstance(tree);
  }

  uri() {
    return this;
  }

  value() {
    return JSON.parse(this.node.text);
  }

  has(key) {
    return some((propertyName) => propertyName.value() === key, this.keys());
  }

  typeOf() {
    switch (this.node.type) {
      case "true":
      case "false":
        return "boolean";
      default:
        return this.node.type;
    }
  }

  * entries() {
    if (this.node.type !== "object") {
      return;
    }

    for (const child of this.node.children) {
      const pairNode = child.type === "ERROR" ? child.firstChild : child;

      if (pairNode.type === "pair") {
        const propertyName = JSON.parse(pairNode.firstChild.text);
        const pointer = JsonPointer.append(propertyName, this.pointer);
        yield [
          new TreeSitterInstance(this.tree, pairNode.child(0), pointer, this.annotations),
          new TreeSitterInstance(this.tree, pairNode.child(2), pointer, this.annotations)
        ];
      }
    }
  }

  * iter() {
    if (this.node.type !== "array") {
      return;
    }

    let index = 0;
    for (let childIndex = 1; this.node.child(childIndex); childIndex++) {
      const child = this.node.child(childIndex);
      if (child.type === "," || child.type === "]") {
        continue;
      }
      const pointer = JsonPointer.append(`${index++}`, this.pointer);
      yield new TreeSitterInstance(this.tree, child.type === "ERROR" ? child.firstChild : child, pointer, this.annotations);
    }
  }

  * keys() {
    if (this.node.type !== "object") {
      return;
    }

    for (const child of this.node.children) {
      const pairNode = child.type === "ERROR" ? child.firstChild : child;

      if (pairNode.type === "pair") {
        const propertyName = JSON.parse(pairNode.firstChild.text);
        const pointer = JsonPointer.append(propertyName, this.pointer);
        yield new TreeSitterInstance(this.tree, pairNode.firstChild, pointer, this.annotations);
      }
    }
  }

  * values() {
    if (this.node.type !== "object") {
      return;
    }

    for (const child of this.node.children) {
      const pairNode = child.type === "ERROR" ? child.firstChild : child;

      if (pairNode.type === "pair") {
        const propertyName = JSON.parse(pairNode.firstChild.text);
        const pointer = JsonPointer.append(propertyName, this.pointer);
        yield new TreeSitterInstance(this.tree, pairNode.child(2), pointer, this.annotations);
      }
    }
  }

  length() {
    return count(this.iter());
  }

  get(uri = "") {
    if (uri[0] !== "#") {
      throw Error(`No JSON document found at '${toAbsoluteUri(uri)}'`);
    }
    let result = new TreeSitterInstance(this.tree, this.tree.rootNode.firstChild, "", this.annotations);

    const pointer = decodeURI(uri.substring(1));
    for (const segment of pointerSegments(pointer)) {
      if (!result) {
        break;
      }

      if (result.typeOf() === "object") {
        const pair = find(([propertyName]) => propertyName.value() === segment, result.entries());
        result = pair?.[1];
      } else if (result.typeOf() === "array") {
        result = head(drop(parseInt(segment, 10), result.iter()));
      } else {
        result = undefined;
      }
    }

    return result;
  }

  annotation(keyword, dialectId = "https://json-schema.org/validation") {
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

  annotatedWith(keyword, dialectId = "https://json-schema.org/validation") {
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
    const instance = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    instance.node = instance.node.parent;

    return instance;
  }

  startPosition() {
    return {
      line: this.node.startPosition.row,
      character: this.node.startPosition.column
    };
  }

  endPosition() {
    return {
      line: this.node.endPosition.row,
      character: this.node.endPosition.column
    };
  }

  textLength() {
    return this.node.text.length;
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
