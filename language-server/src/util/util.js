import { getKeywordId, getKeywordName } from "@hyperjump/json-schema/experimental";
import { resolveIri as hyperjumpResolveIri } from "@hyperjump/uri";
import { readdir } from "node:fs/promises";
import { EOL } from "node:os";
import { join, relative } from "node:path";
import { URI } from "vscode-uri";
import detectIndent from "detect-indent";
import * as jsoncParser from "jsonc-parser";

/**
 * @import { TextEdit } from "vscode-languageserver"
 * @import { TextDocument } from "vscode-languageserver-textdocument"
 * @import { Ignore } from "ignore"
 * @import { DocumentSettings } from "../services/configuration.js"
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

/** @type (textDocument: TextDocument, textEdit: TextEdit, settings: DocumentSettings) => TextEdit */
export const withFormatting = (textDocument, textEdit, settings) => {
  const indentation = settings.detectIndentation ? detectIndent(textDocument.getText()) : {
    amount: settings.tabSize,
    type: settings.insertSpaces ? "space" : "tab"
  };

  const formattingOptions = {
    insertSpaces: indentation.type === "space",
    tabSize: indentation.amount,
    keepLines: true,
    eol: settings.eol == "auto" ? EOL : settings.eol
  };

  const offset = textDocument.offsetAt(textEdit.range.start);

  const newText = jsoncParser.applyEdits(textDocument.getText(), [
    {
      offset: offset,
      length: textDocument.offsetAt(textEdit.range.end) - offset,
      content: textEdit.newText
    }
  ]);

  const range = { offset: offset, length: textEdit.newText.length };
  const formatEdits = jsoncParser.format(newText, range, formattingOptions);

  for (const formatEdit of formatEdits) {
    formatEdit.offset -= offset;
  }

  return {
    range: textEdit.range,
    newText: jsoncParser.applyEdits(textEdit.newText, formatEdits)
  };
};

// eslint-disable-next-line @stylistic/no-extra-parens
export const pick = /** @type <T extends object, K extends keyof T>(object: T, ...keys: K[]) => Partial<Pick<T, K>> */ ((object, ...keys) => {
  /** @type Partial<typeof object> */
  const result = {};
  for (const key of keys) {
    if (key in object) {
      result[key] = object[key];
    }
  }
  return result;
});
