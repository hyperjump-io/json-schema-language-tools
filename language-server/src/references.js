import { fetchDocument } from "./documents.js";
import { getEmbeddedIdentifer, getIdentifier } from "./identifiers.js";
import { keywordNameFor } from "./json-schema.js";
import { JsoncInstance } from "./jsonc-instance.js";
import { getSemanticTokens } from "./semantic-tokens.js";
import { getSchemaResources, workspaceUri } from "./server.js";
import { isAbsoluteUrl, isAnchor } from "./util.js";
import { dirname, join } from "node:path";
import { pathToFileURL, resolve } from "node:url";

/**
 * `documentUri` -> `ref -> instance`
 * @type {Map<string, Map<string, import("./jsonc-instance.js").JsoncInstance>}
 */
export const references = new Map();

/**
 * @param {string} uri
 */
export const getReferenceForDocument = (uri) => {
  return references.get(uri);
};

export const deleteReferencesForDocument = (uri) => {
  references.delete(uri);
};

/**
 * @param {import("./jsonc-instance.js").JsoncInstance} keywordInstance
 * @param {string} dialectUri
 */
export const addReference = (keywordInstance, dialectUri) => {
  const referenceKeywordIds = [
    "https://json-schema.org/keyword/ref",
    "https://json-schema.org/keyword/draft-04/ref"
  ];
  const referenceKeywordNames = referenceKeywordIds.map((keywordId) => keywordNameFor(keywordId, dialectUri));
  if (!referenceKeywordNames.includes(keywordInstance.value()) || keywordInstance?.node?.parent?.children?.length < 2) {
    return;
  }
  const { pointer, textDocument, node } = keywordInstance;

  const valueInstance = keywordInstance._fromNode(node.parent.children[1], keywordInstance.pointer);
  if (typeof valueInstance.value() !== "string") {
    return;
  }

  if (!references.has(textDocument.uri)) {
    references.set(textDocument.uri, new Map());
  }
  references.get(textDocument.uri).set(pointer, valueInstance);
};

/**
 * @param {import("vscode-languageserver").TextDocuments} documents
 * @param {import("vscode-languageserver-textdocument").TextDocument} textDocument
 * @param {string} ref
 */
export const validateReference = async (documents, textDocument, ref) => {
  const referenceData = await getReferenceData(documents, textDocument.uri, getReferenceForDocument(textDocument.uri).get(ref).value());
  if (typeof referenceData === "boolean") {
    return referenceData;
  }
  const { jsonInstance, anchorFragment, localJsonPointer } = referenceData;
  if (anchorFragment && (
    !isAnchor(anchorFragment) || !await searchAnchorFragment(jsonInstance.textDocument, anchorFragment)
  )
  ) {
    return false;
  }
  if (localJsonPointer && jsonInstance.get(localJsonPointer).value() === undefined) {
    return false;
  }
  return true;
};

/**
 * @param {import("vscode-languageserver").TextDocuments} documents
 * @param {string} uri
 * @param {string} ref
 * @returns {Promise<boolean | {
 * jsonInstance: JsoncInstance;
 * anchorFragment?: string;
 * localJsonPointer?: string;
 * }>}
 */
const getReferenceData = async (documents, uri, ref) => {
  const [$id, fragment] = ref.startsWith("#") ? ref.slice(1).split("#") : ref.split("#");
  const embeddedSchema = getEmbeddedIdentifer(uri, $id);

  if (ref.startsWith("#")) {
    const textDocument = await fetchDocument(documents, uri);
    const jsonInstance = JsoncInstance.fromTextDocument(textDocument);
    return extractPointers($id, jsonInstance);
  }
  if (embeddedSchema) {
    if (!fragment) {
      return true;
    }
    const jsonInstance = embeddedSchema;
    return extractPointers(fragment, jsonInstance);
  }
  if (!workspaceUri) {
    return false;
  }
  if (isAbsoluteUrl($id)) {
    const documentUri = getIdentifier($id);
    if (!documentUri) {
      return false;
    }
    if (!fragment) {
      return true;
    }
    const textDocument = await fetchDocument(documents, documentUri);
    const jsonInstance = JsoncInstance.fromTextDocument(textDocument);
    return extractPointers(fragment, jsonInstance);
  }


  const currDocument = await fetchDocument(documents, uri);
  const schemaResources = await getSchemaResources(currDocument);
  const { dialectUri } = schemaResources[0];
  const idKeywordName = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
  const jsonInstance = JsoncInstance.fromTextDocument(currDocument);

  let fullReferenceUri;
  const baseUri = jsonInstance.get(`#/${idKeywordName}`).value();
  if (baseUri !== undefined) {
    fullReferenceUri = resolve(baseUri, $id);
  } else {
    fullReferenceUri = pathToFileURL(join(dirname(uri), $id)).toString();
  }
  const referenceDocumentUri = getIdentifier(fullReferenceUri);
  if (!referenceDocumentUri) {
    return false;
  }
  const referenceDocument = await fetchDocument(documents, referenceDocumentUri);
  const referenceInstance = JsoncInstance.fromTextDocument(referenceDocument);
  if (!fragment) {
    return true;
  }
  return extractPointers(fragment, referenceInstance);
};

const extractPointers = (fragment, jsonInstance) => {
  if (!fragment.startsWith("/")) {
    const anchorFragment = fragment;
    return { jsonInstance, anchorFragment };
  } else {
    const localJsonPointer = `#${fragment}`;
    return { jsonInstance, localJsonPointer };
  }
};

/**
 *
 * @param {TextDocument} textDocument
 * @param {string} anchorValue
 */
const searchAnchorFragment = async (textDocument, anchorValue) => {
  const schemaResources = await getSchemaResources(textDocument);
  for (const { dialectUri } of schemaResources) {
    const anchorKeywordName = keywordNameFor("https://json-schema.org/keyword/anchor", dialectUri);
    for (const { keywordInstance } of getSemanticTokens(schemaResources)) {
      if (keywordInstance.value() === anchorKeywordName) {
        const valueInstance = keywordInstance._fromNode(keywordInstance.node.parent.children[1], keywordInstance.pointer);
        if (valueInstance.value() === anchorValue && typeof valueInstance.value() === "string") {
          return true;
        }
      }
    }
  }
  return false;
};
