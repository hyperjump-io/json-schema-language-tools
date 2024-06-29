import type { Connection } from "vscode-languageserver";
import type { Feature } from "../build-server.js";


export type DocumentSettings = {
  defaultDialect?: string;
  schemaFilePatterns: string[];
};

export const getDocumentSettings: (connection: Connection, uri?: string) => Promise<DocumentSettings>;

declare const documentSettings: Feature;
export default documentSettings;
