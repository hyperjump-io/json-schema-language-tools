import { DiagnosticSeverity } from "vscode-languageserver";
import { readFile } from "node:fs/promises";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";


export const toAbsoluteUri = (uri) => uri.replace(/#.*$/, "");

/**
 * @param {import("./jsonc-instance").JsoncInstance} instance
 * @param {string} message
 * @param {DiagnosticSeverity} severity
 * @param {Array<string>} tags
 * @returns {import("vscode-languageserver").Diagnostic}
 */
export const buildDiagnostic = (
  instance,
  message,
  severity = DiagnosticSeverity.Error,
  tags = []
) => {
  return {
    severity,
    tags,
    range: {
      start: instance.startPosition(),
      end: instance.endPosition()
    },
    message,
    source: "json-schema"
  };
};

/**
 * @param {import("vscode-languageserver").TextDocuments<TextDocument>} documents
 * @param {string} uri
 * @returns {Promise<TextDocument>}
 */
export const fetchFile = async (documents, uri) => {
  let textDocument = documents.get(uri);
  if (!textDocument) {
    const instanceJson = await readFile(fileURLToPath(uri), "utf8");
    textDocument = TextDocument.create(uri, "json", -1, instanceJson);
  }
  return textDocument;
};

export const isAbsoluteUrl = RegExp.prototype.test.bind(/^https?:\/\/*/);
export const isSchema = RegExp.prototype.test.bind(/(?:\.|\/|^)schema\.json$/);
export const isAnchor = RegExp.prototype.test.bind(/^[A-Za-z][A-Za-z0-9\-_,:.]*$/);
