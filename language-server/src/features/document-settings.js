import { DidChangeConfigurationNotification } from "vscode-languageserver";
import { publish } from "../pubsub.js";
import { clearSchemaDocuments } from "./schema-documents.js";


export let schemaFilePatterns = ["**/*.schema.json", "**/schema.json"];

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

    connection.onDidChangeConfiguration((change) => {
      if (hasConfigurationCapability) {
        documentSettings.clear();
        clearSchemaDocuments();
      } else {
        globalSettings = change.settings.jsonSchemaLanguageServer ?? globalSettings;
      }
      schemaFilePatterns = globalSettings.schemaFilePatterns ?? defaultFilePatterns;

      publish("workspaceChanged", { changes: [] });
    });

    documents.onDidClose(({ document }) => {
      documentSettings.delete(document.uri);
    });
  }
};

const documentSettings = new Map();
const defaultFilePatterns = ["**/*.schema.json", "**/schema.json"];
let globalSettings = {};

export const getDocumentSettings = async (connection, uri) => {
  if (!hasConfigurationCapability) {
    return globalSettings;
  }

  if (!documentSettings.has(uri)) {
    const result = await connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "jsonSchemaLanguageServer"
    });
    schemaFilePatterns = result?.schemaFilePatterns ?? defaultFilePatterns;
    documentSettings.set(uri, result ?? globalSettings);
  }

  return documentSettings.get(uri);
};
