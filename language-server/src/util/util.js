import { getKeywordId, getKeywordName } from "@hyperjump/json-schema/experimental";
import { resolveIri as hyperjumpResolveIri } from "@hyperjump/uri";
import { URI } from "vscode-uri";

/**
 * @import { SchemaNode as SchemaNodeType } from "../model/schema-node.js"
 */


// TODO: Needs review

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
  } catch (_error) {
    return undefined;
  }
};

/** @type (keywordName: string, dialectUri: string) => string | undefined */
export const keywordIdFor = (keywordName, dialectUri) => {
  try {
    return keywordName === "$schema"
      ? "https://json-schema.org/keyword/schema"
      : getKeywordId(keywordName, dialectUri);
  } catch (_error) {
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

/** @type (node: SchemaNodeType) => boolean */
export const isPropertyNode = (node) => {
  return node.parent?.type === "property" && node.parent.children[0] === node;
};

/**
 * @template T
 * @typedef {{
 *   promise: Promise<T>;
 *   resolve: (value: T) => void;
 *   reject: (error: Error) => void;
 * }} MyPromise
 */

/**
 * @template T
 * @returns MyPromise<T>
 */
export const createPromise = () => {
  let resolve;
  let reject;

  /** @type Promise<T> */
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: /** @type (value: T) => void */ (/** @type unknown */ (resolve)),
    reject: /** @type (error: Error) => void */ (/** @type unknown */ (reject))
  };
};
