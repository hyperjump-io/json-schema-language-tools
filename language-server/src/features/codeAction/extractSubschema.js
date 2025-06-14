import {
  CodeActionKind,
  TextDocumentEdit
} from "vscode-languageserver";
import { getKeywordName } from "@hyperjump/json-schema/experimental";
import * as SchemaDocument from "../../model/schema-document.js";
import * as SchemaNode from "../../model/schema-node.js";
import { withFormatting } from "../../util/util.js";

/**
 * @import { Server } from "../../services/server.js";
 * @import { Schemas } from "../../services/schemas.js";
 * @import { CodeAction } from "vscode-languageserver";
 * @import { Configuration } from "../../services/configuration.js";
 */


export class ExtractSubSchemaToDefs {
  /**
   * @param {Server} server
   * @param {Schemas} schemas
   * @param {Configuration} configuration
   */
  constructor(server, schemas, configuration) {
    this.server = server;
    this.schemas = schemas;
    this.configuration = configuration;

    server.onInitialize(() => ({
      capabilities: {
        codeActionProvider: true
      }
    }));

    server.onCodeAction(async ({ textDocument, range }) => {
      if (range.start.line === range.end.line && range.start.character === range.end.character) {
        return [];
      }

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

      const dialectUri = /** @type {string} */ (node.root.dialectUri);
      const definitionsKeyword = getKeywordName(dialectUri, "https://json-schema.org/keyword/definitions");
      const definitionsNode = SchemaNode.step(definitionsKeyword, node.root);
      let highestDefNumber = 0;
      if (definitionsNode) {
        let defNodeKeys = SchemaNode.keys(definitionsNode);
        for (const key of defNodeKeys) {
          const keyValue = /** @type {string} */ (SchemaNode.value(key));

          const match = /^def(\d+)$/.exec(keyValue);
          if (match) {
            highestDefNumber = Math.max(parseInt(match[1], 10), highestDefNumber);
          }
        }
      }

      const newDefName = `def${highestDefNumber + 1}`;
      const extractedDef = schemaDocument.textDocument.getText(range);
      const settings = await this.configuration.get();
      const lastSubschema = node.root.children.slice(-1)[0];
      const lastSubschemaPosition = lastSubschema.offset + lastSubschema.textLength;
      const lastDefinition = definitionsNode?.children.at(-1);
      const lastDefinitionPosition = (lastDefinition)
        ? lastDefinition.offset + lastDefinition.textLength
        : /** @type {number} */ (definitionsNode?.offset) + 1;
      /** @type {CodeAction} */
      const codeAction = {
        title: `Extract '${newDefName}' to ${definitionsKeyword}`,
        kind: CodeActionKind.RefactorExtract,
        edit: {
          documentChanges: [
            TextDocumentEdit.create({ uri: textDocument.uri, version: null }, [
              {
                range: range,
                newText: `{ "$ref": "#/${definitionsKeyword}/${newDefName}" }`
              },
              definitionsNode
                ? withFormatting(schemaDocument.textDocument, {
                    range: {
                      start: schemaDocument.textDocument.positionAt(lastDefinitionPosition),
                      end: schemaDocument.textDocument.positionAt(lastDefinitionPosition)
                    },
                    newText: lastDefinition ? `,\n"${newDefName}": ${extractedDef}` : `\n"${newDefName}": ${extractedDef}`
                  }, settings)
                : withFormatting(schemaDocument.textDocument, {
                    range: {
                      start: schemaDocument.textDocument.positionAt(lastSubschemaPosition),
                      end: schemaDocument.textDocument.positionAt(lastSubschemaPosition)
                    },
                    newText: `,\n"${definitionsKeyword}": {\n"${newDefName}": ${extractedDef}\n}`
                  }, settings)
            ])
          ]
        }
      };

      return [codeAction];
    });
  }
}
