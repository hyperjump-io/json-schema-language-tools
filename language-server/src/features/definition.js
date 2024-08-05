import { some } from "@hyperjump/pact";
import * as SchemaDocument from "../schema-document.js";
import * as SchemaNode from "../schema-node.js";
import { getSchemaDocument, getSchemaDocumentBySchemaUri } from "./schema-registry.js";
import { keywordNameFor } from "../util.js";

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

    /** @type (node: SchemaNodeType) => boolean */
    const isReference = (node) => {
      if (!node.dialectUri) {
        return false;
      }

      if (highlightBlockDialects.has(node.dialectUri)) {
        // Legacy reference
        const legacyRefToken = keywordNameFor("https://json-schema.org/keyword/draft-04/ref", node.dialectUri);
        if (!node.parent || !node.parent.parent) {
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
        const keyword = SchemaNode.value(node.parent?.children[0]);
        return keyword === refToken;
      }
    };

    connection.onDefinition(async ({ textDocument, position }) => {
      const document = documents.get(textDocument.uri);
      if (!document) {
        return [];
      }

      const schemaDocument = await getSchemaDocument(connection, document);
      const offset = document.offsetAt(position);
      const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);

      if (!node || !isReference(node)) {
        return [];
      }

      const reference = SchemaNode.value(node);
      const targetSchema = SchemaNode.get(reference, node);

      if (!targetSchema) {
        return [];
      }

      const targetSchemaDocument = getSchemaDocumentBySchemaUri(targetSchema.baseUri);
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
  },

  onInitialize() {
    return {
      definitionProvider: true
    };
  },

  async onInitialized() {
  },

  onShutdown() {
  }
};
