import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import * as SchemaNode from "../schema-node.js";
import { subscribe, unsubscribe } from "../pubsub.js";

/** @import { Feature } from "../build-server.js" */


const annotationDialectUri = "https://json-schema.org/draft/2020-12/schema";
/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  load() {
    subscriptionToken = subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
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
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  },

  onShutdown() {
    unsubscribe("diagnostics", subscriptionToken);
  }
};
