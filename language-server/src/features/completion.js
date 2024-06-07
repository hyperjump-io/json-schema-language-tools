import { publishAsync } from "../pubsub.js";
import { getSchemaDocument } from "./schema-registry.js";


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
      const offset = schemaDocument.textDocument.offsetAt(position);

      const completions = [];
      await publishAsync("completions", { schemaDocument, offset, completions });
      return completions;
    });
  }
};
