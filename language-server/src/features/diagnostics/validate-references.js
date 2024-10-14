import { getSchema } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../../model/schema-node.js";

/**
 * @import { Schemas } from "../../services/schemas.js"
 * @import { DiagnosticsProvider } from "./diagnostics.js"
 */


/** @implements DiagnosticsProvider */
export class ValidateReferencesDiagnosticsProvider {
  #schemas;

  /**
   * @param {Schemas} schemas
   */
  constructor(schemas) {
    this.#schemas = schemas;
  }

  /** @type DiagnosticsProvider["getDiagnostics"] */
  async getDiagnostics(schemaDocument) {
    const diagnostics = [];

    for (const schemaResource of schemaDocument.schemaResources) {
      for (const node of this.#schemas.references(schemaResource)) {
        /** @type ReturnType<typeof SchemaNode.value<string>> */
        const reference = SchemaNode.value(node);
        let referencedSchema;
        try {
          referencedSchema = this.#schemas.getSchemaNode(reference, schemaResource) ?? await getSchema(reference);
        } catch (_error) {
          // Ignore for now
        }

        if (!referencedSchema) {
          diagnostics.push({ instance: node, message: "Referenced schema doesn't exist" });
        }
      }
    }

    return diagnostics;
  }
}
