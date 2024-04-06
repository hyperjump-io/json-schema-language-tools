import { keywordNameFor } from "./json-schema.js";

/**
 * `$id` -> `document uri`
 * @type {Map<string, string>}
 */
const identifiers = new Map();

/**
 * `uri` -> `$id -> instance`
 * @type {Map<string, Map<string, import("./jsonc-instance").JsoncInstance>}
 */
const embeddedSchemaIdentifiers = new Map();

export const deleteIdentifiersForDocument = (uri) => {
  embeddedSchemaIdentifiers.delete(uri);
  identifiers.forEach((docUri) => {
    if (docUri === uri) {
      identifiers.delete(docUri);
      return;
    }
  });
};

/**
 * @param {import("./jsonc-instance").JsoncInstance} instance
 * @param {string} dialectUri
 */
export const addIdentifierForInstance = (instance, dialectUri) => {
  const idKeywordUri = "https://json-schema.org/keyword/id";
  const $id = instance.get(`#/${keywordNameFor(idKeywordUri, dialectUri)}`).node?.value;

  const { textDocument, node } = instance;

  if (node && node.offset !== 0) {
    if (!embeddedSchemaIdentifiers.has(textDocument.uri)) {
      embeddedSchemaIdentifiers.set(textDocument.uri, new Map());
    }
    embeddedSchemaIdentifiers.get(textDocument.uri).set($id, instance);
    return;
  }

  if ($id) {
    identifiers.set($id, textDocument.uri);
  } else {
    identifiers.set(textDocument.uri, textDocument.uri);
  }
};

/**
 * @param {string} $id
 */
export const getIdentifier = ($id) => {
  return identifiers.get($id);
};

/**
 * @param {string} uri
 * @param {string} $id
 */
export const getEmbeddedIdentifer = (uri, $id) => {
  return embeddedSchemaIdentifiers.get(uri)?.get($id);
};
