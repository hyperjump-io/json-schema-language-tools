import type { Diagnostic, DiagnosticSeverity, DiagnosticTag, WorkspaceFolder } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SchemaDocument } from "../schema-document.js";
import type { SchemaNode } from "../schema-node.js";
import type { WatchEventType } from "node:fs";
import type { Feature } from "../build-server.js";


export type ValidationDiagnostic = {
  instance: SchemaNode;
  message: string;
  severity: DiagnosticSeverity;
  tags: DiagnosticTag[];
};

export const validateSchema: (schemaDocument: SchemaDocument) => Promise<void>;
export const buildDiagnostic: (
  textDocument: TextDocument,
  node: SchemaNode,
  message: string,
  severity?: DiagnosticSeverity,
  tags: DiagnosticTag[]
) => Diagnostic;
export const onWorkspaceChange: (eventType: WatchEventType, filename?: string) => Promise<void>;
export const isMatchedFile: (uri: string, patterns: string[]) => boolean;
export const addWorkspaceFolders: (folders: WorkspaceFolder[]) => void;
export const removeWorkspaceFolders: (folders: WorkspaceFolder[]) => void;
export const watchWorkspace: (handler: (eventType: WatchEventType, filename?: string) => void, schemaFilePatterns: string[]) => void;
export const workspaceSchemas: (schemaFilePatterns: string[]) => AsyncGenerator<string>;

declare const workspace: Feature;
export default workspace;
