import { watch } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DiagnosticSeverity,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  TextDocumentSyncKind
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { publishAsync } from "../pubsub.js";
import { getSchemaDocument } from "./schema-documents.js";
import { getDocumentSettings, isMatchedFile } from "./document-settings.js";


let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;

export default {
  onInitialize({ capabilities, workspaceFolders }) {
    if (workspaceFolders) {
      addWorkspaceFolders(workspaceFolders);
    }

    hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
    hasWorkspaceWatchCapability = !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

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

  onInitialized(connection, documents) {
    const onWorkspaceChange = (eventType, filename) => {
      // eventType === "rename" means file added or deleted (on most platforms?)
      // eventType === "change" means file saved
      // filename is not always available (when is it not available?)
      validateWorkspace({
        changes: [
          {
            uri: filename,
            type: eventType === "change" ? FileChangeType.Changed : FileChangeType.Deleted
          }
        ]
      });
    };

    const validateWorkspace = async (_changes) => {
      const reporter = await connection.window.createWorkDoneProgress();
      reporter.begin("JSON Schema: Indexing workspace");

      // Re/validate all schemas
      const result = await getDocumentSettings(connection);
      const schemaFilePatterns = result.schemaFilePatterns;
      for await (const uri of workspaceSchemas((filename) => isMatchedFile(filename, schemaFilePatterns))) {
        let textDocument = documents.get(uri);
        if (!textDocument) {
          const instanceJson = await readFile(fileURLToPath(uri), "utf8");
          textDocument = TextDocument.create(uri, "json", -1, instanceJson);
        }

        validateSchema(textDocument);
      }

      reporter.done();
    };

    const validateSchema = async (textDocument) => {
      connection.console.log(`Schema Validation: ${textDocument.uri}`);

      const diagnostics = [];
      const schemaDocument = await getSchemaDocument(connection, textDocument);
      await publishAsync("diagnostics", { schemaDocument, diagnostics });

      connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics: diagnostics.map(({ instance, message, severity, tags }) => {
          return buildDiagnostic(textDocument, instance, message, severity, tags);
        })
      });
    };

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

    if (hasWorkspaceWatchCapability) {
      connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [
          { globPattern: "**/*.schema.json" },
          { globPattern: "**/schema.json" }
        ]
      });
    } else {
      watchWorkspace(onWorkspaceChange, isMatchedFile);
    }

    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
        addWorkspaceFolders(added);
        removeWorkspaceFolders(removed);

        if (!hasWorkspaceWatchCapability) {
          watchWorkspace(onWorkspaceChange, isMatchedFile);
        }

        validateWorkspace({ changes: [] });
      });
    }

    connection.onDidChangeWatchedFiles(onWorkspaceChange);

    documents.onDidChangeContent(async ({ document }) => {
      const result = await getDocumentSettings(connection);
      const schemaFilePatterns = result.schemaFilePatterns;
      if (isMatchedFile(document.uri, schemaFilePatterns)) {
        validateSchema(document);
      }
    });

    validateWorkspace({ changes: [] });
  }
};

const workspaceFolders = new Set();

const addWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    workspaceFolders.add(folder);
  }
};

const removeWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    if (watchers[folder.uri]) {
      watchers[folder.uri].close();
    }

    workspaceFolders.delete(folder);
  }
};

const watchers = {};

const watchWorkspace = (handler, isSchema) => {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    if (watchers[path]) {
      watchers[path].close();
    }

    watchers[path] = watch(path, { recursive: true }, (eventType, filename) => {
      if (isSchema(filename)) {
        handler(eventType, filename);
      }
    });
  }
};

const workspaceSchemas = async function* (isSchema) {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    for (const filename of await readdir(path, { recursive: true })) {
      if (isSchema(filename)) {
        const schemaPath = resolve(path, filename);

        yield pathToFileURL(schemaPath).toString();
      }
    }
  }
};
