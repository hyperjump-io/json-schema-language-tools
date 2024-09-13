import { getSchema } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../../model/schema-node.js";

/**
 * @import { Schemas } from "../../services/schemas.js"
 * @import { FindReferencesFeature } from "../find-references.js"
 * @import { DiagnosticsProvider } from "./diagnostics.js"
 */


/** @implements DiagnosticsProvider */
export class ValidateReferencesDiagnosticsProvider {
  #schemas;
  #references;

  /**
   * @param {Schemas} schemas
   * @param {FindReferencesFeature} references
   */
  constructor(schemas, references) {
    this.#schemas = schemas;
    this.#references = references;
  }

  /** @type DiagnosticsProvider["getDiagnostics"] */
  async getDiagnostics(schemaDocument) {
    const diagnostics = [];

    for (const schemaResource of schemaDocument.schemaResources) {
      for (const node of this.#references.references(schemaResource)) {
        const reference = SchemaNode.value(node);
        let referencedSchema;
        try {
          referencedSchema = await SchemaNode.get(reference, schemaResource, this.#schemas) ?? await getSchema(reference);
        } catch (error) {
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
