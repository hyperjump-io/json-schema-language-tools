import { contextDialectUri } from "./server.js";
import { buildDiagnostic } from "./util.js";
import { getKeywordName } from "@hyperjump/json-schema/experimental";

/**
 * TODO
 * - handler external references
 * - handler anchor fragments
 */

/**
 *
 * @param {JsoncInstance} instance
 * @returns {Array<import("vscode-languageserver").Diagnostic>}
 */
export const validateReferences = (instance) => {
  const diagnostics = [];
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
        if (
          referenceKeywordNames.includes(key.value()) && typeof valueInstance.value() === "string"
        ) {
          const ref = valueInstance.value();
          const isLocalRef = isLocalReference(ref);
          if (isLocalRef) {
            const isValidRef = checkLocalReference(ref, instance);
            if (!isValidRef) {
              diagnostics.push(buildDiagnostic(valueInstance, `Invalid reference: ${ref}`));
            }
            return;
          }
        } else {
          validateRefs(valueInstance, basePath + "/" + key.value());
        }
      }
    } else if (instance.typeOf() === "array") {
      for (const item of instance.iter()) {
        validateRefs(item, basePath);
      }
    }
  }
  validateRefs(instance);
  return diagnostics;
};
/**
 * @param {string} ref
 * @returns {boolean}
 */
const isLocalReference = (ref) => ref.startsWith("#");

/**
 * @param {string} ref
 * @param {import("./jsonc-instance.js").JsoncInstance} instance
 * @returns {boolean}
 */
const checkLocalReference = (ref, instance) => {
  try {
    return instance.get(ref).node !== undefined;
  } catch (e) {
    return false;
  }
};
