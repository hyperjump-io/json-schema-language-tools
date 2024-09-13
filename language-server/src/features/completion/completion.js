import * as SchemaDocument from "../../model/schema-document.js";

/**
 * @import { CompletionItem } from "vscode-languageserver"
 * @import { Server } from "../../services/server.js"
 * @import { Schemas } from "../../services/schemas.js"
 * @import { SchemaNode as SchemaNodeType } from "../../model/schema-node.js"
 */


/**
 * @typedef {{
 *  getCompletions(node: SchemaNodeType): CompletionItem[]
 * }} CompletionProvider
 */

export class CompletionFeature {
  /**
   * @param {Server} server
   * @param {Schemas} schemas
   * @param {CompletionProvider[]} providers
   */
  constructor(server, schemas, providers) {
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

    server.onCompletion(async ({ textDocument, position }) => {
      /** @type CompletionItem[] */
      const completions = [];

      const schemaDocument = await schemas.getOpen(textDocument.uri);
      if (schemaDocument) {
        const offset = schemaDocument.textDocument.offsetAt(position);
        for (const provider of providers) {
          const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
          if (node) {
            completions.push(...provider.getCompletions(node));
          }
        }
      }

      return completions;
    });
  }
}
