import { getKeywordId, getKeywordName } from "@hyperjump/json-schema/experimental";
import { resolveIri as hyperjumpResolveIri } from "@hyperjump/uri";
import { URI } from "vscode-uri";


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

/** @type (keywordUri: string, dialectUri: string) => string | undefined */
export const keywordNameFor = (keywordUri, dialectUri) => {
  try {
    return getKeywordName(dialectUri, keywordUri);
  } catch (error) {
    return undefined;
  }
};

/** @type (keywordName: string, dialectUri: string) => string | undefined */
export const keywordIdFor = (keywordName, dialectUri) => {
  try {
    return keywordName === "$schema"
      ? "https://json-schema.org/keyword/schema"
      : getKeywordId(keywordName, dialectUri);
  } catch (error) {
    return;
  }
};

/** @type (uri: string, baseUri: string) => string */
export const resolveIri = (uri, baseUri) => {
  const resolved = hyperjumpResolveIri(uri, baseUri);
  return normalizeUri(resolved);
};

/** @type (uri: string) => string */
export const normalizeUri = (uri) => {
  return URI.parse(uri).toString();
};
