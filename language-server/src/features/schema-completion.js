import { getDialectIds } from "@hyperjump/json-schema/experimental";
import { CompletionItemKind } from "vscode-languageserver";
import { subscribe } from "../pubsub.js";


export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    const trailingHashDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);
    const shouldHaveTrailingHash = (uri) => trailingHashDialects.has(uri);

    subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = schemaDocument.findNodeAtOffset(offset);
      if (currentProperty && currentProperty.pointer.endsWith("/$schema")) {
        completions.push(...getDialectIds().map((uri) => ({
          label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
          kind: CompletionItemKind.Value
        })));
      }
    });
  }
};
