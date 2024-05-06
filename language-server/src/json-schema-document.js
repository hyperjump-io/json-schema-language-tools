import { getSchema, compile, interpret, getKeywordName, hasDialect, BASIC } from "@hyperjump/json-schema/experimental";
import * as JsonPointer from "@hyperjump/json-pointer";
import { resolveIri, toAbsoluteIri } from "@hyperjump/uri";
import { getNodeValue, parseTree } from "jsonc-parser";
import * as Instance from "./json-instance.js";


export class JsonSchemaDocument {
  constructor(textDocument) {
    this.textDocument = textDocument;
    this.schemaResources = [];
    this.errors = [];
  }

  static async fromTextDocument(textDocument, contextDialectUri) {
    const document = new JsonSchemaDocument(textDocument);

    const json = textDocument.getText();
    if (json) {
      const root = parseTree(json, [], {
        disallowComments: false,
        allowTrailingComma: true,
        allowEmptyContent: true
      });

      document.#buildSchemaResources(root, textDocument.uri, contextDialectUri);

      for (const { dialectUri, schemaResource } of document.schemaResources) {
        if (!hasDialect(dialectUri)) {
          const $schema = Instance.get("#/$schema", schemaResource);
          if ($schema && Instance.typeOf($schema) === "string") {
            document.errors.push({
              keyword: "https://json-schema.org/keyword/schema",
              instanceNode: $schema,
              message: "Unknown dialect"
            });
          } else if (dialectUri) {
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

        const schema = await getSchema(dialectUri);
        const compiled = await compile(schema);
        const output = interpret(compiled, schemaResource, BASIC);
        if (!output.valid) {
          for (const error of output.errors) {
            document.errors.push({
              keyword: error.keyword,
              keywordNode: await getSchema(error.absoluteKeywordLocation),
              instanceNode: Instance.get(error.instanceLocation, schemaResource)
            });
          }
        }
      }
    }

    return document;
  }

  #buildSchemaResources(node, uri = "", dialectUri = "", pointer = "", parent = undefined) {
    const jsonNode = Instance.cons(uri, pointer, getNodeValue(node), node.type, [], parent, node.offset, node.length);

    switch (node.type) {
      case "array":
        jsonNode.children = node.children.map((child, index) => {
          const itemPointer = JsonPointer.append(index, pointer);
          return this.#buildSchemaResources(child, uri, dialectUri, itemPointer, jsonNode);
        });
        break;

      case "object":
        if (pointer === "") {
          // Resource root
          const $schema = nodeStep(node, "$schema");
          if ($schema?.type === "string") {
            try {
              dialectUri = toAbsoluteIri(getNodeValue($schema));
            } catch (error) {
              // Ignore
            }
          }

          const idToken = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
          const $idNode = idToken && nodeStep(node, idToken);
          if ($idNode) {
            uri = toAbsoluteIri(resolveIri(getNodeValue($idNode), uri));
            jsonNode.baseUri = uri;
          }

          const legacyIdToken = keywordNameFor("https://json-schema.org/keyword/draft-04/id", dialectUri);
          const legacy$idNode = legacyIdToken && nodeStep(node, legacyIdToken);
          if (legacy$idNode?.type === "string") {
            const legacy$id = getNodeValue(legacy$idNode);
            if (legacy$id[0] !== "#") {
              uri = toAbsoluteIri(resolveIri(legacy$id, uri));
              jsonNode.baseUri = uri;
            }
          }
        } else {
          // Check for embedded schema
          const embeddedDialectUri = getEmbeddedDialectUri(node, dialectUri);
          if (embeddedDialectUri) {
            this.#buildSchemaResources(node, uri, embeddedDialectUri);

            return Instance.cons(uri, pointer, true, "boolean", [], parent, node.offset, node.length);
          }
        }

        for (const child of node.children) {
          const propertyPointer = JsonPointer.append(getNodeValue(child.children[0]), pointer);
          const propertyNode = this.#buildSchemaResources(child, uri, dialectUri, propertyPointer, jsonNode);

          if (propertyNode) {
            jsonNode.children.push(propertyNode);
          }
        }
        break;

      case "property":
        if (node.children.length !== 2) {
          return;
        }

        jsonNode.children = node.children.map((child) => {
          return this.#buildSchemaResources(child, uri, dialectUri, pointer, jsonNode);
        });
        break;
    }

    if (jsonNode.pointer === "") {
      this.schemaResources.push({ dialectUri, schemaResource: jsonNode });
    }

    return jsonNode;
  }

  * annotatedWith(keyword, dialectId = "https://json-schema.org/draft/2020-12/schema") {
    for (const { schemaResource } of this.schemaResources) {
      for (const node of Instance.allNodes(schemaResource)) {
        if (Instance.annotation(node, keyword, dialectId).length > 0) {
          yield node;
        }
      }
    }
  }

  findNodeAtOffset(offset) {
    for (const { schemaResource } of this.schemaResources) {
      const node = Instance.findNodeAtOffset(schemaResource, offset);
      if (node) {
        return node;
      }
    }
  }
}

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
