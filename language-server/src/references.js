import { keywordNameFor } from "./json-schema.js";

/**
 * `document uri` -> `pointer -> value`
 * @type {Map<string, Map<string, string>}
 */
const references = new Map();

/**
 * @param {JsoncInstance} keywordInstance
 * @param {string} dialectUri
 */
export const addReference = (keywordInstance, dialectUri) => {
  const referenceKeywordIds = [
    "https://json-schema.org/keyword/ref",
    "https://json-schema.org/keyword/draft-04/ref"
  ];
  const referenceKeywordNames = referenceKeywordIds.map((keywordId) => keywordNameFor(keywordId, dialectUri));
  if (!referenceKeywordNames.includes(keywordInstance.value())) {
    return;
  }
  if (keywordInstance?.node?.parent?.children?.length > 1) {
    const { pointer, textDocument, node } = keywordInstance;

    if (!isValidRef(pointer)) {
      return;
    }

    if (!references.has(textDocument.uri)) {
      references.set(textDocument.uri, new Map());
    }
    references.get(textDocument.uri).set(pointer, node.parent.children[1]);
  }
};

/**
 * @param {string} path
 * @returns {boolean}
 */
const isValidRef = (path) => {
  // verify if the keyword is actually a reference.
  return true;
};
