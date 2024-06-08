import { CompletionItemKind } from "vscode-languageserver";
import { getDialectIds } from "@hyperjump/json-schema/experimental";
import * as SchemaDocument from "../schema-document.js";
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
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (currentProperty && currentProperty.pointer.endsWith("/$schema")) {
        completions.push(...getDialectIds().map((uri) => ({
          label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
          kind: CompletionItemKind.Value
        })));
      }
    });
  }
};
