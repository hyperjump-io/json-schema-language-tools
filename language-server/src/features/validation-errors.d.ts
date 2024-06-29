import type { SchemaError } from "../schema-document.js";
import type { SchemaNode } from "../schema-node.js";
import type { Feature } from "../build-server.js";


export const invalidNodes: (errors: SchemaError[]) => AsyncGenerator<[SchemaNode, string]>;
export const toErrorMessage: (error: SchemaError) => AsyncGenerator<string>;

declare const validationErrors: Feature;
export default validationErrors;
