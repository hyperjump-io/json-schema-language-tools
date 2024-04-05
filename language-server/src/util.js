import { DiagnosticSeverity } from "vscode-languageserver";
import { keywordNameFor } from "./json-schema.js";


export const toAbsoluteUri = (uri) => uri.replace(/#.*$/, "");

/**
 * @param {import("./jsonc-instance").JsoncInstance} instance
 * @param {Array<string>} keywordUris
 * @param {string} dialectUri
 */
export const searchKeyword = (instance, keywordUris, dialectUri) => {
  const keywords = keywordUris.map((uri) => keywordNameFor(uri, dialectUri));

  /**
   * @type {Array<import("./jsonc-instance.js").JsoncInstance>}
   */
  const found = [];

  /**
   *
   * @param {import("./jsonc-instance").JsoncInstance} instance
   * @param {string} basePath
   */
  const search = (instance, basePath = "") => {
    if (instance.typeOf() === "object") {
      for (const [key, valueInstance] of instance.entries()) {
        if (
          keywords.includes(key.value())
        ) {
          found.push(valueInstance);
        }
      }
    } else if (instance.typeOf() === "array") {
      for (const item of instance.iter()) {
        search(item, basePath);
      }
    }
  };
  search(instance);
  return found;
};

/**
 * @param {import("./jsonc-instance").JsoncInstance} instance
 * @param {string} message
 * @param {DiagnosticSeverity} severity
 * @param {Array<string>} tags
 * @returns {import("vscode-languageserver").Diagnostic}
 */
export const buildDiagnostic = (
  instance,
  message,
  severity = DiagnosticSeverity.Error,
  tags = []
) => {
  return {
    severity,
    tags,
    range: {
      start: instance.startPosition(),
      end: instance.endPosition()
    },
    message,
    source: "json-schema"
  };
};

export const isAbsoluteUrl = RegExp.prototype.test.bind(/^https?:\/\/*/);
export const isSchema = RegExp.prototype.test.bind(/(?:\.|\/|^)schema\.json$/);
export const isAnchor = RegExp.prototype.test.bind(/^[A-Za-z][A-Za-z0-9\-_,:.]*$/);
