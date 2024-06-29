import { getKeywordName } from "@hyperjump/json-schema/experimental";

/** @import * as Type from "./util.js" */


/** @type Type.toAbsoluteUri */
export const toAbsoluteUri = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? uri : uri.slice(0, position);
};

/** @type Type.uriFragment */
export const uriFragment = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? "" : uri.slice(position + 1);
};

/** @type Type.keywordNameFor */
export const keywordNameFor = (keywordUri, dialectUri = "") => {
  try {
    return getKeywordName(dialectUri, keywordUri);
  } catch (error) {
    return undefined;
  }
};
