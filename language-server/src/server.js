// Language Server
import { createConnection, ProposedFeatures } from "vscode-languageserver/node.js";
import { buildServer } from "./build-server.js";

// Features
import documentSettingFeature from "./features/document-settings.js";
import schemaRegistryFeature from "./features/schema-registry.js";
import workspaceFeature from "./features/workspace.js";
import semanticTokensFeature from "./features/semantic-tokens.js";
import validationErrorsFeature from "./features/validation-errors.js";
import validateReferencesFeature from "./features/validate-references.js";
import deprecatedFeature from "./features/deprecated.js";
import completionFeature from "./features/completion.js";
import ifThenCompletionFeature from "./features/if-then-completion.js";
import schemaCompletion from "./features/schema-completion.js";
import hoverFeature from "./features/hover.js";


const features = [
  documentSettingFeature,
  schemaRegistryFeature,
  semanticTokensFeature,
  validationErrorsFeature,
  validateReferencesFeature,
  deprecatedFeature,
  completionFeature,
  schemaCompletion,
  ifThenCompletionFeature,
  hoverFeature,
  workspaceFeature // Workspace must be last
];

const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

buildServer(connection, features);
