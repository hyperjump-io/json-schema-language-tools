import { FileChangeType, SemanticTokensRefreshRequest } from "vscode-languageserver";
import { hasDialect } from "@hyperjump/json-schema/experimental";
import { publishAsync } from "../pubsub.js";

/**
 * @import { Feature } from "../build-server.js"
 * @import { DidChangeWatchedFilesParams } from "vscode-languageserver"
 */


/** @type Feature */
export default {
  load(connection, schemas, configuration) {
    schemas.onDidChangeWatchedFiles(async (params) => {
      await workspaceChanged(params);
    });

    configuration.onDidChangeConfiguration(async () => {
      await workspaceChanged({ changes: [] });
    });

    /** @type (params: DidChangeWatchedFilesParams) => Promise<void> */
    const workspaceChanged = async ({ changes }) => {
      connection.console.log("Validating Workspace");

      const reporter = await connection.window.createWorkDoneProgress();
      reporter.begin("JSON Schema: Indexing workspace");

      // Clear diagnostics for deleted schemas
      for (const change of changes) {
        if (change.type === FileChangeType.Deleted) {
          await connection.sendDiagnostics({ uri: change.uri, diagnostics: [] });
        }
      }

      // Load all schemas
      /** @type string[] */
      const schemaDocumentsWithErrors = [];
      for await (const schemaDocument of schemas.all()) {
        for (const schemaResource of schemaDocument.schemaResources) {
          if (!schemaResource.dialectUri || !hasDialect(schemaResource.dialectUri)) {
            schemaDocumentsWithErrors.push(schemaDocument.textDocument.uri);
            break;
          }
        }
      }

      // Rebuild schemas that failed due to a custom dialect that hadn't loaded yet
      for (const schemaUri of schemaDocumentsWithErrors) {
        await schemas.get(schemaUri, true);
        await schemas.getOpen(schemaUri, true);
      }

      // Re/validate all schemas
      for await (const schemaDocument of schemas.all()) {
        await publishAsync("validateSchema", schemaDocument);
      }

      await connection.sendRequest(SemanticTokensRefreshRequest.type);

      reporter.done();
    };
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  },

  async onShutdown() {
  }
};
