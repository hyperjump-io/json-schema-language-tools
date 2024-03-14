import { DiagnosticSeverity } from "vscode-languageserver";

export const toAbsoluteUri = (uri) => uri.replace(/#.*$/, "");

export const extractBaseUri = (id) => {
  const match = id.match(/^((https|http):\/\/[^/]+)/);
  return match ? match[0] : "";
};

export const isValidUrl = (url) => {
  return /^(http|https):\/\/[^ "]+$/.test(url);
};

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
      end: instance.endPosition(),
    },
    message,
    source: "json-schema",
  };
};
