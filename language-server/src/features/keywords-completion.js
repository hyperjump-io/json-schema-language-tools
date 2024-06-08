import { CompletionItemKind } from "vscode-languageserver";
import { getDialect } from "@hyperjump/json-schema/experimental";
import { subscribe } from "../pubsub.js";
import * as SchemaDocument from "../schema-document.js";
import * as SchemaNode from "../schema-node.js";


export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (SchemaNode.typeOf(currentProperty) === "object") {
        const dialect = getDialect(currentProperty.dialectUri);
        const keywords = Object.keys(dialect);
        completions.push(...keywords.map((keyword) => ({
          label: keyword,
          kind: CompletionItemKind.Value
        })));
      }
    });
  }
};
