import { CompletionItemKind } from "vscode-languageserver";
import { getDialect } from "@hyperjump/json-schema/experimental";
import { toAbsoluteUri } from "@hyperjump/uri";
import { getNodeValue } from "jsonc-parser";
import { subscribe } from "../pubsub.js";
import * as SchemaDocument from "../schema-document.js";


export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      const schemaValue = getNodeValue(currentProperty)?.$schema;
      if (schemaValue) {
        const dialect = getDialect(toAbsoluteUri(schemaValue));
        const keywords = Object.keys(dialect);
        completions.push(...keywords.map((keyword) => ({
          label: keyword,
          kind: CompletionItemKind.Value
        })));
      }
    });
  }
};
