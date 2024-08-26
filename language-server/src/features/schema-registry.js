import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { getDocumentSettings } from "./document-settings.js";
import * as SchemaDocument from "../schema-document.js";

/**
 * @import { Connection } from "vscode-languageserver"
 * @import { TextDocument } from "vscode-languageserver-textdocument"
 * @import { Feature } from "../build-server.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../schema-document.js"
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
const registeredSchemas = new Set();

/** @type (connection: Connection, textDocument: TextDocument) => Promise<SchemaDocumentType> */
export const getSchemaDocument = async (connection, textDocument) => {
  let { version, schemaDocument } = schemaDocuments.get(textDocument.uri) ?? {};

  if (version === -1 || version !== textDocument.version) {
    const settings = await getDocumentSettings(connection, textDocument.uri);
    schemaDocument = await SchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);

    schemaDocuments.set(textDocument.uri, { version: textDocument.version, schemaDocument });
  }

  // Register schemas
  for (const schemaResource of schemaDocument.schemaResources) {
    const schemaUri = schemaResource.baseUri;
    if (schemaUri === textDocument.uri) {
      continue;
    }

    try {
      unregisterSchema(schemaUri);
      registerSchema(JSON.parse(textDocument.getText()), schemaUri);
      registeredSchemas.add(schemaUri);
    } catch (error) {
      // Ignore errors
    }
  }

  return schemaDocument;
};

export const clearSchemaDocuments = () => {
  schemaDocuments.clear();
  for (const schemaUri of registeredSchemas) {
    unregisterSchema(schemaUri);
  }
  registeredSchemas.clear();
};

export const allSchemaDocuments = function* () {
  for (const { schemaDocument } of schemaDocuments.values()) {
    yield schemaDocument;
  }
};

export const allRegisteredSchemas = function* () {
  for (const schemaUri of registeredSchemas) {
    yield schemaUri;
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
