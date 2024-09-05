import { DiagnosticSeverity } from "vscode-languageserver";
import { BASIC, compile, getSchema, hasDialect, hasVocabulary, interpret } from "@hyperjump/json-schema/experimental";
import { publishAsync, subscribe, unsubscribe } from "../pubsub.js";
import * as SchemaNode from "../schema-node.js";
import { keywordNameFor } from "../util.js";

/**
 * @import { DiagnosticTag } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
 * @import { SchemaDocument as SchemaDocumentType } from "../schema-document.js"
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
  async load(connection, schemas) {
    subscriptionToken = subscribe("validateSchema", async (_message, /** @type SchemaDocumentType */ schemaDocument) => {
      connection.console.log(`Validate Schema: ${schemaDocument.textDocument.uri}`);

      for (const schemaResource of schemaDocument.schemaResources) {
        // Validate dialect
        if (!schemaResource.dialectUri || !hasDialect(schemaResource.dialectUri)) {
          const $schema = await SchemaNode.get("#/$schema", schemaResource, schemas);
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
              instanceNode: /** @type SchemaNodeType */ (await SchemaNode.get(error.instanceLocation, schemaResource, schemas))
            });
          }
        }
      }

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
