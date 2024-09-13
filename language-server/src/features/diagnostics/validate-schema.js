import { DiagnosticSeverity } from "vscode-languageserver";
import { BASIC, compile, getSchema, hasDialect, hasVocabulary, interpret } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../../model/schema-node.js";
import { keywordNameFor } from "../../util/util.js";

/**
 * @import { Server } from "../../services/server.js";
 * @import { Schemas } from "../../services/schemas.js"
 * @import { DiagnosticsFeature } from "./diagnostics.js"
 * @import { SchemaNode as SchemaNodeType } from "../../model/schema-node.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../../model/schema-document.js"
 */


export class ValidateSchemaFeature {
  #server;
  #schemas;
  #diagnostics;

  /**
   * @param {Server} server
   * @param {Schemas} schemas
   * @param {DiagnosticsFeature} diagnostics
   */
  constructor(server, schemas, diagnostics) {
    this.#server = server;
    this.#schemas = schemas;
    this.#diagnostics = diagnostics;

    this.#schemas.onDidChangeContent(async ({ document }) => {
      await this.validateSchema(document);
    });
  }

  /** @type (schemaDocument: SchemaDocumentType) => Promise<void> */
  async validateSchema(schemaDocument) {
    this.#server.console.log(`Validate Schema: ${schemaDocument.textDocument.uri}`);

    for (const schemaResource of schemaDocument.schemaResources) {
      // Validate dialect
      if (!schemaResource.dialectUri || !hasDialect(schemaResource.dialectUri)) {
        const $schema = await SchemaNode.get("#/$schema", schemaResource, this.#schemas);
        if ($schema && SchemaNode.typeOf($schema) === "string") {
          schemaDocument.errors.push({
            keyword: "https://json-schema.org/keyword/schema",
            instanceNode: $schema,
            message: "Unknown dialect"
          });
        } else if (schemaResource.dialectUri !== undefined) {
          schemaDocument.errors.push({
            keyword: "https://json-schema.org/keyword/schema",
            instanceNode: schemaResource,
            message: "Unknown dialect"
          });
        } else {
          schemaDocument.errors.push({
            keyword: "https://json-schema.org/keyword/schema",
            instanceNode: schemaResource,
            message: "No dialect"
          });
        }

        continue;
      }

      // Validate vocabularies
      const vocabToken = schemaResource.dialectUri && keywordNameFor("https://json-schema.org/keyword/vocabulary", schemaResource.dialectUri);
      const vocabularyNode = vocabToken && SchemaNode.step(vocabToken, schemaResource);
      if (vocabularyNode) {
        for (const [vocabularyUriNode, isRequiredNode] of SchemaNode.entries(vocabularyNode)) {
          const vocabularyUri = SchemaNode.value(vocabularyUriNode);
          const isRequired = SchemaNode.value(isRequiredNode);

          if (!hasVocabulary(vocabularyUri)) {
            schemaDocument.errors.push({
              keyword: "https://json-schema.org/keyword/vocabulary",
              instanceNode: vocabularyUriNode,
              message: isRequired ? "Unknown vocabulary" : "Unknown optional vocabulary",
              severity: isRequired ? undefined : DiagnosticSeverity.Warning
            });
          }
        }

        if (schemaDocument.errors.some((error) => error.severity !== DiagnosticSeverity.Warning)) {
          continue;
        }
      }

      // Validate schema
      const schema = await getSchema(schemaResource.dialectUri);
      const compiled = await compile(schema);
      const output = interpret(compiled, schemaResource, BASIC);
      if (output.errors) {
        for (const error of output.errors) {
          schemaDocument.errors.push({
            keyword: error.keyword,
            keywordNode: await getSchema(error.absoluteKeywordLocation),
            instanceNode: /** @type SchemaNodeType */ (await SchemaNode.get(error.instanceLocation, schemaResource, this.#schemas))
          });
        }
      }
    }

    this.#diagnostics.sendDiagnostics(schemaDocument);
  }
}
