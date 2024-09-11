import { SchemaRegistry } from "./schema-registry.js";
import { Configuration } from "./configuration.js";

// Hyperjump
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";

/**
 * @import { Connection, InitializeParams, ServerCapabilities } from "vscode-languageserver"
 */


/**
 * @typedef {{
 *   load: (connection: Connection, schemas: SchemaRegistry, configuration: Configuration) => void;
 *   onInitialize: (params: InitializeParams, connection: Connection, schemas: SchemaRegistry) => ServerCapabilities;
 *   onInitialized: (connection: Connection, schemas: SchemaRegistry, configuration: Configuration) => Promise<void>;
 *   onShutdown: (connection: Connection, schemas: SchemaRegistry, configuration: Configuration) => Promise<void>;
 * }} Feature
 */

/** @type (connection: Connection, features: Feature[]) => void */
export const buildServer = (connection, features) => {
  const configuration = new Configuration(connection);
  const schemas = new SchemaRegistry(connection, configuration);

  for (const feature of features) {
    feature.load(connection, schemas, configuration);
  }

  connection.onInitialize((params) => {
    connection.console.log("Initializing JSON Schema service ...");

    return {
      capabilities: features.reduce((serverCapabilities, feature) => {
        return { ...serverCapabilities, ...feature.onInitialize(params, connection, schemas) };
      }, {})
    };
  });

  connection.onInitialized(async () => {
    for (const feature of features) {
      await feature.onInitialized(connection, schemas, configuration);
    }
  });

  connection.onShutdown(async () => {
    for (const feature of features) {
      await feature.onShutdown(connection, schemas, configuration);
    }
  });

  connection.listen();
};
