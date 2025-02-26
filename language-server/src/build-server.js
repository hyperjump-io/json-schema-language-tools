// Services
import { Server } from "./services/server.js";
import { Configuration } from "./services/configuration.js";
import { Schemas } from "./services/schemas.js";

// Features
import { CompletionFeature } from "./features/completion/completion.js";
import { DiagnosticsFeature } from "./features/diagnostics/diagnostics.js";
import { GotoDefinitionFeature } from "./features/goto-definition.js";
import { FindReferencesFeature } from "./features/find-references.js";
import { HoverFeature } from "./features/hover.js";
import { SemanticTokensFeature } from "./features/semantic-tokens.js";
import { ValidateSchemaFeature } from "./features/validate-schema.js";
import { ValidateWorkspaceFeature } from "./features/validate-workspace.js";

// Diagnostics
import { DeprecatedDiagnosticsProvider } from "./features/diagnostics/deprecated.js";
import { ValidateReferencesDiagnosticsProvider } from "./features/diagnostics/validate-references.js";
import { ValidationErrorsDiagnosticsProvider } from "./features/diagnostics/validation-errors.js";

// Completions
import { IfThenCompletionProvider } from "./features/completion/if-then-completion.js";
import { KeywordCompletionProvider } from "./features/completion/keyword-completion.js";
import { SchemaCompletionProvider } from "./features/completion/schema-completion.js";
import { ExtractSubSchemaToDefs } from "./features/codeAction/extractSubschema.js";

// Hyperjump
import { removeMediaTypePlugin } from "@hyperjump/browser";
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";

/**
 * @import { Connection } from "vscode-languageserver"
 */


removeMediaTypePlugin("http");
removeMediaTypePlugin("https");

/** @type (connection: Connection) => Server */
export const buildServer = (connection) => {
  const server = new Server(connection);
  const configuration = new Configuration(server);
  const schemas = new Schemas(server, configuration);

  new SemanticTokensFeature(server, schemas, configuration);
  new GotoDefinitionFeature(server, schemas);
  new FindReferencesFeature(server, schemas);
  new HoverFeature(server, schemas);
  new ExtractSubSchemaToDefs(server, schemas, configuration);

  // TODO: It's awkward that diagnostics needs a variable
  const diagnostics = new DiagnosticsFeature(server, [
    new DeprecatedDiagnosticsProvider(),
    new ValidationErrorsDiagnosticsProvider(),
    new ValidateReferencesDiagnosticsProvider(schemas)
  ]);

  // TODO: It's awkward that validateSchema needs a variable
  const validateSchema = new ValidateSchemaFeature(server, schemas, diagnostics);
  new ValidateWorkspaceFeature(server, schemas, configuration, validateSchema);

  new CompletionFeature(server, schemas, [
    new SchemaCompletionProvider(),
    new IfThenCompletionProvider(),
    new KeywordCompletionProvider()
  ]);

  return server;
};
