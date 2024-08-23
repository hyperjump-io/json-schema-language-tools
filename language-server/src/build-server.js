import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { removeMediaTypePlugin } from "@hyperjump/browser";

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
 *   load: (connection: Connection, documents: TextDocuments<TextDocument>) => void;
 *   onInitialize: (params: InitializeParams) => ServerCapabilities;
 *   onInitialized: (connection: Connection, documents: TextDocuments<TextDocument>) => Promise<void>;
 *   onShutdown: (connection: Connection, documents: TextDocuments<TextDocument>) => void;
 * }} Feature
 */

removeMediaTypePlugin("http");
removeMediaTypePlugin("https");

/** @type (connection: Connection, features: Feature[]) => void */
export const buildServer = (connection, features) => {
  const documents = new TextDocuments(TextDocument);

  for (const feature of features) {
    feature.load(connection, documents);
  }

  connection.onInitialize((params) => {
    connection.console.log("Initializing JSON Schema service ...");

    return {
      capabilities: features.reduce((serverCapabilities, feature) => {
        return { ...serverCapabilities, ...feature.onInitialize(params) };
      }, {})
    };
  });

  connection.onInitialized(async () => {
    for (const feature of features) {
      await feature.onInitialized(connection, documents);
    }
  });

  connection.onShutdown(() => {
    for (const feature of features) {
      feature.onShutdown(connection, documents);
    }
  });

  connection.listen();
  documents.listen(connection);
};
