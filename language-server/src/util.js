import { DiagnosticSeverity } from "vscode-languageserver";

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
export const toAbsoluteUri = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? uri : uri.slice(0, position);
};

export const uriFragment = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? "" : uri.slice(position + 1);
};
