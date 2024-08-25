import { watch } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DiagnosticSeverity,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  SemanticTokensRefreshRequest,
  TextDocumentSyncKind
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { hasDialect } from "@hyperjump/json-schema/experimental";
import { toAbsoluteIri } from "@hyperjump/uri";
import picomatch from "picomatch";
import { publishAsync, subscribe, unsubscribe } from "../pubsub.js";
import * as SchemaNode from "../schema-node.js";
import { keywordNameFor } from "../util.js";
import { allSchemaDocuments, getSchemaDocument } from "./schema-registry.js";
import { getDocumentSettings } from "./document-settings.js";

/**
 * @import { FSWatcher, WatchEventType  } from "node:fs"
 * @import { Diagnostic, DiagnosticTag, ServerCapabilities, WorkspaceFolder } from "vscode-languageserver"
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

/** @type Set<string> */
const customDialects = new Set();

/** @type Feature */
export default {
  load(connection, documents) {
    subscriptionToken = subscribe("workspaceChanged", async (_message, _changes) => {
      const reporter = await connection.window.createWorkDoneProgress();
      reporter.begin("JSON Schema: Indexing workspace");

      // Unregister all existing schemas
      for (const dialectUri of customDialects) {
        unregisterSchema(dialectUri);
      }
      customDialects.clear();

      // Load all schemas
      const settings = await getDocumentSettings(connection);
      const schemaFilePatterns = settings.schemaFilePatterns;
      for await (const uri of workspaceSchemas(schemaFilePatterns)) {
        const instanceJson = await readFile(fileURLToPath(uri), "utf8");
        const textDocument = TextDocument.create(uri, "json", -1, instanceJson);

        const schemaDocument = await getSchemaDocument(connection, textDocument);
        for (const schemaResource of schemaDocument.schemaResources) {
          const vocabToken = schemaResource.dialectUri && keywordNameFor("https://json-schema.org/keyword/vocabulary", schemaResource.dialectUri);
          const vocabularyNode = vocabToken && SchemaNode.step(vocabToken, schemaResource);
          if (vocabularyNode) {
            try {
              registerSchema(SchemaNode.value(schemaResource), schemaResource.baseUri);
              customDialects.add(schemaResource.baseUri);
            } catch (error) {
              // TODO: present a diagnostic for unrecognized vocabulary error
              if (error instanceof Error) {
                connection.console.log(`Failed to register schema: ${error.stack}`);
              }
            }
          }
        }
      }

      // Rebuild custom dialect schemas
      for (const schemaDocument of allSchemaDocuments()) {
        for (const error of schemaDocument.errors) {
          try {
            const dialectUri = toAbsoluteIri(SchemaNode.value(error.instanceNode));
            if (error.keyword === "https://json-schema.org/keyword/schema" && hasDialect(dialectUri)) {
              for (const schemaResource of schemaDocument.schemaResources) {
                if (customDialects.has(schemaResource.baseUri)) {
                  unregisterSchema(schemaResource.baseUri);
                }
              }
              await getSchemaDocument(connection, schemaDocument.textDocument);
            }
          } catch (error) {
            // Ignore Invalid IRI for now
          }
        }
      }

      // Re/validate all schemas
      await Promise.all([...allSchemaDocuments()].map(validateSchema));

      await connection.sendRequest(SemanticTokensRefreshRequest.type);

      reporter.done();
    });

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
    removeWorkspaceFolders([...workspaceFolders]);

    for (const dialectUri of customDialects) {
      unregisterSchema(dialectUri);
    }
    customDialects.clear();

    unsubscribe("workspaceChanged", subscriptionToken);
  }
};

/** @type (eventType: WatchEventType, filename?: string) => Promise<void> */
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

/** @type (uri: string, patterns: string[]) => boolean */
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

/** @type (folders: WorkspaceFolder[]) => void */
const addWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    workspaceFolders.add(folder);
  }
};

/** @type (folders: WorkspaceFolder[]) => void */
const removeWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    const folderPath = fileURLToPath(folder.uri);
    if (watchers[folderPath]) {
      watchers[folderPath].close();
    }

    workspaceFolders.delete(folder);
  }
};

/** @type (handler: (eventType: WatchEventType, filename?: string) => void, schemaFilePatterns: string[]) => void */
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

/** @type (schemaFilePatterns: string[]) => AsyncGenerator<string> */
const workspaceSchemas = async function* (schemaFilePatterns) {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    for (const filename of await readdir(path, { recursive: true })) {
      if (isMatchedFile(filename, schemaFilePatterns)) {
        const schemaPath = resolve(path, filename);

        yield URI.file(schemaPath).toString();
      }
    }
  }
};
