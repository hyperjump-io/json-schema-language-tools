import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import * as JsonNode from "../json-node.js";
import { subscribe } from "../pubsub.js";


const annotationDialectUri = "https://json-schema.org/draft/2020-12/schema";

export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
      for (const { schemaResource } of schemaDocument.schemaResources) {
        for (const deprecated of JsonNode.annotatedWith(schemaResource, "deprecated", annotationDialectUri)) {
          if (JsonNode.annotation(deprecated, "deprecated", annotationDialectUri).some((deprecated) => deprecated)) {
            diagnostics.push({
              instance: deprecated.parent,
              message: JsonNode.annotation(deprecated, "x-deprecationMessage", annotationDialectUri).join("\n") || "deprecated",
              severity: DiagnosticSeverity.Warning,
              tags: [DiagnosticTag.Deprecated]
            });
          }
        }
      }
    });
  }
};
