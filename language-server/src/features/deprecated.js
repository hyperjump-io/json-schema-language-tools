import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import * as SchemaNode from "../schema-node.js";
import { subscribe, unsubscribe } from "../pubsub.js";

/**
 * @import { Server } from "../build-server.js"
 */


export class DeprecatedFeature {
  #subscriptionToken;

  /**
   * @param {Server} server
   */
  constructor(server) {
    server.onShutdown(async () => {
      unsubscribe("diagnostics", this.#subscriptionToken);
    });

    // TODO: Eliminate pubsub
    const annotationDialectUri = "https://json-schema.org/draft/2020-12/schema";
    this.#subscriptionToken = subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
      for (const schemaResource of schemaDocument.schemaResources) {
        for (const deprecated of SchemaNode.annotatedWith(schemaResource, "deprecated", annotationDialectUri)) {
          if (SchemaNode.annotation(deprecated, "deprecated", annotationDialectUri).some((deprecated) => deprecated)) {
            diagnostics.push({
              instance: deprecated.parent,
              message: SchemaNode.annotation(deprecated, "x-deprecationMessage", annotationDialectUri).join("\n") || "deprecated",
              severity: DiagnosticSeverity.Warning,
              tags: [DiagnosticTag.Deprecated]
            });
          }
        }
      }
    });
  }
}
