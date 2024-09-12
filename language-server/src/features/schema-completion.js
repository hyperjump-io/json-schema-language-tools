import { CompletionItemKind } from "vscode-languageserver";
import { getDialectIds } from "@hyperjump/json-schema/experimental";
import * as SchemaDocument from "../schema-document.js";
import { subscribe, unsubscribe } from "../pubsub.js";

/**
 * @import { Server } from "../build-server.js"
 */


export class SchemaCompletionFeature {
  #subscriptionToken;

  /**
   * @param {Server} server
   */
  constructor(server) {
    server.onShutdown(async () => {
      unsubscribe("completions", this.#subscriptionToken);
    });

    const trailingHashDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);
    /** @type (uri: string) => boolean */
    const shouldHaveTrailingHash = (uri) => trailingHashDialects.has(uri);

    // TODO: eliminate pubsub
    this.#subscriptionToken = subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (currentProperty && currentProperty.pointer.endsWith("/$schema") && currentProperty.type === "string") {
        completions.push(...getDialectIds().map((uri) => ({
          label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
          kind: CompletionItemKind.Value
        })));
      }
    });
  }
}
