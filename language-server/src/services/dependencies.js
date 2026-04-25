import { resolveIri, toAbsoluteUri } from "../util/util.js";
import { value } from "../model/schema-node.js";
import { FileChangeType } from "vscode-languageserver";

/**
 * @import { Server } from "./server.js";
 * @import { Schemas } from "./schemas.js";
 * @import { FileEvent } from "vscode-languageserver";
 * @import { SchemaDocument } from "../model/schema-document.js"
 */

/**
 * @typedef {string} FileSystemUri
 * A URI that can be resolved to a file path on the filesystem
 */

/**
 * @typedef {string} SchemaUri
 * A URI that identifies a schema it could be a file system URI or an id
 */

/**
 * @typedef {Object} DependencyRecord
 * @property {FileSystemUri} uri
 * @property {Set<SchemaUri>} dependencies
 * @property {Set<SchemaUri>} definitions
 */

export class Dependencies {
  #server;
  #schemas;
  /** @type {Map<FileSystemUri, DependencyRecord>} */
  #records;
  /** @type {Map<SchemaUri, Set<FileSystemUri>>} */
  #dependents;

  /**
   * @param {Server} server
   * @param {Schemas} schemas
   */
  constructor(server, schemas) {
    this.#server = server;
    this.#schemas = schemas;
    this.#records = new Map();
    this.#dependents = new Map();
  }

  async build() {
    this.#server.console.log("Extracting Dependencies");
    this.#records.clear();
    this.#dependents.clear();

    for await (const schemaDocument of this.#schemas.all()) {
      const uri = schemaDocument.textDocument.uri;
      const dependent = this.#getOrCreateRecord(uri);
      for (const schemaResource of schemaDocument.schemaResources) {
        dependent.definitions.add(schemaResource.baseUri);
        if (schemaResource.dialectUri) {
          this.#addDependency(dependent, schemaResource.dialectUri);
        }
        for (const reference of this.#schemas.references(schemaResource)) {
          /** @type {string} */
          const referenceValue = value(reference);
          const referencedUri = toAbsoluteUri(resolveIri(referenceValue, schemaResource.baseUri));
          this.#addDependency(dependent, referencedUri);
        }
      }
    }
  }

  /**
   * @param {FileEvent[]} changes
   * @returns {Promise<AsyncIterable<SchemaDocument> | Iterable<SchemaDocument>>}
   */
  async sync(changes) {
    const shouldValidateAllSchemas = !changes.length;
    if (shouldValidateAllSchemas) {
      await this.build();
      return this.#schemas.all();
    }
    /** @type {Set<FileSystemUri>} */
    const affectedUris = new Set();
    const affectedSchemas = [];
    // We are calling findAffectedUris before updating the dependencies
    // because if a file is deleted, it will be removed from the dependencies
    // and we won't be able to find its dependents after the update.
    // This also happens if a file defined an id that now is deleted.
    this.#findAffectedUris(changes, affectedUris);
    await this.build();
    // We are also calling findAffectedUris after updating the dependencies
    // because if a file is added, we need to find its dependents.
    // This also happens if a file now defines an id that it didn't before.
    this.#findAffectedUris(changes, affectedUris);
    for (const uri of affectedUris) {
      const schemaDocument = await this.#schemas.get(uri);
      if (schemaDocument) {
        affectedSchemas.push(schemaDocument);
      }
    }
    return affectedSchemas;
  }

  /**
   * @param {FileSystemUri} uri
   * @param {Set<FileSystemUri>} dependents
   * @returns {Set<FileSystemUri>}
   */
  findDependents(uri, dependents = new Set()) {
    const record = this.#records.get(uri);
    const handles = record?.definitions ?? new Set();

    for (const handle of handles) {
      const directDependents = this.#dependents.get(handle) ?? new Set();
      for (const directDependent of directDependents) {
        if (dependents.has(directDependent)) continue;
        dependents.add(directDependent);
        this.findDependents(directDependent, dependents);
      }
    }

    return dependents;
  }

  /**
   * @param {DependencyRecord} dependent
   * @param {SchemaUri} dependencyUri
   */
  #addDependency(dependent, dependencyUri) {
    dependent.dependencies.add(dependencyUri);
    let dependents = this.#dependents.get(dependencyUri);
    if (!dependents) {
      dependents = new Set();
      this.#dependents.set(dependencyUri, dependents);
    }
    dependents.add(dependent.uri);
  }

  /**
   * @param {FileSystemUri} uri
   * @returns {DependencyRecord}
   */
  #getOrCreateRecord(uri) {
    let dependencyRecord = this.#records.get(uri);

    if (!dependencyRecord) {
      dependencyRecord = {
        uri,
        dependencies: new Set(),
        definitions: new Set([uri])
      };
      this.#records.set(uri, dependencyRecord);
    }

    return dependencyRecord;
  }

  /**
   * @param {FileEvent[]} changes
   * @param {Set<FileSystemUri>} affectedUris
   * @returns {Set<string>}
   */
  #findAffectedUris(changes, affectedUris = new Set()) {
    for (const change of changes) {
      if (change.type !== FileChangeType.Deleted) {
        // NOTE: When a file is deleted, we don't need to revalidate it, as it will be removed from the workspace
        affectedUris.add(change.uri);
      }
      const dependents = this.findDependents(change.uri);
      for (const dependent of dependents) {
        affectedUris.add(dependent);
      }
    }
    return affectedUris;
  }

  print() {
    for (const [key, value] of this.#records) {
      const dependencies = value.dependencies;
      for (const dependency of dependencies) {
        this.#server.console.log(`${key} -> ${dependency}`);
      }
    }
  }
}
