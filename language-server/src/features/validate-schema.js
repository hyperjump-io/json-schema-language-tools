import { DiagnosticSeverity } from "vscode-languageserver";
import { publishAsync, subscribe, unsubscribe } from "../pubsub.js";

/**
 * @import { DiagnosticTag } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
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

/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  async load(connection) {
    subscriptionToken = subscribe("validateSchema", async (_message, schemaDocument) => {
      connection.console.log(`Validate Schema: ${schemaDocument.textDocument.uri}`);

      /** @type ValidationDiagnostic[] */
      const diagnostics = [];
      await publishAsync("diagnostics", { schemaDocument, diagnostics });

      await connection.sendDiagnostics({
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
    });
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  },

  async onShutdown() {
    unsubscribe("validateSchema", subscriptionToken);
  }
};
