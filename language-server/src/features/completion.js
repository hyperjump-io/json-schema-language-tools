import { publishAsync } from "../pubsub.js";

/**
 * @import { CompletionItem } from "vscode-languageserver"
 * @import { Server } from "../build-server.js"
 * @import { SchemaRegistry } from "../schema-registry.js";
 */


export class CompletionFeature {
  /**
   * @param {Server} server
   * @param {SchemaRegistry} schemas
   */
  constructor(server, schemas) {
    server.onInitialize(() => {
      return {
        capabilities: {
          completionProvider: {
            resolveProvider: false,
            triggerCharacters: ["\"", ":", " "]
          }
        }
      };
    });

    // TODO: Remove pubsub
    server.onCompletion(async ({ textDocument, position }) => {
      /** @type CompletionItem[] */
      const completions = [];

      const schemaDocument = await schemas.getOpen(textDocument.uri);
      if (schemaDocument) {
        const offset = schemaDocument.textDocument.offsetAt(position);
        await publishAsync("completions", { schemaDocument, offset, completions });
      }

      return completions;
    });
  }
}
