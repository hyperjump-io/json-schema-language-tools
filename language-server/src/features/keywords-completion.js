import { CompletionItemKind } from "vscode-languageserver";
import { getDialect } from "@hyperjump/json-schema/experimental";
import { subscribe, unsubscribe } from "../pubsub.js";
import * as SchemaNode from "../schema-node.js";
import * as SchemaDocument from "../schema-document.js";
import { isPropertyNode } from "../util.js";

/**
 * @import { Feature } from "../build-server.js"
 */


/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  load() {
    subscriptionToken = subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (currentProperty && !isPropertyNode(currentProperty)) {
        return;
      }

      const schemaNode = currentProperty?.parent?.parent;
      if (schemaNode && SchemaNode.typeOf(schemaNode) !== "object") {
        return;
      }

      if (schemaNode?.isSchema && schemaNode.dialectUri) {
        const dialect = getDialect(schemaNode.dialectUri);
        const keywords = Object.keys(dialect);
        completions.push(...keywords.map((keyword) => ({
          label: keyword,
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
