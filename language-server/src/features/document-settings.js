import { DidChangeConfigurationNotification } from "vscode-languageserver";
import { publish } from "../pubsub.js";
import { clearSchemaDocuments } from "./schema-documents.js";


let hasConfigurationCapability = false;
let hasDidChangeConfigurationCapability = false;

export default {
  onInitialize: ({ capabilities }) => {
    hasConfigurationCapability = !!capabilities.workspace?.configuration;
    hasDidChangeConfigurationCapability = !!capabilities.workspace?.didChangeConfiguration?.dynamicRegistration;

    return {};
  },

  onInitialized: (connection, documents) => {
    if (hasDidChangeConfigurationCapability) {
      connection.client.register(DidChangeConfigurationNotification.type);
    }

    connection.onDidChangeConfiguration(() => {
      if (hasConfigurationCapability) {
        documentSettings.clear();
        clearSchemaDocuments();
      }

      publish("workspaceChanged", { changes: [] });
    });

    documents.onDidClose(({ document }) => {
      documentSettings.delete(document.uri);
    });
  }
};

const documentSettings = new Map();
const defaultSettings = {
  schemaFilePatterns: ["**/*.schema.json", "**/schema.json"]
};

export const getDocumentSettings = async (connection, uri) => {
  if (!hasConfigurationCapability) {
    return defaultSettings;
  }

  if (!documentSettings.has(uri)) {
    const result = await connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "jsonSchemaLanguageServer"
    }) ?? {};
    documentSettings.set(uri, { ...defaultSettings, ...result });
  }

  return documentSettings.get(uri);
};
