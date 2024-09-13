import { FileChangeType, SemanticTokensRefreshRequest } from "vscode-languageserver";
import { hasDialect } from "@hyperjump/json-schema/experimental";

/**
 * @import { DidChangeWatchedFilesParams } from "vscode-languageserver"
 * @import { Server } from "../services/server.js"
 * @import { Schemas } from "../services/schemas.js";
 * @import { Configuration } from "../services/configuration.js";
 * @import { ValidateSchemaFeature } from "./diagnostics/validate-schema.js";
 */


export class ValidateWorkspaceFeature {
  #server;
  #schemas;
  #configuration;
  #validateSchema;

  /**
   * @param {Server} server
   * @param {Schemas} schemas
   * @param {Configuration} configuration
   * @param {ValidateSchemaFeature} validateSchema
   */
  constructor(server, schemas, configuration, validateSchema) {
    this.#server = server;
    this.#schemas = schemas;
    this.#configuration = configuration;
    this.#validateSchema = validateSchema;

    this.#schemas.onDidChangeWatchedFiles(async (params) => {
      await this.workspaceChanged(params);
    });

    this.#configuration.onDidChangeConfiguration(async () => {
      await this.workspaceChanged({ changes: [] });
    });
  }

  /** @type (params: DidChangeWatchedFilesParams) => Promise<void> */
  async workspaceChanged({ changes }) {
    this.#server.console.log("Validating Workspace");

    const reporter = await this.#server.window.createWorkDoneProgress();
    reporter.begin("JSON Schema: Indexing workspace");

    // Clear diagnostics for deleted schemas
    for (const change of changes) {
      if (change.type === FileChangeType.Deleted) {
        await this.#server.sendDiagnostics({ uri: change.uri, diagnostics: [] });
      }
    }

    // Load all schemas
    /** @type string[] */
    const schemaDocumentsWithErrors = [];
    for await (const schemaDocument of this.#schemas.all()) {
      for (const schemaResource of schemaDocument.schemaResources) {
        if (!schemaResource.dialectUri || !hasDialect(schemaResource.dialectUri)) {
          schemaDocumentsWithErrors.push(schemaDocument.textDocument.uri);
          break;
        }
      }
    }

    // Rebuild schemas that failed due to a custom dialect that hadn't loaded yet
    for (const schemaUri of schemaDocumentsWithErrors) {
      await this.#schemas.get(schemaUri, true);
      await this.#schemas.getOpen(schemaUri, true);
    }

    // Re/validate all schemas
    for await (const schemaDocument of this.#schemas.all()) {
      await this.#validateSchema.validateSchema(schemaDocument);
    }

    await this.#server.sendRequest(SemanticTokensRefreshRequest.type);

    reporter.done();
  }
}
