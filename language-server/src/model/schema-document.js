import { randomUUID } from "node:crypto";
import { hasDialect } from "@hyperjump/json-schema/experimental";
import * as JsonPointer from "@hyperjump/json-pointer";
import { getNodeValue, parseTree } from "jsonc-parser";
import * as SchemaNode from "./schema-node.js";
import { keywordNameFor, keywordIdFor, toAbsoluteUri, resolveIri } from "../util/util.js";

/**
 * @import { DiagnosticSeverity } from "vscode-languageserver";
 * @import { TextDocument } from "vscode-languageserver-textdocument"
 * @import { Node } from "jsonc-parser"
 * @import { Browser } from "@hyperjump/browser"
 * @import { SchemaDocument as SchemaDoc } from "@hyperjump/json-schema/experimental"
 * @import { Json } from "@hyperjump/json-pointer"
 * @import { SchemaNode as SchemaNodeType } from "./schema-node.js"
 */


/**
 * @typedef {{
 *   textDocument: TextDocument,
 *   schemaResources: SchemaNodeType[],
 *   errors: SchemaError[]
 * }} SchemaDocument
 *
 * @typedef {{
 *   keyword: string;
 *   keywordNode?: Browser<SchemaDoc>;
 *   instanceNode: SchemaNodeType;
 *   message?: string;
 *   severity?: DiagnosticSeverity;
 * }} SchemaError
 */

/** @type (textDocument: TextDocument) => SchemaDocument */
const cons = (textDocument) => {
  return {
    textDocument: textDocument,
    schemaResources: [],
    errors: []
  };
};

/** @type (textDocument: TextDocument, contextDialectUri?: string) => SchemaDocument */
export const fromTextDocument = (textDocument, contextDialectUri) => {
  const schemaDocument = cons(textDocument);

  const root = fromJson(textDocument.getText(), textDocument.uri, contextDialectUri);

  for (const schemaResource of Object.values(root?.embedded ?? {})) {
    schemaDocument.schemaResources.push(schemaResource);
  }

  return schemaDocument;
};

/** @type (json: string, retrievalUri: string, contextDialectUri?: string) => SchemaNodeType | undefined */
export const fromJson = (json, retrievalUri, contextDialectUri) => {
  const root = parseTree(json, [], {
    disallowComments: false,
    allowTrailingComma: true,
    allowEmptyContent: true
  });

  return root && fromJsonc(root, retrievalUri, "", contextDialectUri);
};

/**
 * @type (
 *   node: Node,
 *   uri: string,
 *   pointer: string,
 *   dialectUri?: string,
 *   parent?: SchemaNodeType,
 *   schemaLocations?: Set<string>,
 *   knownLocations?: Set<string>
 * ) => SchemaNodeType
 */
