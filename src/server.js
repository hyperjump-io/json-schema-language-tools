// Language Server
import {
  createConnection,
  DiagnosticSeverity,
  DiagnosticTag,
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
import { readdir, readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getNode } from "./util.js";


setMetaSchemaOutputFormat(DETAILED);

const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

connection.onInitialize(async ({ capabilities, workspaceFolders }) => {
  connection.console.log("Initializing JSON Schema service ...");

  if (workspaceFolders) {
    workspace = workspaceFolders;
  }

  watchWorkspace();
  await registerWorkspaceSchemas();
  await validateWorkspace();

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

connection.listen();

const documents = new TextDocuments(TextDocument);

documents.onDidChangeContent(async ({ document }) => {
  connection.console.log(`Schema changed: ${document.uri}`);

  await validateSchema(document.uri, document.getText());
});

let schemaRegistry = {};

const registerWorkspaceSchemas = async () => {
  schemaRegistry = {};

  for await (const [, schemaJson] of allSchemas()) {
    try {
      const schema = JSON.parse(schemaJson);
      const schemaDocument = buildSchemaDocument(schema);
      schemaRegistry[schemaDocument.baseUri] = schemaDocument;
    } catch (error) {
      // Ignore errors
    }
  }
};

const validateWorkspace = async () => {
  for await (const [uri, schemaJson] of allSchemas()) {
    await validateSchema(uri, schemaJson);
  }
};

const validateSchema = async (uri, schemaJson) => {
  const diagnostics = [];

  const tree = parser.parse(schemaJson);
  const schemUri = uri.replace(/^file:/, "schema:");

  if (tree.rootNode.firstChild !== null && !tree.rootNode.hasError()) {
    try {
      const schema = JSON.parse(schemaJson);
      registerSchema(schema, schemUri);

      const browser = await getSchema(schemUri, { _cache: schemaRegistry });
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
      unregisterSchema(schemUri);
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
};

const buildDiagnostic = (node, message, severity = DiagnosticSeverity.Error, tags = []) => {
  return {
    severity: severity,
    tags: tags,
    range: {
      start: { line: node.startPosition.row, character: node.startPosition.column },
      end: { line: node.endPosition.row, character: node.endPosition.column }
    },
    message: message,
    source: "json-schema"
  };
};

let workspace = [];

const allSchemas = async function* () {
  for (const { uri } of workspace) {
    const path = fileURLToPath(uri);

    for (const filename of await readdir(path, { recursive: true })) {
      if (!filename.endsWith(".schema.json")) {
        continue;
      }

      const schemaPath = resolve(path, filename);
      const schemaText = await readFile(schemaPath, "utf8");

      if (schemaText.trim() === "") {
        continue;
      }

      yield [pathToFileURL(schemaPath).toString(), schemaText];
    }
  }
};

let watcher;

const watchWorkspace = () => {
  if (watcher) {
    watcher.close();
  }

  for (const { uri } of workspace) {
    const path = fileURLToPath(uri);
    watcher = watch(path, { recursive: true }, async () => {
      await registerWorkspaceSchemas();
      await validateWorkspace();
    });
  }
};

documents.listen(connection);
