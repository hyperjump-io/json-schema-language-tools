import { MarkupKind } from "vscode-languageserver";
import * as SchemaDocument from "../schema-document.js";
import * as SchemaNode from "../schema-node.js";
import { getSchemaDocument } from "./schema-registry.js";


const annotationDialectUri = "https://json-schema.org/draft/2020-12/schema";

export default {
  onInitialize() {
    return {
      hoverProvider: true
    };
  },

  onInitialized(connection, documents) {
    connection.onHover(async ({ textDocument, position }) => {
      const document = documents.get(textDocument.uri);
      const schemaDocument = await getSchemaDocument(connection, document);
      const offset = document.offsetAt(position);
      const keyword = SchemaDocument.findNodeAtOffset(schemaDocument, offset);

      // This is a little wierd because we want the hover to be on the keyword, but
      // the annotation is actually on the value not the keyword.
      if (keyword.parent && SchemaNode.typeOf(keyword.parent) === "property" && keyword.parent.children[0] === keyword) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: SchemaNode.annotation(keyword.parent.children[1], "description", annotationDialectUri).join("\n")
          },
          range: {
            start: document.positionAt(keyword.offset),
            end: document.positionAt(keyword.offset + keyword.textLength)
          }
        };
      }
    });
  }
};
