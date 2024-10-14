import * as SchemaDocument from "../model/schema-document.js";
import * as SchemaNode from "../model/schema-node.js";

/**
 * @import { Server } from "../services/server.js"
 * @import { Schemas } from "../services/schemas.js"
 * @import { SchemaNode as SchemaNodeType } from "../model/schema-node.js"
 */


export class FindReferencesFeature {
  /**
   * @param {Server} server
   * @param {Schemas} schemas
   */
  constructor(server, schemas) {
    server.onInitialize(() => {
      return {
        capabilities: {
          referencesProvider: true
        }
      };
    });

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

    server.onReferences(async ({ textDocument, position }) => {
      const schemaDocument = await schemas.getOpen(textDocument.uri);
      if (!schemaDocument) {
        return [];
      }

      const offset = schemaDocument.textDocument.offsetAt(position);
      const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);

      if (!node) {
        return [];
      }

      const targetSchemaUri = SchemaNode.uri(node);
      const schemaReferences = [];

      for await (const schemaDocument of schemas.all()) {
        for (const schemaResource of schemaDocument.schemaResources) {
          for (const referenceNode of schemas.references(schemaResource)) {
            /** @type ReturnType<typeof SchemaNode.value<string>> */
            const reference = SchemaNode.value(referenceNode);
            const referencedSchema = schemas.getSchemaNode(reference, schemaResource);
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
  }
}
