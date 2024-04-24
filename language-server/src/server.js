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
  TextDocumentSyncKind,
  CompletionItemKind,
  FileChangeType,
  MarkupKind
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Hyperjump
import { setMetaSchemaOutputFormat, setShouldValidateSchema } from "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";
import { hasDialect, DETAILED, getDialectIds } from "@hyperjump/json-schema/experimental";
import { ValidationError } from "@hyperjump/json-schema/annotations/experimental";

// Other
import { annotate, decomposeSchemaDocument } from "./json-schema.js";
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
    },
    completionProvider: {
      resolveProvider: false,
      triggerCharacters: ["\"", ":", " "]
    },
    hoverProvider: true
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
    watchWorkspace(onWorkspaceChange, isSchema);
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
      addWorkspaceFolders(added);
      removeWorkspaceFolders(removed);

      if (!hasWorkspaceWatchCapability) {
        watchWorkspace(onWorkspaceChange, isSchema);
      }

      await validateWorkspace({ changes: [] });
    });
  }

  await validateWorkspace({ changes: [] });
});

// WORKSPACE

const validateWorkspace = async () => {
  connection.console.log("Validating workspace");

  const reporter = await connection.window.createWorkDoneProgress();
  reporter.begin("JSON Schema: Indexing workspace");

  // Re/validate all schemas
  for await (const uri of workspaceSchemas(isSchema)) {
    let textDocument = documents.get(uri);
    if (!textDocument) {
      const instanceJson = await readFile(fileURLToPath(uri), "utf8");
      textDocument = TextDocument.create(uri, "json", -1, instanceJson);
    }

    await validateSchema(textDocument);
  }

  reporter.done();
};

const onWorkspaceChange = (eventType, filename) => {
  // eventType === "rename" means file added or deleted (on most platforms?)
  // eventType === "change" means file saved
  // filename is not always available (when is it not available?)
  validateWorkspace({
    changes: [
      {
        uri: filename,
        type: eventType === "change" ? FileChangeType.Changed : FileChangeType.Deleted
      }
    ]
  });
};

connection.onDidChangeWatchedFiles(validateWorkspace);

// MANAGED INSTANCES

const schemaResourceCache = new Map();

const getSchemaResources = async (textDocument) => {
  let { version, schemaResources } = schemaResourceCache.get(textDocument.uri) ?? {};

  if (version !== textDocument.version) {
    const instance = JsoncInstance.fromTextDocument(textDocument);
    const settings = await getDocumentSettings(instance.textDocument.uri);
    const contextDialectUri = instance.get("#/$schema").value() ?? settings.defaultDialect;
    schemaResources = [...decomposeSchemaDocument(instance, contextDialectUri)];

    if (textDocument.version !== -1) {
      schemaResourceCache.set(textDocument.uri, { version: textDocument.version, schemaResources });
    }
  }

  return schemaResources;
};

documents.onDidClose(({ document }) => {
  schemaResourceCache.delete(document.uri);
});

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

  await validateWorkspace({ changes: [] });
});

documents.onDidClose(({ document }) => {
  documentSettings.delete(document.uri);
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

  for (const { dialectUri, schemaInstance } of await getSchemaResources(textDocument)) {
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

    try {
      const annotatedInstance = await annotate(dialectUri, schemaInstance);

      for (const deprecated of annotatedInstance.annotatedWith("deprecated")) {
        if (deprecated.annotation("deprecated").some((deprecated) => deprecated)) {
          const message = deprecated.annotation("x-deprecationMessage").join("\n") || "deprecated";
          diagnostics.push(buildDiagnostic(deprecated.parent(), message, DiagnosticSeverity.Warning, [DiagnosticTag.Deprecated]));
        }
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        for await (const [instance, message] of invalidNodes(schemaInstance, error.output)) {
          diagnostics.push(buildDiagnostic(instance, message));
        }
      } else {
        throw error;
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

documents.onDidClose(({ document }) => {
  tokenBuilders.delete(document.uri);
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

// $SCHEMA COMPLETION

connection.onCompletion(async ({ textDocument, position }) => {
  const document = documents.get(textDocument.uri);
  for (const { schemaInstance } of await getSchemaResources(document)) {
    const currentProperty = schemaInstance.getInstanceAtPosition(position);
    if (currentProperty.pointer.endsWith("/$schema")) {
      return getDialectIds().map((uri) => {
        return {
          label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
          kind: CompletionItemKind.Value
        };
      });
    }
  }
});

const trailingHashDialects = new Set([
  "http://json-schema.org/draft-04/schema",
  "http://json-schema.org/draft-06/schema",
  "http://json-schema.org/draft-07/schema"
]);
const shouldHaveTrailingHash = (uri) => trailingHashDialects.has(uri);

// KEYWORD HOVER

connection.onHover(async (textDocumentPositionParams) => {
  const { textDocument: { uri: textDocumentURI }, position } = textDocumentPositionParams;
  const document = documents.get(textDocumentURI);

  const schemaResources = await getSchemaResources(document);
  for (const { dialectUri, schemaInstance } of schemaResources) {
    if (!hasDialect(dialectUri)) {
      continue;
    }

    try {
      const annotations = await annotate(dialectUri, schemaInstance);
      const keyword = annotations.getInstanceAtPosition(position);
      if (keyword.typeOf() !== "undefined") {
        // Found
        const description = keyword.annotation("description", dialectUri).join("\n");
        return buildHover(MarkupKind.Markdown, description, keyword.startPosition(), keyword.endPosition());
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return null;
      }
    }
  }
});

const buildHover = (kind, value, startPosition, endPosition) => {
  return {
    contents: { kind, value },
    range: {
      start: startPosition,
      end: endPosition
    }
  };
};

connection.listen();
documents.listen(connection);
