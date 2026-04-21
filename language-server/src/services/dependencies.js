import { resolveIri, toAbsoluteUri } from "../util/util.js";
import { value } from "../model/schema-node.js";

/**
 * @import { Server } from "./server.js";
 * @import { Schemas } from "./schemas.js";
 */

/**
 * @typedef {Object} DependencyRecord
 * @property {string} uri
 * @property {Set<string>} dependencies
 * @property {Set<string>} dependents
 */

export class Dependencies {
  #server;
  #schemas;
  /** @type {Map<string, DependencyRecord>} */
  #records;

  /**
   * @param {Server} server
   * @param {Schemas} schemas
   */
  constructor(server, schemas) {
    this.#server = server;
    this.#schemas = schemas;
    this.#records = new Map();
  }

  async build() {
    this.#server.console.log("Extracting Dependencies");
    this.#records.clear();

    for await (const schemaDocument of this.#schemas.all()) {
      const uri = schemaDocument.textDocument.uri;
      const dependent = this.#getOrCreateRecord(uri);
      for (const schemaResource of schemaDocument.schemaResources) {
        if (schemaResource.dialectUri) {
          this.#addDependencyIfLocal(dependent, schemaResource.dialectUri);
        }
        for (const reference of this.#schemas.references(schemaResource)) {
          /** @type {string} */
          const referenceValue = value(reference);
          const referencedUri = toAbsoluteUri(resolveIri(referenceValue, schemaResource.baseUri));
          this.#addDependencyIfLocal(dependent, referencedUri);
        }
      }
    }
  }

  /**
   * @param {DependencyRecord} dependent
   * @param {string} dependencyUri
   */
  #addDependencyIfLocal(dependent, dependencyUri) {
    // NOTE: Tracks only local filesystem schemas.
    // If a schema URI (e.g https://...) does not have a corresponding document,
    // we can't resolve its path, we can't watch it for changes, so tracking it adds no value.
    const dependencyDocument = this.#schemas.getBySchemaUri(dependencyUri);
    if (!dependencyDocument) {
      return;
    }
    const localDependencyUri = dependencyDocument.textDocument.uri;
    const dependency = this.#getOrCreateRecord(localDependencyUri);
    dependent.dependencies.add(localDependencyUri);
    dependency.dependents.add(dependent.uri);
  }

  /**
   * @param {string} uri
   * @returns {DependencyRecord}
   */
  #getOrCreateRecord(uri) {
    let dependencyRecord = this.#records.get(uri);

    if (!dependencyRecord) {
      dependencyRecord = {
        uri,
        dependencies: new Set(),
        dependents: new Set()
      };
      this.#records.set(uri, dependencyRecord);
    }

    return dependencyRecord;
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
