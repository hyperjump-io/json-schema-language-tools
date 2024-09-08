import { CompletionItemKind, InsertTextFormat } from "vscode-languageserver";
import * as SchemaDocument from "../schema-document.js";
import { subscribe, unsubscribe } from "../pubsub.js";

/** @import { Feature } from "../build-server.js" */

/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  load() {
    subscriptionToken = subscribe("completions", async (_message, { schemaDocument, offset, completions }) => {
      const currentProperty = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (currentProperty && currentProperty.pointer.endsWith("/if") && currentProperty.type === "property") {
        completions.push(...ifThenPatternCompletion);
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
