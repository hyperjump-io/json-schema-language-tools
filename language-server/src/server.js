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
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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
import { addWorkspaceFolders, workspaceSchemas, removeWorkspaceFolders, watchWorkspace } from "./workspace.js";
import { getSemanticTokens } from "./semantic-tokens.js";


setMetaSchemaOutputFormat(DETAILED);
setShouldValidateSchema(false);

const isSchema = RegExp.prototype.test.bind(/(?:\.|\/|^)schema\.json$/);

const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

const documents = new TextDocuments(TextDocument);

let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;
let hasConfigurationCapability = false;
let hasDidChangeConfigurationCapability = false;

connection.onInitialize(({ capabilities, workspaceFolders }) => {
  connection.console.log("Initializing JSON Schema service ...");

  hasConfigurationCapability = !!capabilities.workspace?.configuration;
  hasDidChangeConfigurationCapability = !!capabilities.workspace?.didChangeConfiguration?.dynamicRegistration;

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

  if (hasWorkspaceFolderCapability) {
    serverCapabilities.workspace = {
      workspaceFolders: {
        supported: true,
        changeNotifications: true
      }
    };
  }

  return { capabilities: serverCapabilities };
});

connection.onInitialized(async () => {
  if (hasDidChangeConfigurationCapability) {
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

// WORKSPACE

const validateWorkspace = async () => {
  connection.console.log("Validating workspace");

  const reporter = await connection.window.createWorkDoneProgress();
  reporter.begin("JSON Schema: Indexing workspace");

  // Re/validate all schemas
  for await (const uri of workspaceSchemas()) {
    if (isSchema(uri)) {
      let textDocument = documents.get(uri);
      if (!textDocument) {
        const instanceJson = await readFile(fileURLToPath(uri), "utf8");
        textDocument = TextDocument.create(uri, "json", -1, instanceJson);
      }

      await validateSchema(textDocument);
    }
  }

  reporter.done();
};

connection.onDidChangeWatchedFiles(validateWorkspace);

// MANAGED INSTANCES

const instances = new Map();

const getSchemaResources = async (textDocument) => {
  const key = `${textDocument.uri}|${textDocument.version}`;

  if (textDocument.version === -1 || !instances.has(key)) {
    const instance = JsoncInstance.fromTextDocument(textDocument);
    const settings = await getDocumentSettings(instance.textDocument.uri);
    const contextDialectUri = instance.get("#/$schema").value() ?? settings.defaultDialect;
    const schemaResources = [...decomposeSchemaDocument(instance, contextDialectUri)];
    instances.set(key, schemaResources);
  }

  return instances.get(key);
};

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

connection.onDidChangeConfiguration(async (change) => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = change.settings.jsonSchemaLanguageServer ?? globalSettings;
  }

  await validateWorkspace();
});

// INLINE ERRORS

documents.onDidChangeContent(async ({ document }) => {
  connection.console.log(`Schema changed: ${document.uri}`);

  if (isSchema(document.uri)) {
    await validateSchema(document);
  }
});

const validateSchema = async (textDocument) => {
  connection.console.log(`Schema Validation: ${textDocument.uri}`);

  const diagnostics = [];

  const schemaResources = await getSchemaResources(textDocument);
  for (const { dialectUri, schemaInstance } of schemaResources) {
    if (schemaInstance.typeOf() === "undefined") {
      continue;
    }

    if (!hasDialect(dialectUri)) {
      const $schema = schemaInstance.get("#/$schema");
      if ($schema.typeOf() === "string") {
        diagnostics.push(buildDiagnostic($schema, "Unknown dialect"));
      } else if (dialectUri) {
        diagnostics.push(buildDiagnostic(schemaInstance, "Unknown dialect"));
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

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
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
  if (!tokenBuilders.has(uri)) {
    tokenBuilders.set(uri, new SemanticTokensBuilder());
  }

  return tokenBuilders.get(uri);
};

const buildTokens = async (builder, uri) => {
  const textDocument = documents.get(uri);
  const schemaResources = await getSchemaResources(textDocument);
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

  if (!isSchema(textDocument.uri)) {
    return { data: [] };
  }

  const builder = getTokenBuilder(textDocument.uri);
  await buildTokens(builder, textDocument.uri);

  return builder.build();
});

connection.languages.semanticTokens.onDelta(async ({ textDocument, previousResultId }) => {
  connection.console.log(`semanticTokens.onDelta: ${textDocument.uri}`);

  const builder = getTokenBuilder(textDocument.uri);
  builder.previousResult(previousResultId);
  await buildTokens(builder, textDocument.uri);

  return builder.buildEdits();
});

connection.listen();
documents.listen(connection);
