import type { SchemaError } from "../schema-document.js";
import type { Feature } from "../build-server.js";
import type { ValidationDiagnostic } from "./workspace.js";


export const invalidNodes: (errors: SchemaError[]) => AsyncGenerator<ValidationDiagnostic>;
export const toErrorMessage: (error: SchemaError) => AsyncGenerator<ValidationDiagnostic>;

declare const validationErrors: Feature;
export default validationErrors;
