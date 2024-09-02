import { CompletionItemKind } from "vscode-languageserver";
import { getDialectIds } from "@hyperjump/json-schema/experimental";
import * as SchemaDocument from "../schema-document.js";
import { subscribe, unsubscribe } from "../pubsub.js";

/** @import { Feature } from "../build-server.js"; */

/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  async load() {
    const trailingHashDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);
    const shouldHaveTrailingHash = (/** @type string */ uri) => trailingHashDialects.has(uri);

    subscriptionToken = subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (currentProperty && currentProperty.pointer.endsWith("/$schema") && currentProperty.type === "string") {
        completions.push(...getDialectIds().map((uri) => ({
          label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
          kind: CompletionItemKind.Value
        })));
      }
    });
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  },

  async onShutdown() {
    unsubscribe("completions", subscriptionToken);
  }
};
