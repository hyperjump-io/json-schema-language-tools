import { getSchema, compile, interpret, getKeywordName, hasDialect, BASIC } from "@hyperjump/json-schema/experimental";
import * as JsonPointer from "@hyperjump/json-pointer";
import { resolveIri, toAbsoluteIri } from "@hyperjump/uri";
import { getNodeValue, parseTree } from "jsonc-parser";
import * as SchemaNode from "./schema-node.js";
import { uriFragment } from "./util.js";


const cons = (textDocument) => {
  return {
    textDocument: textDocument,
    schemaResources: [],
    errors: []
  };
};

export const fromTextDocument = async (textDocument, contextDialectUri) => {
  const document = cons(textDocument);

  const json = textDocument.getText();
  if (json) {
    const root = parseTree(json, [], {
      disallowComments: false,
      allowTrailingComma: true,
      allowEmptyContent: true
    });

    buildSchemaResources(document, root, textDocument.uri, contextDialectUri);

    for (const schemaResource of document.schemaResources) {
      if (!hasDialect(schemaResource.dialectUri)) {
        const $schema = SchemaNode.get("#/$schema", schemaResource);
        if ($schema && SchemaNode.typeOf($schema) === "string") {
          document.errors.push({
            keyword: "https://json-schema.org/keyword/schema",
            instanceNode: $schema,
            message: "Unknown dialect"
          });
        } else if (schemaResource.dialectUri) {
          document.errors.push({
            keyword: "https://json-schema.org/keyword/schema",
            instanceNode: schemaResource,
            message: "Unknown dialect"
          });
        } else {
          document.errors.push({
            keyword: "https://json-schema.org/keyword/schema",
            instanceNode: schemaResource,
            message: "No dialect"
          });
        }

        continue;
      }

      const schema = await getSchema(schemaResource.dialectUri);
      const compiled = await compile(schema);
      const output = interpret(compiled, schemaResource, BASIC);
      if (!output.valid) {
        for (const error of output.errors) {
          document.errors.push({
            keyword: error.keyword,
            keywordNode: await getSchema(error.absoluteKeywordLocation),
            instanceNode: SchemaNode.get(error.instanceLocation, schemaResource)
          });
        }
      }
    }
  }

  return document;
};

const buildSchemaResources = (document, node, uri = "", dialectUri = "", pointer = "", parent = undefined, anchors = {}) => {
  const schemaNode = SchemaNode.cons(uri, pointer, getNodeValue(node), node.type, [], parent, node.offset, node.length, dialectUri, anchors);

  switch (node.type) {
    case "array":
      schemaNode.children = node.children.map((child, index) => {
        const itemPointer = JsonPointer.append(index, pointer);
        return buildSchemaResources(document, child, uri, dialectUri, itemPointer, schemaNode, anchors);
      });
      break;

    case "object":
      if (pointer === "") {
        // Resource root
        const $schema = nodeStep(node, "$schema");
        if ($schema?.type === "string") {
          try {
            dialectUri = toAbsoluteIri(getNodeValue($schema));
            schemaNode.dialectUri = dialectUri;
          } catch (error) {
            // Ignore
          }
        }

        const idToken = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
        const $idNode = idToken && nodeStep(node, idToken);
        if ($idNode) {
          uri = toAbsoluteIri(resolveIri(getNodeValue($idNode), uri));
          schemaNode.baseUri = uri;
        }

        const legacyIdToken = keywordNameFor("https://json-schema.org/keyword/draft-04/id", dialectUri);
        const legacy$idNode = legacyIdToken && nodeStep(node, legacyIdToken);
        if (legacy$idNode?.type === "string") {
          const legacy$id = getNodeValue(legacy$idNode);
          if (legacy$id[0] !== "#") {
            uri = toAbsoluteIri(resolveIri(legacy$id, uri));
            schemaNode.baseUri = uri;
          }
        }
      } else {
        // Check for embedded schema
        const embeddedDialectUri = getEmbeddedDialectUri(node, dialectUri);
        if (embeddedDialectUri) {
          buildSchemaResources(document, node, uri, embeddedDialectUri);

          return SchemaNode.cons(uri, pointer, true, "boolean", [], parent, node.offset, node.length, dialectUri, anchors);
        }
      }

      const anchorToken = keywordNameFor("https://json-schema.org/keyword/anchor", dialectUri);
      const $anchorNode = anchorToken && nodeStep(node, anchorToken);
      if ($anchorNode) {
        const anchor = getNodeValue($anchorNode);
        anchors[anchor] = pointer;
      }

      const legacyAnchorToken = keywordNameFor("https://json-schema.org/keyword/draft-04/id", dialectUri);
      const legacyAnchorNode = legacyAnchorToken && nodeStep(node, legacyAnchorToken);
      if (legacyAnchorNode) {
        const anchor = getNodeValue(legacyAnchorNode);
        if (anchor[0] === "#") {
          anchors[uriFragment(anchor)] = pointer;
        }
      }

      for (const child of node.children) {
        const propertyPointer = JsonPointer.append(getNodeValue(child.children[0]), pointer);
        const propertyNode = buildSchemaResources(document, child, uri, dialectUri, propertyPointer, schemaNode, anchors);

        if (propertyNode) {
          schemaNode.children.push(propertyNode);
        }
      }
      break;

    case "property":
      if (node.children.length !== 2) {
        return;
      }

      schemaNode.children = node.children.map((child) => {
        return buildSchemaResources(document, child, uri, dialectUri, pointer, schemaNode, anchors);
      });
      break;
  }

  if (schemaNode.pointer === "") {
    document.schemaResources.push(schemaNode);
  }

  return schemaNode;
};

const getEmbeddedDialectUri = (node, dialectUri) => {
  const $schema = nodeStep(node, "$schema");
  if ($schema?.type === "string") {
    const embeddedDialectUri = toAbsoluteIri(getNodeValue($schema));
    if (!hasDialect(embeddedDialectUri)) {
      return embeddedDialectUri;
    } else {
      dialectUri = embeddedDialectUri;
    }
  }

  const idToken = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
  const $idNode = idToken && nodeStep(node, idToken);
  if ($idNode?.type === "string") {
    return dialectUri;
  }

  const legacyIdToken = keywordNameFor("https://json-schema.org/keyword/draft-04/id", dialectUri);
  const legacy$idNode = legacyIdToken && nodeStep(node, legacyIdToken);
  if (legacy$idNode?.type === "string" && getNodeValue(legacy$idNode)[0] !== "#") {
    return dialectUri;
  }
};

export const findNodeAtOffset = (document, offset) => {
  for (const schemaResource of document.schemaResources) {
    const node = _findNodeAtOffset(schemaResource, offset);
    if (node) {
      return node;
    }
  }
};

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

const contains = (node, offset, includeRightBound = false) => {
  return (offset >= node.offset && offset < (node.offset + node.textLength))
    || includeRightBound && (offset === (node.offset + node.textLength));
};

const nodeStep = (node, key) => {
  const property = node.children.find((property) => getNodeValue(property.children[0]) === key);
  return property?.children[1];
};

const keywordNameFor = (keywordUri, dialectUri) => {
  try {
    return getKeywordName(dialectUri, keywordUri);
  } catch (error) {
    return undefined;
  }
};
