import { CompletionItemKind } from "vscode-languageserver";
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

      // const text = document.getText();
      // const startOfLine = text.lastIndexOf("\n", offset - 1) + 1;
      // const textBeforePosition = text.slice(startOfLine, offset);
      // if (textBeforePosition.trim().endsWith("\"if\":")) {
      //   completions.push(...ifThenPatternCompletion());
      // }
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
        "{varName}": { "const": "{value}" }
      },
      "required": ["{varName}"]
    },
    "then": {
    }`,
    documentation: "Basic if/then pattern with a single condition and corresponding schema."
  },
  {
    label: "If/then/else",
    kind: CompletionItemKind.Snippet,
    insertText: `{
      "type": "object",
      "properties": {
        "{varName}": { "const": "{value}" }
      },
      "required": ["{varName}"]
    },
    "then": {
    },
    "else": {
    }`,
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
