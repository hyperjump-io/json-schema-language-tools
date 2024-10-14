import { some } from "@hyperjump/pact";
import * as SchemaDocument from "../model/schema-document.js";
import * as SchemaNode from "../model/schema-node.js";
import { keywordNameFor } from "../util/util.js";

/**
 * @import { Server } from "../services/server.js"
 * @import { Schemas } from "../services/schemas.js"
 * @import { SchemaNode as SchemaNodeType } from "../model/schema-node.js"
 */

export class GotoDefinitionFeature {
  /**
   * @param {Server} server
   * @param {Schemas} schemas
   */
  constructor(server, schemas) {
    server.onInitialize(() => {
      return {
        capabilities: {
          definitionProvider: true
        }
      };
    });

    const highlightBlockDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);

    /** @type (node: SchemaNodeType) => boolean */
    const isReference = (node) => {
      if (!node.dialectUri) {
        return false;
      }

      if (highlightBlockDialects.has(node.dialectUri)) {
        // Legacy reference
        const legacyRefToken = keywordNameFor("https://json-schema.org/keyword/draft-04/ref", node.dialectUri);
        if (!node.parent?.parent) {
          return false;
        }

        const referenceNode = node.parent.parent;
        return some((keywordNode) => SchemaNode.value(keywordNode) === legacyRefToken, SchemaNode.keys(referenceNode));
      } else {
        // Regular reference
        if (!node.parent) {
          return false;
        }

        const refToken = keywordNameFor("https://json-schema.org/keyword/ref", node.dialectUri);
        /** @type ReturnType<typeof SchemaNode.value<string>> */
        const keyword = SchemaNode.value(node.parent?.children[0]);
        return keyword === refToken;
      }
    };

    server.onDefinition(async ({ textDocument, position }) => {
      const schemaDocument = await schemas.get(textDocument.uri);
      if (!schemaDocument) {
        return [];
      }

      const offset = schemaDocument.textDocument.offsetAt(position);
      const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);

      if (!node || !isReference(node)) {
        return [];
      }

      /** @type ReturnType<typeof SchemaNode.value<string>> */
      const reference = SchemaNode.value(node);
      const targetSchema = schemas.getSchemaNode(reference, node);

      if (!targetSchema) {
        return [];
      }

      const targetSchemaDocument = schemas.getBySchemaUri(targetSchema.baseUri);
      if (!targetSchemaDocument) {
        return [];
      }

      const gotoDefinitions = [{
        uri: targetSchemaDocument.textDocument.uri,
        range: {
          start: targetSchemaDocument.textDocument.positionAt(targetSchema.offset),
          end: targetSchemaDocument.textDocument.positionAt(targetSchema.offset + targetSchema.textLength)
        }
      }];

      return gotoDefinitions;
    });
  }
}
