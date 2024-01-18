// Language Server
import {
  createConnection,
  DiagnosticSeverity,
  DiagnosticTag,
  DidChangeWatchedFilesNotification,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

// Hyperjump
import { registerSchema, unregisterSchema, InvalidSchemaError, setMetaSchemaOutputFormat } from "@hyperjump/json-schema";
import { getSchema, buildSchemaDocument, compile, DETAILED } from "@hyperjump/json-schema/experimental";
import "@hyperjump/json-schema/draft-2020-12";
import "@hyperjump/json-schema/draft-2019-09";
import "@hyperjump/json-schema/draft-07";
import "@hyperjump/json-schema/draft-06";
import "@hyperjump/json-schema/draft-04";
import "@hyperjump/json-schema/openapi-3-0";
import "@hyperjump/json-schema/openapi-3-1";
import { annotate } from "@hyperjump/json-schema/annotations/experimental";

// Features
import { deprecatedNodes } from "./deprecated.js";
import { parser } from "./parser.js";
import { invalidNodes } from "./validation.js";

// Other
import { buildDiagnostic, getNode, waitUntil } from "./util.js";
import { addWorkspaceFolders, workspaceSchemas, removeWorkspaceFolders, watchWorkspace } from "./workspace.js";


setMetaSchemaOutputFormat(DETAILED);

const isSchema = RegExp.prototype.test.bind(/(?:\.|\/|^)schema\.json$/);

const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;

connection.onInitialize(({ capabilities, workspaceFolders }) => {
  connection.console.log("Initializing JSON Schema service ...");

  if (workspaceFolders) {
    addWorkspaceFolders(workspaceFolders);
  }

  hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
  hasWorkspaceWatchCapability = !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

  const serverCapabilities = {
    textDocumentSync: TextDocumentSyncKind.Incremental
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
  if (hasWorkspaceWatchCapability) {
    connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [
        { globPattern: "**/*.schema.json" },
        { globPattern: "**/schema.json" }
      ]
    });
  } else {
    watchWorkspace((eventType, filename) => {
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
        watchWorkspace((eventType, filename) => {
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

let schemaRegistry = {};

let isWorkspaceLoaded = false;
const validateWorkspace = async () => {
  connection.console.log("Validating workspace");

  const reporter = await connection.window.createWorkDoneProgress();
  reporter.begin("JSON Schema: Indexing workspace");
  isWorkspaceLoaded = false;

  // Register schemas
  schemaRegistry = {};
  for await (const [, schemaJson] of workspaceSchemas()) {
    try {
      const schema = JSON.parse(schemaJson);
      const schemaDocument = buildSchemaDocument(schema);
      schemaRegistry[schemaDocument.baseUri] = schemaDocument;
    } catch (error) {
      // Ignore errors
    }
  }

  // Re/validate all schemas
  for await (const [uri, schemaJson] of workspaceSchemas()) {
    await validateSchema(uri, schemaJson);
  }

  isWorkspaceLoaded = true;
  reporter.done();
};

connection.onDidChangeWatchedFiles(validateWorkspace);

connection.listen();

const documents = new TextDocuments(TextDocument);

documents.onDidChangeContent(async ({ document }) => {
  connection.console.log(`Schema changed: ${document.uri}`);

  if (isSchema(document.uri)) {
    await waitUntil(() => isWorkspaceLoaded);
    await validateSchema(document.uri, document.getText());
  }
});

const validateSchema = async (uri, schemaJson) => {
  const diagnostics = [];

  const tree = parser.parse(schemaJson);
  const schemaUri = uri.replace(/^file:/, "schema:");

  if (tree.rootNode.firstChild !== null && !tree.rootNode.hasError()) {
    try {
      const schema = JSON.parse(schemaJson);
      registerSchema(schema, schemaUri);

      const browser = await getSchema(schemaUri, { _cache: schemaRegistry });
      const dialectId = browser.document.dialectId;

      try {
        await compile(browser); // Validate the schema
        const instance = await annotate(dialectId, schema);

        for (const node of deprecatedNodes(instance, tree)) {
          diagnostics.push(buildDiagnostic(node, "deprecated", DiagnosticSeverity.Warning, [DiagnosticTag.Deprecated]));
        }
      } catch (error) {
        if (error instanceof InvalidSchemaError) {
          for await (const [node, message] of invalidNodes(error.output, dialectId, tree)) {
            diagnostics.push(buildDiagnostic(node, message));
          }
        } else {
          throw error;
        }
      }
    } catch (e) {
      const error = e.cause ?? e;

      if (error.message.startsWith("Encountered unknown dialect")) {
        diagnostics.push(buildDiagnostic(getNode(tree, "/$schema"), error.message));
      } else {
        diagnostics.push(buildDiagnostic(getNode(tree), error.message));
      }
    } finally {
      unregisterSchema(schemaUri);
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
};

documents.listen(connection);
