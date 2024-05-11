import { doesDocumentExists, fetchDocument } from "./documents.js";
import { keywordNameFor } from "./json-schema.js";
import { JsoncInstance } from "./jsonc-instance.js";
import { getSemanticTokens } from "./semantic-tokens.js";
import { getSchemaResources, workspaceUri } from "./server.js";
import { isAbsoluteUrl } from "./util.js";
import { workspaceSchemas } from "./workspace.js";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL, resolve } from "node:url";

/**
 * @param {JsoncInstance} keywordInstance
 * @param {string} dialectUri
 */
export const findRef = (keywordInstance, dialectUri) => {
  const referenceKeywordIds = [
    "https://json-schema.org/keyword/ref",
    "https://json-schema.org/keyword/draft-04/ref"
  ];

  const referenceKeywordNames = referenceKeywordIds.map((keywordId) => keywordNameFor(keywordId, dialectUri));
  if (!referenceKeywordNames.includes(keywordInstance.value())) {
    return;
  }
  const { pointer } = keywordInstance;

  const valueInstance = keywordInstance.get("#" + pointer);

  if (typeof valueInstance.value() !== "string") {
    return;
  }

  return keywordInstance.pointer;
};

/**
 * @param {import("vscode-languageserver").TextDocuments} documents
 * @param {import("vscode-languageserver-textdocument").TextDocument} document
 * @param {string} pointer
 */
export const validateReference = async (documents, document, pointer) => {
  const documentJsonInstance = JsoncInstance.fromTextDocument(document);
  const valueInstance = documentJsonInstance.get("#" + pointer);
  const ref = valueInstance.value();
  const { baseUrl, jsonPointer, anchorFragment } = extractUriInfo(ref);
  /**
   * @type {JsoncInstance | null}
   */
  let documentInstance = documentJsonInstance;
  if (!ref.startsWith("#")) {
    documentInstance = await getReferencedInstance(documents, document, baseUrl);
  }
  if (documentInstance === null) {
    return { valid: false, message: "Invalid external reference" };
  }
  if (jsonPointer !== null) {
    if (documentInstance.get("#" + jsonPointer).value() === undefined) {
      return { valid: false, message: `Invalid JSON pointer: ${jsonPointer}` };
    }
  }
  if (anchorFragment !== null) {
    if (!await searchAnchorFragment(documentInstance.textDocument, anchorFragment)) {
      return { valid: false, message: `Invalid anchor fragment: ${anchorFragment}` };
    }
  }

  return { valid: true };
};

/**
 * @param {import("vscode-languageserver-textdocument").TextDocument} textDocument
 * @returns {AsyncGenerator<{instance: import("./jsonc-instance.js").JsoncInstance, isEmbedded: boolean}>}
 */
const getIdentifiers = async function* (textDocument) {
  for (const { dialectUri, schemaInstance } of await getSchemaResources(textDocument)) {
    const idKeywordName = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
    const idInstance = schemaInstance.step(idKeywordName);
    if (idInstance.value() !== undefined) {
      yield { instance: idInstance, isEmbedded: schemaInstance.startPosition().line !== 0 };
    }
  }
};

/**
 * @param {import("vscode-languageserver").TextDocuments} documents
 * @param {string} identifier
 * @returns {Promise<JsoncInstance | null>}
 */
const findInstanceForAbsoluteIdentfier = async (documents, identifier) => {
  for await (const documentUri of workspaceSchemas()) {
    const textDocument = await fetchDocument(documents, documentUri);
    for await (const { instance, isEmbedded } of getIdentifiers(textDocument)) {
      if (!isEmbedded && instance.value() === identifier) {
        return instance;
      }
    }
  }
  return null;
};

/**
 * @param {import("vscode-languageserver").TextDocuments} documents
 * @param {import("vscode-languageserver-textdocument").TextDocument} document
 * @param {string} refWithoutFragment
 * @returns {Promise<JsoncInstance | null>}
*/
const getReferencedInstance = async (documents, document, refWithoutFragment) => {
  for await (const { instance } of getIdentifiers(document)) {
    if (instance.value() === refWithoutFragment) {
      return instance;
    }
  }
  if (!workspaceUri) {
    return null;
  }
  if (isAbsoluteUrl(refWithoutFragment)) {
    return await findInstanceForAbsoluteIdentfier(documents, refWithoutFragment);
  }


  const schemaResources = await getSchemaResources(document);
  const { dialectUri } = schemaResources[0];
  const idKeywordName = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
  const jsonInstance = JsoncInstance.fromTextDocument(document);

  let fullReferenceUri;
  const baseUri = jsonInstance.get(`#/${idKeywordName}`).value();
  if (baseUri !== undefined) {
    fullReferenceUri = resolve(baseUri, refWithoutFragment);
    return await findInstanceForAbsoluteIdentfier(documents, fullReferenceUri);
  } else {
    fullReferenceUri = pathToFileURL(join(dirname(fileURLToPath(document.uri)), refWithoutFragment)).toString();
    if (!await doesDocumentExists(fullReferenceUri)) {
      return null;
    }
    return JsoncInstance.fromTextDocument(await fetchDocument(documents, fullReferenceUri));
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
    const anchorKeywordName = keywordNameFor(
      "https://json-schema.org/keyword/anchor",
      dialectUri
    );
    for (const { keywordInstance } of getSemanticTokens(schemaResources)) {
      if (keywordInstance.value() === anchorKeywordName) {
        const valueInstance = keywordInstance.get("#" + keywordInstance.pointer);
        if (
          typeof valueInstance.value() === "string" && valueInstance.value() === anchorValue
        ) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * @param {string} uri
 * @returns {{baseUrl: string | null; jsonPointer: string | null; anchorFragment: string | null}}
 */
const extractUriInfo = (uri) => {
  const result = { baseUrl: null, jsonPointer: null, anchorFragment: null };
  const [baseUrl, fragment] = uri.split("#");
  result.baseUrl = baseUrl;
  if (fragment) {
    if (fragment.startsWith("/")) {
      result.jsonPointer = fragment;
    } else {
      result.anchorFragment = fragment;
    }
  }
  return result;
};
