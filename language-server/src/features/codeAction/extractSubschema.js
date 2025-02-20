import {
  CodeActionKind,
  TextDocumentEdit
} from "vscode-languageserver";
import * as SchemaDocument from "../../model/schema-document.js";
import * as SchemaNode from "../../model/schema-node.js";


/**
 * @import { Schemas } from "../../services/schemas.js";
 * @import { Server } from "../../services/server.js";
 * @import {CodeAction} from "vscode-languageserver";
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

    server.onCodeAction(async (params) => {
      const uri = params.textDocument.uri;
      let schemaDocument = await schemas.getOpen(uri);
      if (!schemaDocument) {
        return [];
      }

      const offset = schemaDocument.textDocument.offsetAt(params.range.start);
      const node = SchemaDocument.findNodeAtOffset(schemaDocument, offset);
      if (!node?.isSchema) {
        return [];
      }

      // Finding the $defs node
      let findDef;
      for (const schemaNode of SchemaNode.allNodes(node.root)) {
        if (schemaNode.keywordUri === "https://json-schema.org/keyword/definitions") {
          findDef = schemaNode;
          break;
        }
      }

      // Getting the name from pointer
      let newDefName = "unknown";
      if (node.pointer) {
        const parts = node.pointer.split("/");
        newDefName = parts[parts.length - 1] || "unknown";
      }

      /** @type {CodeAction} */
      const codeAction = {
        title: `Extract '${newDefName}' to $defs`,
        kind: CodeActionKind.RefactorExtract,
        edit: {
          documentChanges: [
            TextDocumentEdit.create({ uri: params.textDocument.uri, version: null }, [
              {
                range: params.range,
                newText: `{ "$ref": "#/$defs/${newDefName}" }`
              },
              findDef
                ? {
                    range: {
                      start: schemaDocument.textDocument.positionAt(findDef.offset + 1),
                      end: schemaDocument.textDocument.positionAt(findDef.offset + 1)
                    },
                    newText: `\n    "${newDefName}":${schemaDocument.textDocument.getText(params.range)},`
                  }
                : {
                    range: {
                      start: { line: 1, character: 0 },
                      end: { line: 1, character: 0 }
                    },
                    newText: `  "$defs": {\n  "${newDefName}":${schemaDocument.textDocument.getText(params.range)}\n  },\n`
                  }
            ])
          ]
        }
      };

      return [codeAction];
    });
  }
}
