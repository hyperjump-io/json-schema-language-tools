import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import * as SchemaNode from "../../model/schema-node.js";

/**
 * @import { DiagnosticsProvider } from "./diagnostics.js"
 */


/** @implements DiagnosticsProvider */
export class DeprecatedDiagnosticsProvider {
  /** @type DiagnosticsProvider["getDiagnostics"] */
  async getDiagnostics(schemaDocument) {
    const diagnostics = [];

    const annotationDialectUri = "https://json-schema.org/draft/2020-12/schema";
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

    return diagnostics;
  }
}
