import { readFile } from "fs/promises";
import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import { promises } from "node:fs";
/**
 * @param {import("vscode-languageserver").TextDocuments<TextDocument>} documents
 * @param {string} uri
 * @returns {Promise<TextDocument>}
 */
export const fetchDocument = async (documents, uri) => {
  let textDocument = documents.get(uri);

  if (!textDocument) {
    const instanceJson = await readFile(fileURLToPath(uri), "utf8");
    textDocument = TextDocument.create(uri, "json", -1, instanceJson);
  }
  return textDocument;
};

export const doesDocumentExists = async (path) => !!await promises.stat(fileURLToPath(path)).catch(() => false);
