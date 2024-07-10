import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

// Hyperjump
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";

/** @import * as Type from "./build-server.js" */


/** @type Type.buildServer */
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
