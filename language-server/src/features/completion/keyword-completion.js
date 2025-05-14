import { CompletionItemKind } from "vscode-languageserver";
import { getDialect } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../../model/schema-node.js";
import { isPropertyNode } from "../../util/util.js";

/**
 * @import { CompletionProvider } from "./completion.js"
 */


/** @implements CompletionProvider */
export class KeywordCompletionProvider {
  /** @type CompletionProvider["getCompletions"] */
  getCompletions(node) {
    const completions = [];

    if (isPropertyNode(node)) {
      const schemaNode = node.parent?.parent;
      if (schemaNode && SchemaNode.typeOf(schemaNode) === "object" && schemaNode?.isSchema && schemaNode.dialectUri) {
        const dialect = getDialect(schemaNode.dialectUri);
        const keywords = Object.keys(dialect.keywords);
        completions.push(...keywords.map((keyword) => ({
          label: keyword,
          kind: CompletionItemKind.Value
        })));
      }
    }


    return completions;
  }
}
