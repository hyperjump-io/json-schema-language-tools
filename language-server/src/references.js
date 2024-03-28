import { contextDialectUri, documents, isSchema, workspaceUri } from "./server.js";
import { buildDiagnostic } from "./util.js";
import { getKeywordName } from "@hyperjump/json-schema/experimental";
import { workspaceSchemas } from "./workspace.js";
import { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { JsoncInstance } from "./jsonc-instance.js";

/**
 *
 * @param {JsoncInstance} instance
 * @returns {Promise<Array<import("vscode-languageserver").Diagnostic>>}
 */
export const validateReferences = async (instance) => {
  const diagnostics = [];
  let baseUri;
  const referenceKeywordIds = ["https://json-schema.org/keyword/ref", "https://json-schema.org/keyword/draft-04/ref"];
  const referenceKeywordNames = referenceKeywordIds.map((keywordId) => getKeywordName(contextDialectUri, keywordId));
  /**
   *
   * @param {JsoncInstance} instance
   * @param {string} basePath
   * @returns
   */
  async function validateRefs(instance, basePath = "") {
    if (instance.typeOf() === "object") {
      for (const [key, valueInstance] of instance.entries()) {
        if (key.value() === "$id") {
          baseUri = valueInstance.value();
        }
        if (
          referenceKeywordNames.includes(key.value()) && typeof valueInstance.value() === "string"
        ) {
          const ref = valueInstance.value();
          const isLocalRef = isLocalReference(ref);
          if (isLocalRef) {
            const isValidRef = checkReference(ref, instance);
            if (!isValidRef) {
              diagnostics.push(buildDiagnostic(valueInstance, `Invalid reference: ${ref}`));
            }
            return;
          }
          if (workspaceUri === null) {
            diagnostics.push(buildDiagnostic(valueInstance, `Invalid external reference: ${ref}`));
            return;
          }
          if (baseUri === undefined) {
            const [baseRef, fragment] = ref.split("#");
            const fullReferenceUri = pathToFileURL(join(fileURLToPath(workspaceUri), baseRef)).toString();
            if (!isSchema(fullReferenceUri)) {
              diagnostics.push(buildDiagnostic(valueInstance, `Invalid external reference: ${ref}`));
              return;
            }
            let found = false;
            for await (const uri of workspaceSchemas()) {
              if (uri === fullReferenceUri) {
                found = true;
                break;
              }
            }
            if (!found) {
              diagnostics.push(buildDiagnostic(valueInstance, `Invalid external reference: ${ref}`));
              return;
            }
            if (fragment) {
              const document = documents.get(fullReferenceUri);
              if (!document) {
                return;
              }
              const referenceInstance = JsoncInstance.fromTextDocument(document);
              if (fragment.startsWith("/")) {
                //JSON POINTER
                if (!checkReference("#" + fragment, referenceInstance)) {
                  diagnostics.push(buildDiagnostic(valueInstance, `Invalid pointer reference in the external schema: ${ref}`));
                }
                return;
              }
            }
            return;
          }
        } else {
          await validateRefs(valueInstance, basePath + "/" + key.value());
        }
      }
    } else if (instance.typeOf() === "array") {
      for (const item of instance.iter()) {
        await validateRefs(item, basePath);
      }
    }
  }
  await validateRefs(instance);
  return diagnostics;
};
/**
 * @param {string} ref
 * @returns {boolean}
 */
const isLocalReference = (ref) => ref.startsWith("#");

/**
 * @param {string} ref
 * @param {JsoncInstance} instance
 * @returns {boolean}
 */
const checkReference = (ref, instance) => {
  try {
    return instance.get(ref).node !== undefined;
  } catch (e) {
    return false;
  }
};
