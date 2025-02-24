import {
  CodeActionKind,
  TextDocumentEdit
} from "vscode-languageserver";
import { getKeywordName } from "@hyperjump/json-schema/experimental";
import * as SchemaDocument from "../../model/schema-document.js";
import * as SchemaNode from "../../model/schema-node.js";
import * as jsoncParser from "jsonc-parser";
/**
 * @import { Server } from "../../services/server.js"
 * @import { Schemas } from "../../services/schemas.js"
 * @import { CodeAction } from "vscode-languageserver";
 */
export class ExtractSubSchemaToDefs {
  /**
   * @param {Server} server
   * @param {Schemas} schemas
   */
  constructor(server, schemas) {
    this.server = server;
    this.schemas = schemas;
    server.onInitialize(() => ({
      capabilities: {
        codeActionProvider: true
      }
    }));

    // Helper function to format new def using jsonc-parser
    const formatNewDef = (/** @type {string} */ newDefText) => {
      try {
        /** @type {unknown} */
        const parsedDef = jsoncParser.parse(newDefText);
        return JSON.stringify(parsedDef, null, 2).replace(/\n/g, "\n    ");
      } catch {
        return newDefText;
      }
    };

    server.onCodeAction(async ({ textDocument, range }) => {
      const uri = textDocument.uri;
      let schemaDocument = await schemas.getOpen(uri);
      if (!schemaDocument) {
        return [];
      }

      const offset = schemaDocument.textDocument.offsetAt(range.start);
      const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (!node?.isSchema) {
        return [];
      }
      let definitionsNode;
      for (const schemaNode of SchemaNode.allNodes(node.root)) {
        if (schemaNode.keywordUri === "https://json-schema.org/keyword/definitions") {
          definitionsNode = schemaNode;
          break;
        }
      }
      let highestDefNumber = 0;
      if (definitionsNode) {
        const defsContent = schemaDocument.textDocument.getText().slice(
          definitionsNode.offset,
          definitionsNode.offset + definitionsNode.textLength
        );
        const defMatches = [...defsContent.matchAll(/"def(\d+)":/g)];
        defMatches.forEach((match) =>
          highestDefNumber = Math.max(highestDefNumber, parseInt(match[1], 10))
        );
      }
      let newDefName = `def${highestDefNumber + 1}`;
      const extractedDef = schemaDocument.textDocument.getText(range);
      const newFormattedDef = formatNewDef(extractedDef);
      let defName = getKeywordName(
      /** @type {string} */ (node.root.dialectUri),
        "https://json-schema.org/keyword/definitions"
      );

      /** @type {CodeAction} */
      const codeAction = {
        title: `Extract '${newDefName}' to $defs`,
        kind: CodeActionKind.RefactorExtract,
        edit: {
          documentChanges: [
            TextDocumentEdit.create({ uri: textDocument.uri, version: null }, [
              {
                range: range,
                newText: `{ "$ref": "#/${defName}/${newDefName}" }`
              },
              definitionsNode
                ? {
                    range: {
                      start: schemaDocument.textDocument.positionAt(definitionsNode.offset + 1),
                      end: schemaDocument.textDocument.positionAt(definitionsNode.offset + 1)
                    },
                    newText: `\n    "${newDefName}": ${newFormattedDef},`
                  }
                : {
                    range: {
                      start: schemaDocument.textDocument.positionAt(node.root.offset + node.root.textLength - 2),
                      end: schemaDocument.textDocument.positionAt(node.root.offset + node.root.textLength - 2)
                    },
                    newText: `,\n  "${defName}": {\n    "${newDefName}": ${newFormattedDef}\n  }`
                  }
            ])
          ]
        }
      };

      return [codeAction];
    });
  }
}
