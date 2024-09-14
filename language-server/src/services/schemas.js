import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DidChangeWatchedFilesNotification, FileChangeType, TextDocuments, TextDocumentSyncKind } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { asyncCollectArray, asyncFilter, pipe, reduce } from "@hyperjump/pact";
import * as JsonPointer from "@hyperjump/json-pointer";
import { watch } from "chokidar";
import * as SchemaDocument from "../model/schema-document.js";
import * as SchemaNode from "../model/schema-node.js";
import { createPromise, resolveIri, toAbsoluteUri, uriFragment } from "../util/util.js";

/**
 * @import {
 *   DidChangeWatchedFilesParams,
 *   Disposable,
 *   FileEvent,
 *   NotificationHandler,
 *   ServerCapabilities,
 *   TextDocumentChangeEvent,
 *   WorkspaceFolder
 * } from "vscode-languageserver"
 * @import { FSWatcher } from "chokidar";
 * @import { Server } from "../services/server.js";
 * @import { SchemaDocument as SchemaDocumentType } from "../model/schema-document.js"
 * @import { SchemaNode as SchemaNodeType } from "../model/schema-node.js"
 * @import { Configuration } from "./configuration.js";
 * @import { MyPromise } from "../util/util.js"
 */


export class Schemas {
  #server;
  #configuration;
  #documents;

  /** @type Set<string> */
  #workspaceFolders;

  /** @type Map<string, SchemaDocumentType> */
  #openSchemaDocuments;
  /** @type Map<string, SchemaDocumentType> */
  #savedSchemaDocuments;
  /** @type Set<string> */
  #registeredSchemas;

  /** @type FSWatcher | undefined */
  #watcher;
  #watchEnabled;

  /** @type NotificationHandler<DidChangeWatchedFilesParams> */
  #didChangeWatchedFilesHandler;

  /**
   * @param {Server} server
   * @param {Configuration} configuration
   */
  constructor(server, configuration) {
    this.#server = server;
    this.#configuration = configuration;

    this.#documents = new TextDocuments(TextDocument);
    this.#documents.listen(server);

    let hasWorkspaceFolderCapability = false;
    let hasWorkspaceWatchCapability = false;

    this.#server.onInitialize(({ capabilities, workspaceFolders }) => {
      if (workspaceFolders) {
        this.addWorkspaceFolders(workspaceFolders);
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

      return {
        capabilities: serverCapabilities
      };
    });

