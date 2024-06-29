import type { SchemaNode } from "../schema-node.js";
import type { Feature } from "../build-server.js";


export const references: (schemaResource: SchemaNode) => Generator<SchemaNode>;

declare const validateReferences: Feature;
export default validateReferences;
