import { DidChangeConfigurationNotification } from "vscode-languageserver";
import { fileURLToPath } from "node:url";
import picomatch from "picomatch";
import { publishAsync } from "../pubsub.js";

/**
 * @import { Connection } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
 */


/**
 * @typedef {{
 *   defaultDialect?: string;
 *   schemaFilePatterns: string[];
 * }} DocumentSettings
 */

let hasDidChangeConfigurationCapability = false;

/** @type Feature */
export default {
  load(connection, schemas) {
    matcher = new Promise((resolve) => {
      connection.onDidChangeConfiguration(async ({ settings }) => {
        documentSettings.clear();
        schemas.clear();

        const fullSettings = { ...defaultSettings, ...settings.jsonSchemaLanguageServer };
        matcher = Promise.resolve(picomatch(fullSettings.schemaFilePatterns));
        resolve(matcher);

        await publishAsync("workspaceChanged", { changes: [] });
      });
    });

    schemas.onDidClose(({ document }) => {
      documentSettings.delete(document.textDocument.uri);
    });
  },

  onInitialize({ capabilities }) {
    hasDidChangeConfigurationCapability = !!capabilities.workspace?.didChangeConfiguration?.dynamicRegistration;

    return {};
  },

  async onInitialized(connection) {
    if (hasDidChangeConfigurationCapability) {
      await connection.client.register(DidChangeConfigurationNotification.type, {
        section: "jsonSchemaLanguageServer"
      });
    } else {
      matcher = Promise.resolve(picomatch(defaultSettings.schemaFilePatterns));
    }
  },

  async onShutdown() {
  }
};

// TODO: DocumentSettings class

const documentSettings = new Map();
const defaultSettings = {
  schemaFilePatterns: ["**/*.schema.json", "**/schema.json"]
};

/** @type (connection: Connection, uri?: string) => Promise<DocumentSettings> */
export const getDocumentSettings = async (connection, uri) => {
  if (!documentSettings.has(uri)) {
    const result = await connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "jsonSchemaLanguageServer"
    }) ?? {};
    documentSettings.set(uri, { ...defaultSettings, ...result });
  }

  return documentSettings.get(uri);
};

/** @type Promise<(uri: string) => boolean> */
let matcher;

/** @type (uri: string) => Promise<boolean> */
export const isSchema = async (uri) => {
  const path = fileURLToPath(uri);
  return (await matcher)(path);
};
