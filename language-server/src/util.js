import { getKeywordName } from "@hyperjump/json-schema/experimental";


export const toAbsoluteUri = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? uri : uri.slice(0, position);
};

export const uriFragment = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? "" : uri.slice(position + 1);
};

export const keywordNameFor = (keywordUri, dialectUri) => {
  try {
    return getKeywordName(dialectUri, keywordUri);
  } catch (error) {
    return undefined;
  }
};