const fromJsonc = (node, uri, pointer, dialectUri, parent, schemaLocations = new Set([""]), knownLocations = new Set([""])) => {
  const isSchema = isValueNode(node) && schemaLocations.delete(pointer);
  const isKnown = isValueNode(node) && knownLocations.delete(pointer);

  if (node.type === "object" && (isSchema || !isKnown)) {
    let embeddedDialectUri = dialectUri;
    const $schemaNode = nodeStep(node, "$schema");
    if ($schemaNode && $schemaNode.type === "string") {
      try {
        /** @type unknown */
        const value = getNodeValue($schemaNode);
        embeddedDialectUri = toAbsoluteUri(/** @type string */ (value));
      } catch (_error) {
        // Ignore for now
      }
    }

    const idToken = keywordNameFor("https://json-schema.org/keyword/id", embeddedDialectUri ?? "")
      ?? keywordNameFor("https://json-schema.org/keyword/draft-04/id", embeddedDialectUri ?? "");
    const $idNode = idToken && nodeStep(node, idToken);
    if ($idNode && $idNode.type === "string") {
      /** @type unknown */
      const $id = getNodeValue($idNode);
      uri = toAbsoluteUri(resolveIri(/** @type string */ ($id), uri));
      pointer = "";
      dialectUri = embeddedDialectUri;
    } else if (!parent) {
      dialectUri = embeddedDialectUri;
    } else if (embeddedDialectUri && !hasDialect(embeddedDialectUri)) {
      uri = `urn:uuid:${randomUUID()}`;
      pointer = "";
      dialectUri = embeddedDialectUri;
    }
  }

  /** @type unknown */
  const value = getNodeValue(node);
  const schemaNode = SchemaNode.cons(uri, pointer, /** @type Json */ (value), node.type, parent, node.offset, node.length, dialectUri);
  if (isSchema) {
    schemaNode.isSchema = isSchema;
  }

  switch (node.type) {
    case "array": {
      let index = 0;
      for (const childNode of node.children ?? []) {
        const itemPointer = JsonPointer.append(`${index++}`, pointer);
        const childSchemaNode = fromJsonc(childNode, uri, itemPointer, dialectUri, schemaNode, schemaLocations, knownLocations);
        schemaNode.children.push(childSchemaNode);
      }
      break;
    }

    case "object": {
      for (const childNode of node.children ?? []) {
        const keywordNode = /** @type Node */ (childNode.children?.[0]);
        /** @type unknown */
        const keyword = getNodeValue(keywordNode);
        const propertyPointer = JsonPointer.append(/** @type string */ (keyword), pointer);
        const childSchemaNode = fromJsonc(childNode, uri, propertyPointer, dialectUri, schemaNode, schemaLocations, knownLocations);
        if (childSchemaNode.pointer !== "") {
          schemaNode.children.push(childSchemaNode);
        }
      }
      break;
    }

    case "property": {
      let propertyKeywordUri;
      if (schemaNode.parent?.isSchema) {
        const keywordNode = /** @type Node */ (node.children?.[0]);
        /** @type unknown */
        const keyword = getNodeValue(keywordNode);
        propertyKeywordUri = dialectUri && keywordIdFor(/** @type string */ (keyword), dialectUri);

        if (propertyKeywordUri && !propertyKeywordUri?.startsWith("https://json-schema.org/keyword/unknown#")) {
          const valueNode = node.children?.[1];
          if (valueNode) {
            keywordHandlers[propertyKeywordUri]?.(valueNode, pointer, schemaLocations, knownLocations);
          }
        }
      }

      for (const childNode of node.children ?? []) {
        const childSchemaNode = fromJsonc(childNode, uri, pointer, dialectUri, schemaNode, schemaLocations, knownLocations);
        childSchemaNode.keywordUri = propertyKeywordUri;
        if (childSchemaNode.pointer !== "") {
          schemaNode.children.push(childSchemaNode);
        } else {
          schemaNode.isEmbeddedSchema = true;
        }
      }
      break;
    }
  }

  return schemaNode;
};

/** @type (node: Node) => boolean */
const isValueNode = (node) => {
  return node.type !== "property" && (node.parent?.type !== "property" || node.parent?.children?.[0] !== node);
};

/** @type (document: SchemaDocument, offset: number) => SchemaNodeType | undefined */
export const findNodeAtOffset = (document, offset) => {
  for (const schemaResource of document.schemaResources) {
    const node = _findNodeAtOffset(schemaResource, offset);
    if (node && !node.isEmbeddedSchema) {
      return node;
    }
  }
};

/** @type (node: SchemaNodeType, offset: number, includeRightBound?: boolean) => SchemaNodeType | undefined */
const _findNodeAtOffset = (node, offset, includeRightBound = false) => {
  if (contains(node, offset, includeRightBound)) {
    for (let i = 0; i < node.children.length && node.children[i].offset <= offset; i++) {
      const item = _findNodeAtOffset(node.children[i], offset, includeRightBound);
      if (item) {
        return item;
      }
    }

    return node;
  }
};

/** @type (node: SchemaNodeType, offset: number, includeRightBound?: boolean) => boolean */
const contains = (node, offset, includeRightBound = false) => {
  return (offset >= node.offset && offset < (node.offset + node.textLength))
    || includeRightBound && (offset === (node.offset + node.textLength));
};

/** @type (node: Node, key: string) => Node | undefined */
const nodeStep = (node, key) => {
  const property = node.children?.find((property) => {
    const keyNode = property.children?.[0];
    return keyNode && getNodeValue(keyNode) === key;
  });
  return property?.children?.[1];
};

/** @type (node: Node, pointer: string) => Generator<string> */
const nodeLocations = function* (node, pointer) {
  yield pointer;

  if (node.type === "object") {
    for (const propertyNode of node.children ?? []) {
      const [keyNode, valueNode] = propertyNode.children ?? [];
      /** @type unknown */
      const property = getNodeValue(keyNode);
      const propertyPointer = JsonPointer.append(/** @type string */ (property), pointer);

      if (valueNode) {
        yield* nodeLocations(valueNode, propertyPointer);
      }
    }
  } else if (node.type === "array") {
    let index = 0;
    for (const itemNode of node.children ?? []) {
      const itemPointer = JsonPointer.append(`${index++}`, pointer);

      yield* nodeLocations(itemNode, itemPointer);
    }
  }
};

/** @typedef {(node: Node, pointer: string, schemaLocations: Set<string>, knownLocations: Set<string>) => void} KeywordHandler */

/** @type KeywordHandler */
const knownKeywordHandler = (node, pointer, _schemaLocations, knownLocations) => {
  for (const location of nodeLocations(node, pointer)) {
    knownLocations.add(location);
  }
};

