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
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";
import { getDialectIds } from "@hyperjump/json-schema/experimental";

// Other
import { invalidNodes } from "./validation.js";
import { addWorkspaceFolders, workspaceSchemas, removeWorkspaceFolders, watchWorkspace } from "./workspace.js";
import { getSemanticTokens } from "./semantic-tokens.js";
import { JsonSchemaDocument } from "./json-schema-document.js";
import * as Instance from "./json-instance.js";


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

const schemaDocuments = new Map();

const getSchemaDocument = async (textDocument) => {
  let { version, schemaDocument } = schemaDocuments.get(textDocument.uri) ?? {};

  if (version !== textDocument.version) {
    const settings = await getDocumentSettings(textDocument.uri);
    schemaDocument = await JsonSchemaDocument.fromTextDocument(textDocument, settings.defaultDialect);

    if (textDocument.version !== -1) {
      schemaDocuments.set(textDocument.uri, { version: textDocument.version, schemaDocument });
    }
  }

  return schemaDocument;
};

documents.onDidClose(({ document }) => {
  schemaDocuments.delete(document.uri);
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
  if (isSchema(document.uri)) {
    await validateSchema(document);
  }
});

const validateSchema = async (textDocument) => {
  connection.console.log(`Schema Validation: ${textDocument.uri}`);

  const diagnostics = [];

  const schemaDocument = await getSchemaDocument(textDocument);
  for await (const [instance, message] of invalidNodes(schemaDocument.errors)) {
    diagnostics.push(buildDiagnostic(textDocument, instance, message));
  }

  for (const deprecated of schemaDocument.annotatedWith("deprecated")) {
    if (Instance.annotation(deprecated, "deprecated").some((deprecated) => deprecated)) {
      const message = Instance.annotation(deprecated, "x-deprecationMessage").join("\n") || "deprecated";
      diagnostics.push(buildDiagnostic(textDocument, deprecated.parent, message, DiagnosticSeverity.Warning, [DiagnosticTag.Deprecated]));
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
};

const buildDiagnostic = (textDocument, node, message, severity = DiagnosticSeverity.Error, tags = []) => {
  return {
    severity: severity,
    tags: tags,
    range: {
      start: textDocument.positionAt(node.offset),
      end: textDocument.positionAt(node.offset + node.textLength)
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
  const schemaDocument = await getSchemaDocument(textDocument);
  const semanticTokens = getSemanticTokens(schemaDocument);
  for (const { keywordInstance, tokenType, tokenModifier } of sortSemanticTokens(semanticTokens, textDocument)) {
    const startPosition = textDocument.positionAt(keywordInstance.offset);
    builder.push(
      startPosition.line,
      startPosition.character,
      keywordInstance.textLength,
      semanticTokensLegend.tokenTypes[tokenType] ?? 0,
      semanticTokensLegend.tokenModifiers[tokenModifier] ?? 0
    );
  }
};

// VSCode requires this list to be in order. Neovim doesn't care.
const sortSemanticTokens = (semanticTokens, textDocument) => {
  return [...semanticTokens].sort((a, b) => {
    const aStartPosition = textDocument.positionAt(a.keywordInstance.offset);
    const bStartPosition = textDocument.positionAt(b.keywordInstance.offset);

    return aStartPosition.line === bStartPosition.line
      ? aStartPosition.character - bStartPosition.character
      : aStartPosition.line - bStartPosition.line;
  });
};

connection.languages.semanticTokens.on(async ({ textDocument }) => {
  if (!isSchema(textDocument.uri)) {
    return { data: [] };
  }

  const builder = getTokenBuilder(textDocument.uri);
  await buildTokens(builder, textDocument.uri);

  return builder.build();
});

connection.languages.semanticTokens.onDelta(async ({ textDocument, previousResultId }) => {
  const builder = getTokenBuilder(textDocument.uri);
  builder.previousResult(previousResultId);
  await buildTokens(builder, textDocument.uri);

  return builder.buildEdits();
});

// $SCHEMA COMPLETION

connection.onCompletion(async ({ textDocument, position }) => {
  const document = documents.get(textDocument.uri);
  const schemaDocument = await getSchemaDocument(document);
  const offset = document.offsetAt(position);
  const currentProperty = schemaDocument.findNodeAtOffset(offset);
  if (currentProperty.pointer.endsWith("/$schema")) {
    return getDialectIds().map((uri) => {
      return {
        label: shouldHaveTrailingHash(uri) ? `${uri}#` : uri,
        kind: CompletionItemKind.Value
      };
    });
  }
});

const trailingHashDialects = new Set([
  "http://json-schema.org/draft-04/schema",
  "http://json-schema.org/draft-06/schema",
  "http://json-schema.org/draft-07/schema"
]);
const shouldHaveTrailingHash = (uri) => trailingHashDialects.has(uri);

// KEYWORD HOVER

connection.onHover(async ({ textDocument, position }) => {
  const document = documents.get(textDocument.uri);
  const schemaDocument = await getSchemaDocument(document);
  const offset = document.offsetAt(position);
  const keyword = schemaDocument.findNodeAtOffset(offset);

  // This is a little wierd because we want the hover to be on the keyword, but
  // the annotation is actually on the value not the keyword.
  if (keyword.parent && Instance.typeOf(keyword.parent) === "property" && keyword.parent.children[0] === keyword) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: Instance.annotation(keyword.parent.children[1], "description").join("\n")
      },
      range: {
        start: document.positionAt(keyword.offset),
        end: document.positionAt(keyword.offset + keyword.textLength)
      }
    };
  }
});

connection.listen();
documents.listen(connection);
