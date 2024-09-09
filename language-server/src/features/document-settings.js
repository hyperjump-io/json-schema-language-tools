import { DidChangeConfigurationNotification } from "vscode-languageserver";

/**
 * @import { Feature } from "../build-server.js"
 */


let hasDidChangeConfigurationCapability = false;

/** @type Feature */
export default {
  // TODO: Can this be merged with Configuration?
  load() {
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
    }
  },

  async onShutdown() {
  }
};