/** @type KeywordHandler */
const schemaKeywordHandler = (_node, pointer, schemaLocations) => {
  schemaLocations.add(pointer);
};

/** @type KeywordHandler */
const schemaArrayKeywordHandler = (node, pointer, schemaLocations, knownLocations) => {
  if (node.type !== "array" || !node.children) {
    knownKeywordHandler(node, pointer, schemaLocations, knownLocations);
    return;
  }

  knownLocations.add(pointer);
  for (let index = 0; index < node.children.length; index++) {
    const itemPointer = JsonPointer.append(`${index}`, pointer);
    schemaLocations.add(itemPointer);
  }
};

/** @type KeywordHandler */
const schemaObjectKeywordHandler = (node, pointer, schemaLocations, knownLocations) => {
  if (node.type !== "object") {
    knownKeywordHandler(node, pointer, schemaLocations, knownLocations);
    return;
  }

  knownLocations.add(pointer);
  for (const childNode of node.children ?? []) {
    const propertyNode = /** @type Node */ (childNode.children?.[0]);
    /** @type unknown */
    const property = getNodeValue(propertyNode);
    const propertyPointer = JsonPointer.append(/** @type string */ (property), pointer);
    schemaLocations.add(propertyPointer);
  }
};

/** @type KeywordHandler */
const schemaOrSchemaArrayKeywordHandler = (node, pointer, schemaLocations, knownLocations) => {
  switch (node.type) {
    case "object":
    case "boolean":
      schemaKeywordHandler(node, pointer, schemaLocations, knownLocations);
      break;
    case "array":
      schemaArrayKeywordHandler(node, pointer, schemaLocations, knownLocations);
      break;
    default:
      knownKeywordHandler(node, pointer, schemaLocations, knownLocations);
  }
};

/** @type KeywordHandler */
const schemaObjectObjectKeywordHandler = (node, pointer, schemaLocations, knownLocations) => {
  if (node.type !== "object") {
    knownKeywordHandler(node, pointer, schemaLocations, knownLocations);
    return;
  }

  knownLocations.add(pointer);
  for (const childNode of node.children ?? []) {
    const propertyNameNode = /** @type Node */ (childNode.children?.[0]);
    /** @type unknown */
    const property = getNodeValue(propertyNameNode);
    let propertyPointer = JsonPointer.append(/** @type string */ (property), pointer);

    const propertyValueNode = /** @type Node */ (childNode.children?.[1]);
    if (propertyValueNode?.type !== "object") {
      knownKeywordHandler(node, propertyPointer, schemaLocations, knownLocations);
      continue;
    }

    knownLocations.add(propertyPointer);
    for (const childNode of node.children ?? []) {
      const propertyNode = /** @type Node */ (childNode.children?.[0]);
      /** @type unknown */
      const property = getNodeValue(propertyNode);
      propertyPointer = JsonPointer.append(/** @type string */ (property), propertyPointer);
      schemaLocations.add(propertyPointer);
    }
  }
};

