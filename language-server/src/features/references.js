import * as SchemaDocument from "../schema-document.js";
import * as SchemaNode from "../schema-node.js";
import { getSchemaDocument, allSchemaDocuments } from "./schema-registry.js";
import { references } from "./validate-references.js";

/** @import { Feature } from "../build-server.js" */
/** @import { SchemaNode as SchemaNodeType } from "../schema-node.js" */

/** @type Feature */
export default {
  load(connection, documents) {
    const highlightBlockDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);
    const shouldHighlightBlock = (/** @type {string | undefined} */ uri) => {
      if (uri === undefined) {
        return false;
      }
      return highlightBlockDialects.has(uri);
    };

    connection.onReferences(async ({ textDocument, position }) => {
      const document = documents.get(textDocument.uri);
      if (!document) {
        return [];
      }

      const schemaDocument = await getSchemaDocument(connection, document);
      const offset = document.offsetAt(position);
      const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);

      if (!node) {
        return [];
      }

      const targetSchemaUri = SchemaNode.uri(node);
      const schemaReferences = [];

      for (const schemaDocument of allSchemaDocuments()) {
        for (const schemaResource of schemaDocument.schemaResources) {
          for (const referenceNode of references(schemaResource)) {
            const reference = SchemaNode.value(referenceNode);
            const referencedSchema = SchemaNode.get(reference, schemaResource);
            if (!referencedSchema) {
              continue;
            }

            if (SchemaNode.uri(referencedSchema) === targetSchemaUri) {
              const hightlightNode = /** @type SchemaNodeType */ (shouldHighlightBlock(referenceNode.dialectUri)
                ? referenceNode.parent?.parent
                : referenceNode);
              schemaReferences.push({
                uri: schemaDocument.textDocument.uri,
                range: {
                  start: schemaDocument.textDocument.positionAt(hightlightNode.offset),
                  end: schemaDocument.textDocument.positionAt(hightlightNode.offset + hightlightNode.textLength)
                }
              });
            }
          }
        }
      }

      return schemaReferences;
    });
  },

  onInitialize() {
    return {
      referencesProvider: true
    };
  },

  async onInitialized() {
  },

  onShutdown() {
  }
};
