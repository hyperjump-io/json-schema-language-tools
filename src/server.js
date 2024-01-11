// Language Server
import {
  createConnection,
  DiagnosticSeverity,
  DiagnosticTag,
  ProposedFeatures,
  TextDocuments
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

// Tree-sitter
import Parser from "tree-sitter";
import Json from "tree-sitter-json";

// Hyperjump
import * as Browser from "@hyperjump/browser";
import { registerSchema, unregisterSchema, InvalidSchemaError, setMetaSchemaOutputFormat } from "@hyperjump/json-schema";
import { getSchema, compile, DETAILED } from "@hyperjump/json-schema/experimental";
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
import { getNode } from "./util.js";
import { invalidNodes } from "./validation.js";


setMetaSchemaOutputFormat(DETAILED);

const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

connection.onInitialize(() => {
  connection.console.log("Initializing JSON Schema service ...");

  return {};
});

connection.listen();

const documents = new TextDocuments(TextDocument);
const parser = new Parser();
parser.setLanguage(Json);

documents.onDidChangeContent(async ({ document }) => {
  connection.console.log(`Schema changed: ${document.uri}`);

  if (!document.uri.endsWith(".schema.json")) {
    return;
  }

  const diagnostics = [];
  const tree = parser.parse(document.getText());
  if (!tree.rootNode.hasError()) {
    try {
      const uri = document.uri.replace(/^file:/, "schema:");
      const schemaJson = JSON.parse(document.getText());
      unregisterSchema(uri);
      registerSchema(schemaJson, uri);

      const schema = await getSchema(uri);

      try {
        await compile(schema); // Validate the schema

        const instance = await annotate(schema.document.dialectId, Browser.value(schema));

        for (const node of deprecatedNodes(instance, tree)) {
          diagnostics.push(buildDiagnostic(node, "deprecated", DiagnosticSeverity.Warning, [DiagnosticTag.Deprecated]));
        }
      } catch (error) {
        if (error instanceof InvalidSchemaError) {
          for await (const [node, message] of invalidNodes(error.output, schema.document.dialectId, tree)) {
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
    }
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics });
});

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

documents.listen(connection);
