import { FileChangeType, SemanticTokensRefreshRequest } from "vscode-languageserver";
import { hasDialect } from "@hyperjump/json-schema/experimental";
import { publishAsync, subscribe, unsubscribe } from "../pubsub.js";

/**
 * @import { Feature } from "../build-server.js"
 */


/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  load(connection, schemas) {
    subscriptionToken = subscribe("workspaceChanged", async (_message, { changes }) => {
      const reporter = await connection.window.createWorkDoneProgress();
      reporter.begin("JSON Schema: Indexing workspace");

      // Clear diagnostics for deleted schemas
      for (const change of changes) {
        if (change.type === FileChangeType.Deleted) {
          await connection.sendDiagnostics({ uri: change.uri, diagnostics: [] });
        }
      }

      schemas.clear();

      // Load all schemas
      /** @type string[] */
      const schemaDocumentsWithErrors = [];
      for await (const schemaDocument of schemas.all()) {
        for (const error of schemaDocument.errors) {
          if (error.keyword === "https://json-schema.org/keyword/schema" && error.instanceNode.dialectUri && hasDialect(error.instanceNode.dialectUri)) {
            schemaDocumentsWithErrors.push(schemaDocument.textDocument.uri);
            break;
          }
        }
      }

      // Rebuild schemas that failed due to a custom dialect that hadn't loaded yet
      for await (const schemaUri of schemaDocumentsWithErrors) {
        await schemas.get(schemaUri, true);
      }

      // Re/validate all schemas
      for await (const schemaDocument of schemas.all()) {
        await publishAsync("validateSchema", schemaDocument);
      }

      await connection.sendRequest(SemanticTokensRefreshRequest.type);

      reporter.done();
    });
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  },

  async onShutdown() {
    unsubscribe("workspaceChanged", subscriptionToken);
  }
};