/** @type Record<string, KeywordHandler> */
const keywordHandlers = {
  "https://json-schema.org/keyword/additionalProperties": schemaKeywordHandler,
  "https://json-schema.org/keyword/allOf": schemaArrayKeywordHandler,
  "https://json-schema.org/keyword/anchor": knownKeywordHandler,
  "https://json-schema.org/keyword/anyOf": schemaArrayKeywordHandler,
  "https://json-schema.org/keyword/conditional": schemaArrayKeywordHandler,
  "https://json-schema.org/keyword/const": knownKeywordHandler,
  "https://json-schema.org/keyword/contains": schemaKeywordHandler,
  "https://json-schema.org/keyword/comment": knownKeywordHandler,
  "https://json-schema.org/keyword/contentEncoding": knownKeywordHandler,
  "https://json-schema.org/keyword/contentMediaType": knownKeywordHandler,
  "https://json-schema.org/keyword/contentSchema": schemaKeywordHandler,
  "https://json-schema.org/keyword/default": knownKeywordHandler,
  "https://json-schema.org/keyword/definitions": schemaObjectKeywordHandler,
  "https://json-schema.org/keyword/dependentRequired": knownKeywordHandler,
  "https://json-schema.org/keyword/dependentSchemas": schemaObjectKeywordHandler,
  "https://json-schema.org/keyword/deprecated": knownKeywordHandler,
  "https://json-schema.org/keyword/description": knownKeywordHandler,
  "https://json-schema.org/keyword/dynamicAnchor": knownKeywordHandler,
  "https://json-schema.org/keyword/dynamicRef": knownKeywordHandler,
  "https://json-schema.org/keyword/else": schemaKeywordHandler,
  "https://json-schema.org/keyword/enum": knownKeywordHandler,
  "https://json-schema.org/keyword/examples": knownKeywordHandler,
  "https://json-schema.org/keyword/exclusiveMaximum": knownKeywordHandler,
  "https://json-schema.org/keyword/exclusiveMinimum": knownKeywordHandler,
  "https://json-schema.org/keyword/format": knownKeywordHandler,
  "https://json-schema.org/keyword/format-assertion": knownKeywordHandler,
  "https://json-schema.org/keyword/id": knownKeywordHandler,
  "https://json-schema.org/keyword/if": schemaKeywordHandler,
  "https://json-schema.org/keyword/itemPattern": schemaArrayKeywordHandler,
  "https://json-schema.org/keyword/items": schemaKeywordHandler,
  "https://json-schema.org/keyword/maxContains": knownKeywordHandler,
  "https://json-schema.org/keyword/maxItems": knownKeywordHandler,
  "https://json-schema.org/keyword/maxLength": knownKeywordHandler,
  "https://json-schema.org/keyword/maxProperties": knownKeywordHandler,
  "https://json-schema.org/keyword/maximum": knownKeywordHandler,
  "https://json-schema.org/keyword/minContains": knownKeywordHandler,
  "https://json-schema.org/keyword/minItems": knownKeywordHandler,
  "https://json-schema.org/keyword/minLength": knownKeywordHandler,
  "https://json-schema.org/keyword/minProperties": knownKeywordHandler,
  "https://json-schema.org/keyword/minimum": knownKeywordHandler,
  "https://json-schema.org/keyword/multipleOf": knownKeywordHandler,
  "https://json-schema.org/keyword/not": schemaKeywordHandler,
  "https://json-schema.org/keyword/oneOf": schemaArrayKeywordHandler,
  "https://json-schema.org/keyword/pattern": knownKeywordHandler,
  "https://json-schema.org/keyword/patternProperties": schemaObjectKeywordHandler,
  "https://json-schema.org/keyword/prefixItems": schemaArrayKeywordHandler,
  "https://json-schema.org/keyword/properties": schemaObjectKeywordHandler,
  "https://json-schema.org/keyword/propertyDependencies": schemaObjectObjectKeywordHandler,
  "https://json-schema.org/keyword/propertyNames": schemaKeywordHandler,
  "https://json-schema.org/keyword/readOnly": knownKeywordHandler,
  "https://json-schema.org/keyword/ref": knownKeywordHandler,
  "https://json-schema.org/keyword/requireAllExcept": knownKeywordHandler,
  "https://json-schema.org/keyword/required": knownKeywordHandler,
  "https://json-schema.org/keyword/title": knownKeywordHandler,
  "https://json-schema.org/keyword/then": schemaKeywordHandler,
  "https://json-schema.org/keyword/type": knownKeywordHandler,
  "https://json-schema.org/keyword/unevaluatedItems": schemaKeywordHandler,
  "https://json-schema.org/keyword/unevaluatedProperties": schemaKeywordHandler,
  "https://json-schema.org/keyword/uniqueItems": knownKeywordHandler,
  "https://json-schema.org/keyword/vocabulary": knownKeywordHandler,
  "https://json-schema.org/keyword/writeOnly": knownKeywordHandler,

  // Draft-04
  "https://json-schema.org/keyword/draft-04/id": knownKeywordHandler,
  "https://json-schema.org/keyword/draft-04/ref": knownKeywordHandler,
  "https://json-schema.org/keyword/draft-04/additionalItems": schemaKeywordHandler,
  "https://json-schema.org/keyword/draft-04/dependencies": schemaObjectKeywordHandler,
  "https://json-schema.org/keyword/draft-04/exclusiveMaximum": knownKeywordHandler,
  "https://json-schema.org/keyword/draft-04/exclusiveMinimum": knownKeywordHandler,
  "https://json-schema.org/keyword/draft-04/items": schemaOrSchemaArrayKeywordHandler,
  "https://json-schema.org/keyword/draft-04/maximum": knownKeywordHandler,
  "https://json-schema.org/keyword/draft-04/minimum": knownKeywordHandler,

  // Draft-06
  "https://json-schema.org/keyword/draft-06/contains": schemaKeywordHandler,

  // Draft-7

  // Draft 2019-09
  "https://json-schema.org/keyword/draft-2019-09/recursiveAnchor": knownKeywordHandler,

  // Draft 2020-12
  "https://json-schema.org/keyword/draft-2020-12/dynamicAnchor": knownKeywordHandler,
  "https://json-schema.org/keyword/draft-2020-12/dynamicRef": knownKeywordHandler
};
