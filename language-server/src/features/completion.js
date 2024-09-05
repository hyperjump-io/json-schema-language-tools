import { publishAsync } from "../pubsub.js";

/**
 * @import { CompletionItem } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
 */


/** @type Feature */
export default {
  load(connection, schemas) {
    connection.onCompletion(async ({ textDocument, position }) => {
      /** @type CompletionItem[] */
      const completions = [];

      const schemaDocument = await schemas.getOpen(textDocument.uri);
      if (schemaDocument) {
        const offset = schemaDocument.textDocument.offsetAt(position);
        await publishAsync("completions", { schemaDocument, offset, completions });
      }

      return completions;
    });
  },

  onInitialize() {
    return {
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ["\"", ":", " "]
      }
    };
  },

  async onInitialized() {
  },

  async onShutdown() {
  }
};
