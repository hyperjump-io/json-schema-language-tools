import { CompletionItemKind } from "vscode-languageserver";
import { getDialectIds } from "@hyperjump/json-schema/experimental";

/**
 * @import { CompletionProvider } from "./completion.js"
 */


/** @implements CompletionProvider */
export class SchemaCompletionProvider {
  #trailingHashDialects;

  constructor() {
    this.#trailingHashDialects = new Set([
      "http://json-schema.org/draft-04/schema",
      "http://json-schema.org/draft-06/schema",
      "http://json-schema.org/draft-07/schema"
    ]);
  }

  /** @type CompletionProvider["getCompletions"] */
  getCompletions(node) {
    const completions = [];

    if (node.pointer.endsWith("/$schema") && node.type === "string") {
      completions.push(...getDialectIds().map((uri) => ({
        label: this.#shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
        kind: CompletionItemKind.Value
      })));
    }

    return completions;
  }

  /** @type (uri: string) => boolean */
  #shouldHaveTrailingHash(uri) {
    return this.#trailingHashDialects.has(uri);
  }
}
