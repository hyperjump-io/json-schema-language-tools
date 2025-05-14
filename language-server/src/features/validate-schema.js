import { DiagnosticSeverity } from "vscode-languageserver";
import { BASIC, compile, getSchema, hasDialect, hasVocabulary } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../model/schema-node.js";
import { keywordNameFor } from "../util/util.js";
import { interpret, ValidationError } from "@hyperjump/json-schema/annotations/experimental";

/**
 * @import { Server } from "../services/server.js";
 * @import { Schemas } from "../services/schemas.js"
 * @import { DiagnosticsFeature } from "./diagnostics/diagnostics.js"
 * @import { SchemaNode as SchemaNodeType } from "../model/schema-node.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../model/schema-document.js"
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

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
        const $schema = this.#schemas.getSchemaNode("#/$schema", schemaResource);
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
          /** @type ReturnType<typeof SchemaNode.value<string>> */
          const vocabularyUri = SchemaNode.value(vocabularyUriNode);
          /** @type ReturnType<typeof SchemaNode.value<boolean>> */
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
      try {
        const schema = await getSchema(schemaResource.dialectUri);
        const compiled = await compile(schema);
        interpret(compiled, schemaResource, BASIC);
      } catch (error) {
        if (error instanceof ValidationError) {
          for (const outputUnit of error.output.errors ?? []) {
            schemaDocument.errors.push({
              keyword: outputUnit.keyword,
              keywordNode: await getSchema(outputUnit.absoluteKeywordLocation),
              instanceNode: /** @type SchemaNodeType */ (this.#schemas.getSchemaNode(outputUnit.instanceLocation, schemaResource))
            });
          }
        } else if (error instanceof Error) {
          schemaDocument.errors.push({
            keyword: "",
            instanceNode: schemaDocument.schemaResources[0],
            message: error.message
          });
        } else {
          throw error;
        }
      }
    }

    // TODO: Decouple diagnostics
    await this.#diagnostics.sendDiagnostics(schemaDocument);
  }
}
