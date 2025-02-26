import { getKeywordId, getKeywordName } from "@hyperjump/json-schema/experimental";
import { resolveIri as hyperjumpResolveIri } from "@hyperjump/uri";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { URI } from "vscode-uri";
import detectIndent from "detect-indent";
import * as jsoncParser from "jsonc-parser";
/**
 * @import { SchemaNode as SchemaNodeType } from "../model/schema-node.js"
 * @import { Ignore } from "ignore"
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

/** @type (path: string, filter?: Ignore, cwd?: string) => AsyncGenerator<string> */
export const readDirRecursive = async function* (path, filter, cwd) {
  cwd ??= path;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    const relativeEntryPath = relative(cwd, entryPath);

    if (filter?.ignores(relativeEntryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      yield* readDirRecursive(entryPath, filter, cwd);
    } else if (entry.isFile()) {
      yield relativeEntryPath;
    }
  }
};

/** @type (uri: string, defaultTabSize: number, insertSpaces: boolean, detectIndentation: boolean) => Promise<{ type: 'tabs' | 'spaces', size: number }> */
export const detectIndentationFromContent = async (uri, defaultTabSize, insertSpaces, detectIndentation) => {
  try {
    const filePath = URI.parse(uri).fsPath;
    const content = await readFile(filePath, "utf-8");
    const { amount } = detectIndent(content);

    if (!detectIndentation) {
      return { type: "spaces", size: defaultTabSize };
    }

    return insertSpaces
      ? { type: "spaces", size: amount }
      : { type: "tabs", size: amount };
  } catch {
    return { type: "spaces", size: defaultTabSize };
  }
};

/** @type (uri: string, newDefText: string, defaultTabSize: number, insertSpaces: boolean, detectIndentation: boolean) => Promise<string>} */
export const formatNewDef = async (uri, newDefText, defaultTabSize, insertSpaces, detectIndentation) => {
  try {
    const detectedIndent = await detectIndentationFromContent(uri, defaultTabSize, insertSpaces, detectIndentation);

    const edits = jsoncParser.format(newDefText, undefined, {
      insertSpaces: detectedIndent?.type === "spaces",
      tabSize: detectedIndent?.size ?? defaultTabSize
    });

    return jsoncParser.applyEdits(newDefText, edits).replace(/\n/g, `\n${"  ".repeat(detectedIndent?.size ?? defaultTabSize)}`);
  } catch {
    return newDefText;
  }
};
