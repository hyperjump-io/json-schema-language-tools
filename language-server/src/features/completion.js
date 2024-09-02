import { publishAsync } from "../pubsub.js";
import { getSchemaDocument } from "./schema-registry.js";

/**
 * @import { CompletionItem } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
 */


/** @type Feature */
export default {
  async load(connection, documents) {
    connection.onCompletion(async ({ textDocument, position }) => {
      /** @type CompletionItem[] */
      const completions = [];

      const document = documents.get(textDocument.uri);
      if (document) {
        const schemaDocument = await getSchemaDocument(connection, document);
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