    this.#server.onInitialized(async () => {
      if (hasWorkspaceWatchCapability) {
        await this.#server.client.register(DidChangeWatchedFilesNotification.type, {
          watchers: [{ globPattern: "**/*" }]
        });
      } else {
        this.watch();
      }

      if (hasWorkspaceFolderCapability) {
        this.#server.workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
          this.addWorkspaceFolders(added);
          this.removeWorkspaceFolders(removed);
        });
      }
    });

    this.#server.onShutdown(async () => {
      await this.stop();
    });

    this.#workspaceFolders = new Set();

    this.#openSchemaDocuments = new Map();
    this.#savedSchemaDocuments = new Map();
    this.#registeredSchemas = new Set();

    this.#watchEnabled = false;

    this.#didChangeWatchedFilesHandler = () => {};
    this.#server.onDidChangeWatchedFiles((params) => {
      // TODO: Only clear changed files, their dependencies, and their dependents
      this.#clear();

      this.#didChangeWatchedFilesHandler(params);
    });

    this.#documents.onDidChangeContent(({ document }) => {
      this.#openSchemaDocuments.delete(document.uri);
    });

    this.#documents.onDidClose(({ document }) => {
      this.#openSchemaDocuments.delete(document.uri);
    });

    this.#configuration.onDidChangeConfiguration(() => {
      this.#clear();
    });
  }

  async watch() {
    /** @type Record<string, FileChangeType> */
    let changes = {};

    /** @type MyPromise<Record<string, FileChangeType>> */
    let promise = createPromise();

    this.#watcher = watch([...this.#workspaceFolders], { ignoreInitial: true })
      .on("all", (event, path) => {
        if (event === "add") {
          changes[path] = changes[path] === FileChangeType.Deleted ? FileChangeType.Changed : FileChangeType.Created;
        } else if (event === "change") {
          changes[path] = changes[path] === FileChangeType.Created ? FileChangeType.Created : FileChangeType.Changed;
        } else if (event === "unlink") {
          if (changes[path] === FileChangeType.Created) {
            delete changes[path];
          } else {
            changes[path] = FileChangeType.Deleted;
          }
        } else {
          return;
        }

        promise.resolve(changes);
        promise = createPromise();
      });

    this.#watchEnabled = true;
    while (this.#watchEnabled) {
      const value = await promise.promise;
      changes = {};

      /** @type FileEvent[] */
      const fileEvents = [];
      for (const path in value) {
        const uri = URI.file(path).toString();

        fileEvents.push({
          uri: uri,
          type: value[path]
        });
      }

      this.#didChangeWatchedFilesHandler({ changes: fileEvents });
    }
  }

  /** @type () => Promise<void> */
  async stop() {
    this.#watchEnabled = false;
    await this.#watcher?.close();

    for (const schemaUri of this.#registeredSchemas) {
      unregisterSchema(schemaUri);
    }
  }

  /** @type (uri: string, noCache?: boolean) => Promise<SchemaDocumentType> */
  async get(uri, noCache = false) {
    let schemaDocument = this.#savedSchemaDocuments.get(uri);
    if (!schemaDocument || noCache) {
      const instanceJson = await readFile(fileURLToPath(uri), "utf8");
      const textDocument = TextDocument.create(uri, "json", -1, instanceJson);

      const settings = await this.#configuration.get();
      schemaDocument = SchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);

      this.#savedSchemaDocuments.set(uri, schemaDocument);

      // Register schemas
      for (const schemaResource of schemaDocument.schemaResources) {
        const schemaUri = schemaResource.baseUri;
        if (schemaUri === textDocument.uri) {
          continue;
        }

        try {
          unregisterSchema(schemaUri);
          registerSchema(JSON.parse(textDocument.getText()), schemaUri);
          this.#registeredSchemas.add(schemaUri);
        } catch (error) {
          // Ignore errors
        }
      }
    }

    return schemaDocument;
  }

  /** @type (schemaUri: string) => Promise<SchemaDocumentType | undefined> */
  async getBySchemaUri(schemaUri) {
    for await (const schemaDocument of this.#savedSchemaDocuments.values()) {
      for (const schemaResource of schemaDocument.schemaResources) {
        if (schemaResource.baseUri === schemaUri) {
          return schemaDocument;
        }
      }
    }
  }

  /** @type (uri: string, noCache?: boolean) => Promise<SchemaDocumentType | undefined> */
  async getOpen(uri, noCache = false) {
    const textDocument = this.#documents.get(uri);
    if (!textDocument) {
      return;
    }

    let schemaDocument = this.#openSchemaDocuments.get(uri);
    if (schemaDocument?.textDocument.version !== textDocument.version || noCache) {
      const settings = await this.#configuration.get();
      schemaDocument = SchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);
      this.#openSchemaDocuments.set(uri, schemaDocument);
    }

    return schemaDocument;
  }

  /** @type (url: string, node: SchemaNodeType | undefined) => SchemaNodeType | undefined */
  getSchemaNode(uri, node) {
    const schemaId = toAbsoluteUri(resolveIri(uri, node?.baseUri ?? ""));
    const schemaResource = this.#getSchemaResource(schemaId, node);
    if (!schemaResource) {
      return;
    }

    const fragment = uriFragment(uri);
    const pointer = fragment === "" || fragment[0] === "/" ? fragment : schemaResource.anchors[fragment];
    if (typeof pointer !== "string") {
      return;
    }

    return reduce((/** @type SchemaNodeType | undefined */ node, segment) => {
      if (node === undefined) {
        return;
      }

      segment = segment === "-" && SchemaNode.typeOf(node) === "array" ? `${SchemaNode.length(node)}` : segment;
      return SchemaNode.step(segment, node);
    }, schemaResource.root, JsonPointer.pointerSegments(pointer));
  }

  /** @type (uri: string, node: SchemaNodeType | undefined) => SchemaNodeType | undefined */
  #getSchemaResource(uri, node) {
    for (const embeddedSchemaUri in node?.embedded) {
      if (embeddedSchemaUri === uri) {
        return node.embedded[embeddedSchemaUri];
      }
    }

    for (const schemaDocument of this.#savedSchemaDocuments.values()) {
      if (schemaDocument.schemaResources[0]?.baseUri === uri) {
        return schemaDocument.schemaResources[0];
      }
    }
  }

  #clear() {
    this.#savedSchemaDocuments.clear();
    this.#openSchemaDocuments.clear();
    for (const schemaUri of this.#registeredSchemas) {
      unregisterSchema(schemaUri);
    }
    this.#registeredSchemas.clear();
  }

  /** @type () => AsyncGenerator<SchemaDocumentType> */
  async* all() {
    for (const folderPath of this.#workspaceFolders) {
      for (const relativePath of await readdir(folderPath, { recursive: true })) {
        const path = resolve(folderPath, relativePath);
        const uri = URI.file(path).toString();
        if (await this.#configuration.isSchema(uri)) {
          yield await this.get(uri);
        }
      }
    }
  }

  /** @type (folders: WorkspaceFolder[]) => void */
  addWorkspaceFolders(folders) {
    for (const folder of folders) {
      const folderPath = fileURLToPath(folder.uri);
      this.#workspaceFolders.add(folderPath);
      this.#watcher?.add(folderPath);
    }
  }

  /** @type (folders: WorkspaceFolder[]) => void */
  removeWorkspaceFolders(folders) {
    for (const folder of folders) {
      const folderPath = fileURLToPath(folder.uri);
      this.#workspaceFolders.delete(folderPath);
      this.#watcher?.unwatch(folderPath);
    }
  }

  /** @type (handler: NotificationHandler<DidChangeWatchedFilesParams>) => void */
  onDidChangeWatchedFiles(handler) {
    this.#didChangeWatchedFilesHandler = async ({ changes }) => {
      const filteredChanges = await pipe(
        changes,
        asyncFilter(async (fileEvent) => await this.#configuration.isSchema(fileEvent.uri)),
        asyncCollectArray
      );
      if (filteredChanges) {
        handler({ changes: filteredChanges });
      }
    };
  }

  /** @type (handler: NotificationHandler<TextDocumentChangeEvent<SchemaDocumentType>>) => Disposable */
  onDidChangeContent(handler) {
    return this.#documents.onDidChangeContent(async ({ document }) => {
      if (await this.#configuration.isSchema(document.uri)) {
        const schemaDocument = await this.getOpen(document.uri);
        if (schemaDocument) {
          handler({ document: schemaDocument });
        }
      }
    });
  }

  /** @type (handler: NotificationHandler<TextDocumentChangeEvent<SchemaDocumentType>>) => Disposable */
  onDidClose(handler) {
    return this.#documents.onDidClose(async ({ document }) => {
      if (await this.#configuration.isSchema(document.uri)) {
        handler({ document: await this.get(document.uri) });
      }
    });
  }
}
