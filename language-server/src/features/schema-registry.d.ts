import type { Connection } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SchemaDocument } from "../schema-document.js";
import type { Feature } from "../build-server.js";


export const getSchemaDocument: (connection: Connection, textDocument: TextDocument) => Promise<SchemaDocument>;
export const clearSchemaDocuments: () => void;
export const allSchemaDocuments: () => GeneratorFunction<SchemaDocument>;
export const getSchemaResource: (schemaUri: string) => SchemaNode;

declare const schemaRegistry: Feature;
export default schemaRegistry;
