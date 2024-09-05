import {
  DiagnosticSeverity,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  SemanticTokensRefreshRequest,
  TextDocumentSyncKind
} from "vscode-languageserver";
import { hasDialect } from "@hyperjump/json-schema/experimental";
import { publishAsync, subscribe, unsubscribe } from "../pubsub.js";

/**
 * @import { Diagnostic, DiagnosticTag, ServerCapabilities } from "vscode-languageserver"
 * @import { TextDocument } from "vscode-languageserver-textdocument"
 * @import { Feature } from "../build-server.js"
 * @import { SchemaDocument } from "../schema-document.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
 */


/**
 * @typedef {{
 *   instance: SchemaNodeType;
 *   message: string;
 *   severity?: DiagnosticSeverity;
 *   tags?: DiagnosticTag[];
 * }} ValidationDiagnostic
 */

let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;

/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  async load(connection, schemas) {
    // TODO: Move to workspace validation feature
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
        await validateSchema(schemaDocument);
      }

      await connection.sendRequest(SemanticTokensRefreshRequest.type);

      reporter.done();
    });

    // TODO: Move to diagnostics feature

    /** @type (schemaDocument: SchemaDocument) => Promise<void> */
    const validateSchema = async (schemaDocument) => {
      connection.console.log(`Schema Validation: ${schemaDocument.textDocument.uri}`);

      /** @type ValidationDiagnostic[] */
      const diagnostics = [];
      await publishAsync("diagnostics", { schemaDocument, diagnostics });

      await connection.sendDiagnostics({
        uri: schemaDocument.textDocument.uri,
        diagnostics: diagnostics.map(({ instance, message, severity, tags }) => {
          return buildDiagnostic(schemaDocument.textDocument, instance, message, severity, tags);
        })
      });
    };

    /**
     * @type (
     *   textDocument: TextDocument,
     *   node: SchemaNodeType,
     *   message: string,
     *   severity?: DiagnosticSeverity,
     *   tags?: DiagnosticTag[]
     * ) => Diagnostic;
     */
    const buildDiagnostic = (textDocument, node, message, severity = DiagnosticSeverity.Error, tags = []) => {
      return {
        severity: severity,
        tags: tags,
        range: {
          start: textDocument.positionAt(node.offset),
          end: textDocument.positionAt(node.offset + node.textLength)
        },
        message: message,
        source: "json-schema"
      };
    };

    schemas.onDidChangeWatchedFiles(async (params) => {
      await publishAsync("workspaceChanged", params);
    });

    schemas.onDidChangeContent(async ({ document }) => {
      await validateSchema(document);
    });
  },

  onInitialize({ capabilities, workspaceFolders }, _connection, schemas) {
    if (workspaceFolders) {
      schemas.addWorkspaceFolders(workspaceFolders);
    }

    hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
    hasWorkspaceWatchCapability = !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

    /** @type ServerCapabilities */
    const serverCapabilities = {
      textDocumentSync: TextDocumentSyncKind.Incremental
    };

    if (hasWorkspaceFolderCapability) {
      serverCapabilities.workspace = {
        workspaceFolders: {
          supported: true,
          changeNotifications: true
        }
      };
    }

    return serverCapabilities;
  },

  async onInitialized(connection, schemas) {
    if (hasWorkspaceWatchCapability) {
      await connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [{ globPattern: "**/*" }]
      });
    } else {
      schemas.watch();
    }

    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
        schemas.addWorkspaceFolders(added);
        schemas.removeWorkspaceFolders(removed);
      });
    }
  },

  async onShutdown(_connection, schemas) {
    await schemas.stop();

    unsubscribe("workspaceChanged", subscriptionToken);
  }
};
