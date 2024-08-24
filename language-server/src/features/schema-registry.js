import { getDocumentSettings } from "./document-settings.js";
import * as SchemaDocument from "../schema-document.js";

/**
 * @import { Connection } from "vscode-languageserver"
 * @import { TextDocument } from "vscode-languageserver-textdocument"
 * @import { Feature } from "../build-server.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../schema-document.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
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
  },

  onShutdown() {
    clearSchemaDocuments();
  }
};

const schemaDocuments = new Map();

/** @type (connection: Connection, textDocument: TextDocument) => Promise<SchemaDocumentType> */
export const getSchemaDocument = async (connection, textDocument) => {
  let { version, schemaDocument } = schemaDocuments.get(textDocument.uri) ?? {};

  if (version === -1 || version !== textDocument.version) {
    const settings = await getDocumentSettings(connection, textDocument.uri);
    schemaDocument = await SchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);

    schemaDocuments.set(textDocument.uri, { version: textDocument.version, schemaDocument });
  }

  return schemaDocument;
};

export const clearSchemaDocuments = () => {
  schemaDocuments.clear();
};

export const allSchemaDocuments = function* () {
  for (const { schemaDocument } of schemaDocuments.values()) {
    yield schemaDocument;
  }
};

/** @type (schemaUri: string) => SchemaNodeType | undefined */
export const getSchemaResource = (schemaUri) => {
  for (const schemaDocument of allSchemaDocuments()) {
    for (const schemaResource of schemaDocument.schemaResources) {
      if (schemaResource.baseUri === schemaUri) {
        return schemaResource;
      }
    }
  }
};

/** @type (schemaUri: string) => SchemaDocumentType | undefined */
export const getSchemaDocumentBySchemaUri = (schemaUri) => {
  for (const schemaDocument of allSchemaDocuments()) {
    for (const schemaResource of schemaDocument.schemaResources) {
      if (schemaResource.baseUri === schemaUri) {
        return schemaDocument;
      }
    }
  }
};
