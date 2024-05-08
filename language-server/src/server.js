// Language Server
import { createConnection, ProposedFeatures, TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

// Hyperjump
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";

// Features
import documentSettingFeature from "./features/document-settings.js";
import schemaDocumentsFeature from "./features/schema-documents.js";
import workspaceFeature from "./features/workspace.js";
import semanticTokensFeature from "./features/semantic-tokens.js";
import validationErrorsFeature from "./features/validation-errors.js";
import deprecatedFeature from "./features/deprecated.js";
import completionFeature from "./features/completion.js";
import hoverFeature from "./features/hover.js";


const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

const documents = new TextDocuments(TextDocument);

const features = [
  documentSettingFeature,
  schemaDocumentsFeature,
  semanticTokensFeature,
  validationErrorsFeature,
  deprecatedFeature,
  completionFeature,
  hoverFeature,
  workspaceFeature // Workspace must be last
];

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
