import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * documentStore for inactive documents
 *
 * `uri` => `TextDocument`
 * @type {Map<string, TextDocument}
 */
const inactiveDocumentStore = new Map();

/**
 * @param {import("vscode-languageserver").TextDocuments<TextDocument>} documents
 * @param {string} uri
 * @returns {Promise<TextDocument>}
 */
export const fetchDocument = async (documents, uri) => {
  if (inactiveDocumentStore.has(uri)) {
    return inactiveDocumentStore.get(uri);
  }

  let textDocument = documents.get(uri);

  if (!textDocument) {
    const instanceJson = await readFile(fileURLToPath(uri), "utf8");
    textDocument = TextDocument.create(uri, "json", -1, instanceJson);
    inactiveDocumentStore.set(uri, textDocument);
  }
  return textDocument;
};

/**
 * @param {import("vscode-languageserver").TextDocuments<TextDocument>} documents
 */
export const doesDocumentExist = (documents, uri) => {
  return documents.keys().includes(uri) || inactiveDocumentStore.has(uri);
};

/**
 * @param {string} uri
 */
export const deleteFromInactiveDocumentStore = (uri) => {
  return inactiveDocumentStore.delete(uri);
};
