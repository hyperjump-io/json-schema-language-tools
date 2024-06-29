import { DidChangeConfigurationNotification } from "vscode-languageserver";
import { publish } from "../pubsub.js";
import { clearSchemaDocuments } from "./schema-registry.js";

/**
 * @import * as Type from "./document-settings.js"
 * @import { Feature } from "../build-server.js"
 */


let hasConfigurationCapability = false;
let hasDidChangeConfigurationCapability = false;

/** @type Feature */
export default {
  load(connection, documents) {
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
  },

  onInitialize({ capabilities }) {
    hasConfigurationCapability = !!capabilities.workspace?.configuration;
    hasDidChangeConfigurationCapability = !!capabilities.workspace?.didChangeConfiguration?.dynamicRegistration;

    return {};
  },

  async onInitialized(connection) {
    if (hasDidChangeConfigurationCapability) {
      connection.client.register(DidChangeConfigurationNotification.type, {
        section: "jsonSchemaLanguageServer"
      });
    }
  }
};

const documentSettings = new Map();
const defaultSettings = {
  schemaFilePatterns: ["**/*.schema.json", "**/schema.json"]
};

/** @type Type.getDocumentSettings */
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
