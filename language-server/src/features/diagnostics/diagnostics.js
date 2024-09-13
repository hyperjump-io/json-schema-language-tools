import { DiagnosticSeverity } from "vscode-languageserver";

/**
 * @import { DiagnosticTag } from "vscode-languageserver";
 * @import { Server } from "../../services/server.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../../model/schema-document.js"
 * @import { SchemaNode as SchemaNodeType } from "../../model/schema-node.js"
 */


/**
 * @typedef {{
 *   instance: SchemaNodeType;
 *   message: string;
 *   severity?: DiagnosticSeverity;
 *   tags?: DiagnosticTag[];
 * }} ValidationDiagnostic
 *
 * @typedef {{
 *  getDiagnostics(schemaDocument: SchemaDocumentType): Promise<ValidationDiagnostic[]>
 * }} DiagnosticsProvider
 */

export class DiagnosticsFeature {
  #server;
  #providers;

  /**
   * @param {Server} server
   * @param {DiagnosticsProvider[]} providers
   */
  constructor(server, providers) {
    this.#server = server;
    this.#providers = providers;
  }

  /** @type (schemaDocument: SchemaDocumentType) => Promise<void> */
  async sendDiagnostics(schemaDocument) {
    /** @type ValidationDiagnostic[] */
    const diagnostics = [];
    for (const provider of this.#providers) {
      const providerDiagnostics = await provider.getDiagnostics(schemaDocument);
      diagnostics.push(...providerDiagnostics);
    }

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
