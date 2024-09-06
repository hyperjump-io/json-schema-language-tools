import { FileChangeType, TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { watch } from "chokidar";
import * as SchemaDocument from "./schema-document.js";
import { getDocumentSettings, isSchema } from "./features/document-settings.js";
import { asyncCollectArray, asyncFilter, pipe } from "@hyperjump/pact";

/**
 * @import {
 *   Connection,
 *   DidChangeWatchedFilesParams,
 *   Disposable,
 *   FileEvent,
 *   NotificationHandler,
 *   TextDocumentChangeEvent,
 *   WorkspaceFolder
 * } from "vscode-languageserver"
 * @import { SchemaDocument as SchemaDocumentType } from "./schema-document.js"
 */


export class SchemaRegistry {
  #connection;
  #documents;

  /** @type Map<string, SchemaDocumentType> */
  #openSchemaDocuments;
  /** @type Map<string, SchemaDocumentType> */
  #savedSchemaDocuments;
  /** @type Set<string> */
  #registeredSchemas;

  #watcher;
  /** @type Record<string, FileChangeType> */
  #changes;
  /** @type MyPromise<Record<string, FileChangeType>> */
  #promise;
  #watchEnabled;

  /** @type NotificationHandler<DidChangeWatchedFilesParams> */
  #didChangeWatchedFilesHandler;

  /**
   * @param {Connection} connection
   */
  constructor(connection) {
    this.#connection = connection;
    this.#documents = new TextDocuments(TextDocument);
    this.#documents.listen(connection);

    this.#openSchemaDocuments = new Map();
    this.#savedSchemaDocuments = new Map();
    this.#registeredSchemas = new Set();

    this.#didChangeWatchedFilesHandler = () => {};
    this.#connection.onDidChangeWatchedFiles((params) => {
      for (const change of params.changes) {
        this.#savedSchemaDocuments.delete(change.uri);
      }

      if (params.changes.length === 0) {
        this.#savedSchemaDocuments.clear();
      }

      this.#didChangeWatchedFilesHandler(params);
    });

    this.#documents.onDidChangeContent(({ document }) => {
      this.#openSchemaDocuments.delete(document.uri);
    });

    this.#documents.onDidClose(({ document }) => {
      this.#openSchemaDocuments.delete(document.uri);
    });

    this.#changes = {};
    this.#promise = createPromise();
    this.#watchEnabled = false;

    this.#watcher = watch([], { ignoreInitial: true })
      .on("all", (event, path) => {
        if (event === "add") {
          this.#changes[path] = this.#changes[path] === FileChangeType.Deleted ? FileChangeType.Changed : FileChangeType.Created;
        } else if (event === "change") {
          this.#changes[path] = this.#changes[path] === FileChangeType.Created ? FileChangeType.Created : FileChangeType.Changed;
        } else if (event === "unlink") {
          if (this.#changes[path] === FileChangeType.Created) {
            delete this.#changes[path];
          } else {
            this.#changes[path] = FileChangeType.Deleted;
          }
        } else {
          return;
        }

        this.#promise.resolve(this.#changes);
        this.#promise = createPromise();
      });
  }

  async watch() {
    this.#watchEnabled = true;
    while (this.#watchEnabled) {
      const value = await this.#promise.promise;
      this.#changes = {};

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
    await this.#watcher.close();

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

      const settings = await getDocumentSettings(this.#connection);
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
    for await (const schemaDocument of this.all()) {
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
      const settings = await getDocumentSettings(this.#connection);
      schemaDocument = SchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);
      this.#openSchemaDocuments.set(uri, schemaDocument);
    }

    return schemaDocument;
  }

  clear() {
    this.#savedSchemaDocuments.clear();
    this.#openSchemaDocuments.clear();
    for (const schemaUri of this.#registeredSchemas) {
      unregisterSchema(schemaUri);
    }
    this.#registeredSchemas.clear();
  }

  /** @type () => AsyncGenerator<SchemaDocumentType> */
  async* all() {
    const watched = this.#watcher.getWatched();

    for (const directory in watched) {
      for (const file of watched[directory]) {
        const path = resolve(directory, file);
        if (!(path in watched)) {
          const uri = URI.file(path).toString();
          if (await isSchema(uri)) {
            yield await this.get(uri);
          }
        }
      }
    }
  }

  /** @type (folders: WorkspaceFolder[]) => void */
  addWorkspaceFolders(folders) {
    for (const folder of folders) {
      const folderPath = fileURLToPath(folder.uri);
      this.#watcher.add(folderPath);
    }
  }

  /** @type (folders: WorkspaceFolder[]) => void */
  removeWorkspaceFolders(folders) {
    for (const folder of folders) {
      const folderPath = fileURLToPath(folder.uri);
      this.#watcher.unwatch(folderPath);
    }
  }

  /** @type (handler: NotificationHandler<DidChangeWatchedFilesParams>) => void */
  onDidChangeWatchedFiles(handler) {
    this.#didChangeWatchedFilesHandler = async ({ changes }) => {
      const filteredChanges = await pipe(
        changes,
        asyncFilter(async (fileEvent) => await isSchema(fileEvent.uri)),
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
      if (await isSchema(document.uri)) {
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
      if (await isSchema(document.uri)) {
        handler({ document: await this.get(document.uri) });
      }
    });
  }
}

/**
 * @template T
 * @typedef {{
 *   promise: Promise<T>;
 *   resolve: (value: T) => void;
 *   reject: (error: Error) => void;
 * }} MyPromise
 */

/**
 * @template T
 * @returns MyPromise<T>
 */
const createPromise = () => {
  let resolve;
  let reject;

  /** @type Promise<T> */
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: /** @type (value: T) => void */ (/** @type unknown */ (resolve)),
    reject: /** @type (error: Error) => void */ (/** @type unknown */ (reject))
  };
};
