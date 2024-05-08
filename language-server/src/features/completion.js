import { getDialectIds } from "@hyperjump/json-schema/experimental";
import { getSchemaDocument } from "./schema-documents.js";
import { CompletionItemKind } from "vscode-languageserver";


export default {
  onInitialize() {
    return {
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ["\"", ":", " "]
      }
    };
  },

  onInitialized(connection, documents) {
    connection.onCompletion(async ({ textDocument, position }) => {
      const document = documents.get(textDocument.uri);
      const schemaDocument = await getSchemaDocument(connection, document);
      const offset = document.offsetAt(position);
      const currentProperty = schemaDocument.findNodeAtOffset(offset);
      if (currentProperty.pointer.endsWith("/$schema")) {
        return getDialectIds().map((uri) => {
          return {
            label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
            kind: CompletionItemKind.Value
          };
        });
      }
    });

    const trailingHashDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);
    const shouldHaveTrailingHash = (uri) => trailingHashDialects.has(uri);
  }
};
