import { doesDocumentExists, fetchDocument } from "./documents.js";
import { keywordNameFor } from "./json-schema.js";
import { JsoncInstance } from "./jsonc-instance.js";
import { getSemanticTokens } from "./semantic-tokens.js";
import { isAbsoluteUrl } from "./util.js";
import { workspaceSchemas } from "./workspace.js";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL, resolve } from "node:url";


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

export const validateReference = async (isSchema, workspaceUri, documents, document, pointer, getSchemaResources) => {
  const documentJsonInstance = JsoncInstance.fromTextDocument(document);
  const valueInstance = documentJsonInstance.get("#" + pointer);
  const ref = valueInstance.value();
  const { baseUrl, jsonPointer, anchorFragment } = extractUriInfo(ref);

  let documentInstance = documentJsonInstance;
  if (!ref.startsWith("#")) {
    documentInstance = await getReferencedInstance(isSchema, workspaceUri, documents, document, baseUrl, getSchemaResources);
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
    if (!await searchAnchorFragment(documentInstance.textDocument, anchorFragment, getSchemaResources)) {
      return { valid: false, message: `Invalid anchor fragment: ${anchorFragment}` };
    }
  }

  return { valid: true };
};


const getIdentifiers = async function* (textDocument, getSchemaResources) {
  for (const { dialectUri, schemaInstance } of await getSchemaResources(textDocument)) {
    const idKeywordName = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
    const idInstance = schemaInstance.step(idKeywordName);
    if (idInstance.value() !== undefined) {
      yield { instance: idInstance, isEmbedded: schemaInstance.startPosition().line !== 0 };
    }
  }
};


const findInstanceForAbsoluteIdentfier = async (isSchema, documents, identifier, getSchemaResources) => {
  for await (const documentUri of workspaceSchemas(isSchema)) {
    const textDocument = await fetchDocument(documents, documentUri);
    for await (const { instance, isEmbedded } of getIdentifiers(textDocument, getSchemaResources)) {
      if (!isEmbedded && instance.value() === identifier) {
        return instance;
      }
    }
  }
  return null;
};


const getReferencedInstance = async (isSchema, workspaceUri, documents, document, refWithoutFragment, getSchemaResources) => {
  for await (const { instance } of getIdentifiers(document, getSchemaResources)) {
    if (instance.value() === refWithoutFragment) {
      return instance;
    }
  }
  if (!workspaceUri) {
    return null;
  }
  if (isAbsoluteUrl(refWithoutFragment)) {
    return await findInstanceForAbsoluteIdentfier(isSchema, documents, refWithoutFragment, getSchemaResources);
  }


  const schemaResources = await getSchemaResources(document);
  const { dialectUri } = schemaResources[0];
  const idKeywordName = keywordNameFor("https://json-schema.org/keyword/id", dialectUri);
  const jsonInstance = JsoncInstance.fromTextDocument(document);

  let fullReferenceUri;
  const baseUri = jsonInstance.get(`#/${idKeywordName}`).value();
  if (baseUri !== undefined) {
    fullReferenceUri = resolve(baseUri, refWithoutFragment);
    return await findInstanceForAbsoluteIdentfier(isSchema, documents, fullReferenceUri, getSchemaResources);
  } else {
    fullReferenceUri = pathToFileURL(join(dirname(fileURLToPath(document.uri)), refWithoutFragment)).toString();
    if (!await doesDocumentExists(fullReferenceUri)) {
      return null;
    }
    return JsoncInstance.fromTextDocument(await fetchDocument(documents, fullReferenceUri));
  }
};


const searchAnchorFragment = async (textDocument, anchorValue, getSchemaResources) => {
  const schemaResources = await getSchemaResources(textDocument);
  for (const { dialectUri } of schemaResources) {
    const anchorKeywordName = keywordNameFor(
      "https://json-schema.org/keyword/anchor",
      dialectUri
    );
    // used to search keywords in an instance.
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
