import { removeMediaTypePlugin } from "@hyperjump/browser";

// Hyperjump
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";
import { SchemaRegistry } from "./schema-registry.js";

/**
 * @import { Connection, InitializeParams, ServerCapabilities } from "vscode-languageserver"
 */


/**
 * @typedef {{
 *   load: (connection: Connection, schemas: SchemaRegistry) => Promise<void>;
 *   onInitialize: (params: InitializeParams, connection: Connection, schemas: SchemaRegistry) => ServerCapabilities;
 *   onInitialized: (connection: Connection, schemas: SchemaRegistry) => Promise<void>;
 *   onShutdown: (connection: Connection, schemas: SchemaRegistry) => Promise<void>;
 * }} Feature
 */

removeMediaTypePlugin("http");
removeMediaTypePlugin("https");

/** @type (connection: Connection, features: Feature[]) => Promise<void> */
export const buildServer = async (connection, features) => {
  const schemas = new SchemaRegistry(connection);

  for (const feature of features) {
    await feature.load(connection, schemas);
  }

  connection.onInitialize(async (params) => {
    connection.console.log("Initializing JSON Schema service ...");

    return {
      capabilities: features.reduce((serverCapabilities, feature) => {
        return { ...serverCapabilities, ...feature.onInitialize(params, connection, schemas) };
      }, {})
    };
  });

  connection.onInitialized(async () => {
    for (const feature of features) {
      await feature.onInitialized(connection, schemas);
    }
  });

  connection.onShutdown(async () => {
    for (const feature of features) {
      await feature.onShutdown(connection, schemas);
    }
  });

  connection.listen();
};
