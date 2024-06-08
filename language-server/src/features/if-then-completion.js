import { CompletionItemKind, InsertTextFormat } from "vscode-languageserver";
import * as SchemaDocument from "../schema-document.js";
import { subscribe } from "../pubsub.js";


export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (currentProperty && currentProperty.pointer.endsWith("/if")) {
        completions.push(...ifThenPatternCompletion);
      }
    });
  }
};

const ifThenPatternCompletion = [
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
  },
  {
    label: "true",
    kind: CompletionItemKind.Snippet,
    insertText: `true`,
    documentation: "if true"
  },
  {
    label: "false",
    kind: CompletionItemKind.Snippet,
    insertText: `false`,
    documentation: "if false"
  }
];
