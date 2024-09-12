import { DiagnosticSeverity } from "vscode-languageserver";
import { publishAsync } from "../pubsub.js";

/**
 * @import { DiagnosticTag } from "vscode-languageserver";
 * @import { Server } from "../build-server.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../schema-document.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
 */


/**
 * @typedef {{
 *   instance: SchemaNodeType;
 *   message: string;
 *   severity?: DiagnosticSeverity;
 *   tags?: DiagnosticTag[];
 * }} ValidationDiagnostic
 */

export class DiagnosticsFeature {
  #server;

  /**
   * @param {Server} server
   */
  constructor(server) {
    this.#server = server;
  }

  /** @type (schemaDocument: SchemaDocumentType) => Promise<void> */
  async sendDiagnostics(schemaDocument) {
    // TODO: Eliminate pubsub
    /** @type ValidationDiagnostic[] */
    const diagnostics = [];
    await publishAsync("diagnostics", { schemaDocument, diagnostics });

    await this.#server.sendDiagnostics({
      uri: schemaDocument.textDocument.uri,
      diagnostics: diagnostics.map(({ instance, message, severity, tags }) => {
        return {
          severity: severity ?? DiagnosticSeverity.Error,
          tags: tags,
          range: {
            start: schemaDocument.textDocument.positionAt(instance.offset),
            end: schemaDocument.textDocument.positionAt(instance.offset + instance.textLength)
          },
          message: message,
          source: "json-schema"
        };
      })
    });
  }
}
