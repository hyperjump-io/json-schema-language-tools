import { CompletionItemKind, InsertTextFormat } from "vscode-languageserver";

/**
 * @import { CompletionProvider } from "./completion.js"
 */


/** @implements CompletionProvider */
export class IfThenCompletionProvider {
  /** @type CompletionProvider["getCompletions"] */
  getCompletions(node) {
    const completions = [];

    if (node.pointer.endsWith("/if") && node.type === "property") {
      completions.push(...ifThenPatternCompletion);
    }

    return completions;
  }
}

export const ifThenPatternCompletion = [
  {
    label: "if/then",
    kind: CompletionItemKind.Snippet,
    insertText: `{
  "type": "object",
  "properties": {
    "\${1:propertyName}": { "const": \${2:value} }
  },
  "required": ["\${1:propertyName}"]
},
"then": \${3:{}}`,
    insertTextFormat: InsertTextFormat.Snippet,
    documentation: "Basic if/then pattern with a single condition and corresponding schema."
  },
  {
    label: "If/then/else",
    kind: CompletionItemKind.Snippet,
    insertText: `{
  "type": "object",
  "properties": {
    "\${1:varName}": { "const": \${2:value} }
  },
  "required": ["\${1:varName}"]
},
"then": \${3:{}},
"else": \${4:{}}`,
    insertTextFormat: InsertTextFormat.Snippet,
    documentation: "Conditional object structure with if/then/else logic"
  }
];
