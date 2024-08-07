import { getKeywordName } from "@hyperjump/json-schema/experimental";


/** @type (uri: string) => string */
export const toAbsoluteUri = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? uri : uri.slice(0, position);
};

/** @type (uri: string) => string */
export const uriFragment = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? "" : uri.slice(position + 1);
};

/** @type (keywordUri: string, dialectUri?: string) => string | undefined */
export const keywordNameFor = (keywordUri, dialectUri = "") => {
  try {
    return getKeywordName(dialectUri, keywordUri);
  } catch (error) {
    return undefined;
  }
};
