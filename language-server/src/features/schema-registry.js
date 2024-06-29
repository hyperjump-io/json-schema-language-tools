import { getDocumentSettings } from "./document-settings.js";
import * as SchemaDocument from "../schema-document.js";

/**
  * @import * as Type from "./schema-registry.js"
  * @import { Feature } from "../build-server.js"
  */

/** @type Feature */
export default {
  load(_connection, documents) {
    documents.onDidClose(({ document }) => {
      schemaDocuments.delete(document.uri);
    });
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  }
};

const schemaDocuments = new Map();

/** @type Type.getSchemaDocument */
export const getSchemaDocument = async (connection, textDocument) => {
  let { version, schemaDocument } = schemaDocuments.get(textDocument.uri) ?? {};

  if (version === -1 || version !== textDocument.version) {
    const settings = await getDocumentSettings(connection, textDocument.uri);
    schemaDocument = await SchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);

    schemaDocuments.set(textDocument.uri, { version: textDocument.version, schemaDocument });
  }

  return schemaDocument;
};

/** @type Type.clearSchemaDocuments */
export const clearSchemaDocuments = () => schemaDocuments.clear();

/** @type Type.allSchemaDocuments */
export const allSchemaDocuments = function* () {
  for (const { schemaDocument } of schemaDocuments.values()) {
    yield schemaDocument;
  }
};

/** @type Type.getSchemaResource */
export const getSchemaResource = (schemaUri) => {
  for (const schemaDocument of allSchemaDocuments()) {
    for (const schemaResource of schemaDocument.schemaResources) {
      if (schemaResource.baseUri === schemaUri) {
        return schemaResource;
      }
    }
  }
};
