import { watch } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DiagnosticSeverity,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  SemanticTokensRefreshRequest,
  TextDocumentSyncKind
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { publishAsync, subscribe, unsubscribe } from "../pubsub.js";
import { allSchemaDocuments, getSchemaDocument } from "./schema-registry.js";
import { getDocumentSettings } from "./document-settings.js";
import picomatch from "picomatch";

/**
 * @import * as Type from "./workspace.d.ts"
 * @import { FSWatcher } from "node:fs"
 * @import { WorkspaceFolder } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
 */


let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;

/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  load(connection, documents) {
    subscriptionToken = subscribe("workspaceChanged", async (_message, _changes) => {
      const reporter = await connection.window.createWorkDoneProgress();
      reporter.begin("JSON Schema: Indexing workspace");

      // Load all schemas
      const settings = await getDocumentSettings(connection);
      const schemaFilePatterns = settings.schemaFilePatterns;
      for await (const uri of workspaceSchemas(schemaFilePatterns)) {
        let textDocument = documents.get(uri);
        if (!textDocument) {
          const instanceJson = await readFile(fileURLToPath(uri), "utf8");
          textDocument = TextDocument.create(uri, "json", -1, instanceJson);
        }

        await getSchemaDocument(connection, textDocument);
      }

      // Re/validate all schemas
      await Promise.all([...allSchemaDocuments()].map(validateSchema));

      await connection.sendRequest(SemanticTokensRefreshRequest.type);

      reporter.done();
    });

    /** @type Type.validateSchema */
    const validateSchema = async (schemaDocument) => {
      connection.console.log(`Schema Validation: ${schemaDocument.textDocument.uri}`);

      /** @type Type.ValidationDiagnostic[] */
      const diagnostics = [];
      await publishAsync("diagnostics", { schemaDocument, diagnostics });

      await connection.sendDiagnostics({
        uri: schemaDocument.textDocument.uri,
        diagnostics: diagnostics.map(({ instance, message, severity, tags }) => {
          return buildDiagnostic(schemaDocument.textDocument, instance, message, severity, tags);
        })
      });
    };

    /** @type Type.buildDiagnostic */
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

    connection.onDidChangeWatchedFiles(async (params) => {
      await publishAsync("workspaceChanged", params);
    });

    documents.onDidChangeContent(async ({ document }) => {
      const settings = await getDocumentSettings(connection);
      const schemaFilePatterns = settings.schemaFilePatterns;
      const filePath = fileURLToPath(document.uri);
      if (isMatchedFile(filePath, schemaFilePatterns)) {
        const schemaDocument = await getSchemaDocument(connection, document);
        await validateSchema(schemaDocument);
      }
    });
  },

  onInitialize({ capabilities, workspaceFolders }) {
    if (workspaceFolders) {
      addWorkspaceFolders(workspaceFolders);
    }

    hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
    hasWorkspaceWatchCapability = !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

    /** @type import("vscode-languageserver").ServerCapabilities */
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

  async onInitialized(connection) {
    const settings = await getDocumentSettings(connection);

    if (hasWorkspaceWatchCapability) {
      await connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: settings.schemaFilePatterns.map((pattern) => {
          return { globPattern: pattern };
        })
      });
    } else {
      watchWorkspace(onWorkspaceChange, settings.schemaFilePatterns);
    }

    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
        addWorkspaceFolders(added);
        removeWorkspaceFolders(removed);

        if (!hasWorkspaceWatchCapability) {
          const settings = await getDocumentSettings(connection);
          watchWorkspace(onWorkspaceChange, settings.schemaFilePatterns);
        }

        await publishAsync("workspaceChanged", { changes: [] });
      });
    }
  },

  onShutdown() {
    for (const path in watchers) {
      watchers[path].close();
    }

    unsubscribe("workspaceChanged", subscriptionToken);
  }
};

/** @type Type.onWorkspaceChange */
const onWorkspaceChange = async (eventType, filename) => {
  // eventType === "rename" means file added or deleted (on most platforms?)
  // eventType === "change" means file saved
  // filename is not always available (when is it not available?)
  await publishAsync("workspaceChanged", {
    changes: [
      {
        uri: filename,
        type: eventType === "change" ? FileChangeType.Changed : FileChangeType.Deleted
      }
    ]
  });
};

/** @type Type.isMatchedFile */
export const isMatchedFile = (uri, patterns) => {
  patterns = patterns.map((pattern) => `**/${pattern}`);
  const matchers = patterns.map((pattern) => {
    return picomatch(pattern, {
      noglobstar: false,
      matchBase: false,
      dot: true,
      nonegate: true
    });
  });
  return matchers.some((matcher) => matcher(uri));
};

/** @type Set<WorkspaceFolder> */
const workspaceFolders = new Set();

/** @type Record<string, FSWatcher> */
const watchers = {};

/** @type Type.addWorkspaceFolders */
const addWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    workspaceFolders.add(folder);
  }
};

/** @type Type.removeWorkspaceFolders */
const removeWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    if (watchers[folder.uri]) {
      watchers[folder.uri].close();
    }

    workspaceFolders.delete(folder);
  }
};

/** @type Type.watchWorkspace */
const watchWorkspace = (handler, schemaFilePatterns) => {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    if (watchers[path]) {
      watchers[path].close();
    }

    watchers[path] = watch(path, { recursive: true }, (eventType, filename) => {
      if (filename && isMatchedFile(filename, schemaFilePatterns)) {
        handler(eventType, filename);
      }
    });
  }
};

/** @type Type.workspaceSchemas */
const workspaceSchemas = async function* (schemaFilePatterns) {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    for (const filename of await readdir(path, { recursive: true })) {
      if (isMatchedFile(filename, schemaFilePatterns)) {
        const schemaPath = resolve(path, filename);

        yield pathToFileURL(schemaPath).toString();
      }
    }
  }
};
