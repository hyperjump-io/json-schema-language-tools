// Language Server
import {
  createConnection,
  DiagnosticSeverity,
  DiagnosticTag,
  DidChangeWatchedFilesNotification,
  ProposedFeatures,
  DidChangeConfigurationNotification,
  SemanticTokensBuilder,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

// Hyperjump
import { setMetaSchemaOutputFormat, setShouldValidateSchema } from "@hyperjump/json-schema";
import { hasDialect, DETAILED } from "@hyperjump/json-schema/experimental";
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";

// Other
import { decomposeSchemaDocument, validate } from "./json-schema.js";
import { JsoncInstance } from "./jsonc-instance.js";
import { invalidNodes } from "./validation.js";
import { addWorkspaceFolders, workspaceSchemas, removeWorkspaceFolders, watchWorkspace, waitUntil } from "./workspace.js";
import { getSemanticTokens } from "./semantic-tokens.js";


setMetaSchemaOutputFormat(DETAILED);
setShouldValidateSchema(false);

const isSchema = RegExp.prototype.test.bind(/(?:\.|\/|^)schema\.json$/);

const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;
let hasConfigurationCapability = false;

connection.onInitialize(({ capabilities, workspaceFolders }) => {
  connection.console.log("Initializing JSON Schema service ...");
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  if (workspaceFolders) {
    addWorkspaceFolders(workspaceFolders);
  }

  hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
  hasWorkspaceWatchCapability = !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

  const serverCapabilities = {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    semanticTokensProvider: {
      legend: buildSemanticTokensLegend(capabilities.textDocument?.semanticTokens),
      range: false,
      full: {
        delta: true
      }
    }
  };

  if (capabilities.workspace?.workspaceFolders) {
    serverCapabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return { capabilities: serverCapabilities };
});

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type);
  }

  if (hasWorkspaceWatchCapability) {
    connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [
        { globPattern: "**/*.schema.json" },
        { globPattern: "**/schema.json" }
      ]
    });
  } else {
    watchWorkspace((_eventType, filename) => {
      if (isSchema(filename)) {
        validateWorkspace();
      }
    });
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
      addWorkspaceFolders(added);
      removeWorkspaceFolders(removed);

      if (!hasWorkspaceWatchCapability) {
        watchWorkspace((_eventType, filename) => {
          if (isSchema(filename)) {
            validateWorkspace();
          }
        });
      }

      await validateWorkspace();
    });
  }

  await validateWorkspace();
});

let isWorkspaceLoaded = false;
const validateWorkspace = async () => {
  connection.console.log("Validating workspace");

  const reporter = await connection.window.createWorkDoneProgress();
  reporter.begin("JSON Schema: Indexing workspace");
  isWorkspaceLoaded = false;

  // Re/validate all schemas
  for await (const uri of workspaceSchemas()) {
    if (isSchema(uri)) {
      const textDocument = documents.get(uri);
      if (textDocument) {
        await validateSchema(textDocument);
      }
    }
  }

  isWorkspaceLoaded = true;
  reporter.done();
};

connection.onDidChangeWatchedFiles(validateWorkspace);

connection.listen();

const documents = new TextDocuments(TextDocument);

// CONFIGURATION

const documentSettings = new Map();
let globalSettings = {};

async function getDocumentSettings(resource) {
  if (!hasConfigurationCapability) {
    return globalSettings;
  }

  if (!documentSettings.has(resource)) {
    const result = await connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "jsonSchemaLanguageServer"
    });
    documentSettings.set(resource, result ?? globalSettings);
  }

  return documentSettings.get(resource);
}

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = change.settings.jsonSchemaLanguageServer ?? globalSettings;
  }

  validateWorkspace();
});

// INLINE ERRORS

documents.onDidChangeContent(async ({ document }) => {
  connection.console.log(`Schema changed: ${document.uri}`);

  if (isSchema(document.uri)) {
    await waitUntil(() => isWorkspaceLoaded);
    await validateSchema(document);
  }
});

