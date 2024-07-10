import type { Connection, InitializeParams, ServerCapabilities, TextDocuments } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";


export type Feature = {
  load: (connection: Connection, documents: TextDocuments<TextDocument>) => void;
  onInitialize: (params: InitializeParams) => ServerCapabilities;
  onInitialized: (connection: Connection, documents: TextDocuments<TextDocument>) => Promise<void>;
  onShutdown: (connection: Connection, documents: TextDocuments<TextDocument>) => void;
};

export const buildServer: (connection: Connection, features: Feature[]) => void;
