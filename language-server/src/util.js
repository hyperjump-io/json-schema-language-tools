import { DiagnosticSeverity } from "vscode-languageserver";


export const toAbsoluteUri = (uri) => uri.replace(/#.*$/, "");

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
