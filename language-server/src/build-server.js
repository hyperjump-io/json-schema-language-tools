import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

// Hyperjump
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";


export const buildServer = (connection, features) => {
  const documents = new TextDocuments(TextDocument);

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
      feature.onInitialized(connection, documents);
    }
  });

  connection.listen();
  documents.listen(connection);
};