const validateSchema = async (document) => {
  const diagnostics = [];

  const settings = await getDocumentSettings(document.uri);
  const instance = JsoncInstance.fromTextDocument(document);
  if (instance.typeOf() === "undefined") {
    return;
  }

  const $schema = instance.get("#/$schema");
  const contextDialectUri = $schema.value() ?? settings.defaultDialect;
  const schemaResources = decomposeSchemaDocument(instance, contextDialectUri);
  for (const { dialectUri, schemaInstance } of schemaResources) {
    if (!hasDialect(dialectUri)) {
      const $schema = schemaInstance.get("#/$schema");
      if ($schema.typeOf() === "string") {
        diagnostics.push(buildDiagnostic($schema, "Unknown dialect"));
      } else {
        diagnostics.push(buildDiagnostic(schemaInstance, "No dialect"));
      }

      continue;
    }

    const [output, annotations] = await validate(dialectUri, schemaInstance);

    if (!output.valid) {
      for await (const [instance, message] of invalidNodes(output)) {
        diagnostics.push(buildDiagnostic(instance, message));
      }
    }

    const deprecations = annotations.annotatedWith("deprecated");
    for (const deprecated of deprecations) {
      if (deprecated.annotation("deprecated").some((deprecated) => deprecated)) {
        const message = deprecated.annotation("x-deprecationMessage").join("\n") || "deprecated";
        diagnostics.push(buildDiagnostic(deprecated.parent(), message, DiagnosticSeverity.Warning, [DiagnosticTag.Deprecated]));
      }
    }
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics });
};

const buildDiagnostic = (instance, message, severity = DiagnosticSeverity.Error, tags = []) => {
  return {
    severity: severity,
    tags: tags,
    range: {
      start: instance.startPosition(),
      end: instance.endPosition()
    },
    message: message,
    source: "json-schema"
  };
};

// SEMANTIC TOKENS

const semanticTokensLegend = {
  tokenTypes: {},
  tokenModifiers: {}
};

const buildSemanticTokensLegend = (capability) => {
  const clientTokenTypes = new Set(capability.tokenTypes);
  const serverTokenTypes = [
    "property",
    "keyword",
    "comment",
    "string",
    "regexp"
  ];

  const tokenTypes = [];
  for (const tokenType of serverTokenTypes) {
    if (clientTokenTypes.has(tokenType)) {
      semanticTokensLegend.tokenTypes[tokenType] = tokenTypes.length;
      tokenTypes.push(tokenType);
    }
  }

  const clientTokenModifiers = new Set(capability.tokenModifiers);
  const serverTokenModifiers = [
  ];

  const tokenModifiers = [];
  for (const tokenModifier of serverTokenModifiers) {
    if (clientTokenModifiers.has(tokenModifier)) {
      semanticTokensLegend.tokenModifiers[tokenModifier] = tokenModifiers.length;
      tokenModifiers.push(tokenModifier);
    }
  }

  return { tokenTypes, tokenModifiers };
};

const tokenBuilders = new Map();
documents.onDidClose((event) => {
  tokenBuilders.delete(event.document.uri);
});

const getTokenBuilder = (uri) => {
  let result = tokenBuilders.get(uri);
  if (result !== undefined) {
    return result;
  }

  result = new SemanticTokensBuilder();
  tokenBuilders.set(uri, result);

  return result;
};

const buildTokens = (builder, document, settings) => {
  const instance = JsoncInstance.fromTextDocument(document);
  const $schema = instance.get("#/$schema");
  const dialectUri = $schema.value ?? settings.defaultDialect;
  const schemaResources = decomposeSchemaDocument(instance, dialectUri);
  for (const { keywordInstance, tokenType, tokenModifier } of getSemanticTokens(schemaResources)) {
    const startPosition = keywordInstance.startPosition();
    builder.push(
      startPosition.line,
      startPosition.character,
      keywordInstance.textLength(),
      semanticTokensLegend.tokenTypes[tokenType] ?? 0,
      semanticTokensLegend.tokenModifiers[tokenModifier] ?? 0
    );
  }
};

connection.languages.semanticTokens.on(async ({ textDocument }) => {
  connection.console.log(`semanticTokens.on: ${textDocument.uri}`);

  if (isSchema(textDocument.uri)) {
    const builder = getTokenBuilder(textDocument.uri);
    const document = documents.get(textDocument.uri);
    const settings = await getDocumentSettings(document.uri);
    buildTokens(builder, document, settings);

    return builder.build();
  } else {
    return { data: [] };
  }
});

connection.languages.semanticTokens.onDelta(async ({ textDocument, previousResultId }) => {
  connection.console.log(`semanticTokens.onDelta: ${textDocument.uri}`);

  const document = documents.get(textDocument.uri);
  const settings = await getDocumentSettings(document.uri);
  if (document === undefined) {
    return { edits: [] };
  }

  const builder = getTokenBuilder(document);
  builder.previousResult(previousResultId);
  buildTokens(builder, document, settings);

  return builder.buildEdits();
});

documents.listen(connection);
