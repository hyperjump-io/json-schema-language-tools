import { FileChangeType, SemanticTokensRefreshRequest } from "vscode-languageserver";
import { hasDialect } from "@hyperjump/json-schema/experimental";

/**
 * @import { DidChangeWatchedFilesParams } from "vscode-languageserver"
 * @import { Server } from "../services/server.js"
 * @import { Schemas } from "../services/schemas.js";
 * @import { Configuration } from "../services/configuration.js";
 * @import { ValidateSchemaFeature } from "./validate-schema.js";
 * @import { Dependencies } from "../services/dependencies.js";
 * @import { FileEvent } from "vscode-languageserver"
 * @import { SchemaDocument } from "../model/schema-document.js"
 */


export class ValidateWorkspaceFeature {
  #server;
  #schemas;
  #configuration;
  #validateSchema;
  #dependencies;

  /**
   * @param {Server} server
   * @param {Schemas} schemas
   * @param {Configuration} configuration
   * @param {ValidateSchemaFeature} validateSchema
   * @param {Dependencies} dependencies
   */
  constructor(server, schemas, configuration, validateSchema, dependencies) {
    this.#server = server;
    this.#schemas = schemas;
    this.#configuration = configuration;
    this.#validateSchema = validateSchema;
    this.#dependencies = dependencies;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.#schemas.onDidChangeWatchedFiles(async (params) => {
      await this.workspaceChanged(params);
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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

    // NOTE: When the workspace is first loaded, we need to validate all schemas
    const shouldValidateWorkspace = changes.length === 0;
    // NOTE: We find the affected schemas before rebuilding the dependencies.
    // e.g. If A depends on B, and B is deleted, and we build the dependencies first,
    // we would have already removed B from the workspace, so the graph would have no dependents.
    const affectedSchemas = shouldValidateWorkspace ? this.#schemas.all() : this.#findAffectedSchemas(changes);

    // Re/validate affected schemas
    for await (const schemaDocument of affectedSchemas) {
      await this.#validateSchema.validateSchema(schemaDocument);
    }

    await this.#dependencies.build();
    this.#dependencies.print();

    await this.#server.sendRequest(SemanticTokensRefreshRequest.type);

    reporter.done();
  }

  /**
   * @param {FileEvent[]} changes
   * @returns {AsyncGenerator<SchemaDocument>}
   */
  async* #findAffectedSchemas(changes) {
    const affectedUris = this.#findAffectedUris(changes);
    for (const uri of affectedUris) {
      const schemaDocument = await this.#schemas.get(uri);
      if (schemaDocument) {
        yield schemaDocument;
      }
    }
  }

  /**
   * @param {FileEvent[]} changes
   * @returns {Set<string>}
   */
  #findAffectedUris(changes) {
    /** @type {Set<string>} */
    const affectedUris = new Set();
    for (const change of changes) {
      if (change.type !== FileChangeType.Deleted) {
        // NOTE: When a file is deleted, we don't need to revalidate it, as it will be removed from the workspace
        affectedUris.add(change.uri);
      }
      const dependents = this.#dependencies.findDependents(change.uri);
      for (const dependent of dependents) {
        affectedUris.add(dependent);
      }
    }
    return affectedUris;
  }
}
