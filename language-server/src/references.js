import { workspaceUri } from "./server.js";
import { buildDiagnostic, fetchFile, isAnchor, isSchema } from "./util.js";
import { workspaceSchemas } from "./workspace.js";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "url";
import { JsoncInstance } from "./jsonc-instance.js";
import { keywordNameFor } from "./json-schema.js";

/**
 *
 * @param {JsoncInstance} instance
 * @param {string} anchor
 * @returns {boolean}
 */
const searchAnchorFragment = (dialectUri, instance, anchor) => {
  const anchorKeywordName = keywordNameFor("https://json-schema.org/keyword/anchor", dialectUri);
  /**
   * @param {JsoncInstance} instance
   * @param {string} basePath
   */
  const findAnchor = (instance, basePath = "") => {
    if (instance.typeOf() === "object") {
      for (const [key, valueInstance] of instance.entries()) {
        if (key.value() === anchorKeywordName) {
          if (valueInstance.value() === anchor) {
            return true;
          }
        }
        if (findAnchor(valueInstance, `${basePath}/${key.value()}`)) {
          return true;
        }
      }
    } else if (instance.typeOf() === "array") {
      for (const item of instance.iter()) {
        if (findAnchor(item, basePath)) {
          return true;
        }
      }
    }
    return false;
  };
  return findAnchor(instance);
};

/**
 *
 * @param {JsoncInstance} instance
 * @returns {Promise<Array<import("vscode-languageserver").Diagnostic>>}
 */
export const validateReferences = async (instance, dialectUri) => {
  const diagnostics = [];
  let baseUri;
  const referenceKeywordIds = ["https://json-schema.org/keyword/ref", "https://json-schema.org/keyword/draft-04/ref"];
  const referenceKeywordNames = referenceKeywordIds.map((keywordId) => keywordNameFor(keywordId, dialectUri));
  /**
   *
   * @param {JsoncInstance} instance
   * @param {string} basePath
   * @returns
   */
  async function validateRefs(instance, basePath = "") {
    if (instance.typeOf() === "object") {
      for (const [key, valueInstance] of instance.entries()) {
        if (key.value() === keywordNameFor("https://json-schema.org/keyword/id")) {
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
            const instanceUri = fileURLToPath(instance.textDocument.uri);
            const fullReferenceUri = pathToFileURL(join(dirname(instanceUri), baseRef)).toString();
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
              const document = await fetchFile(fullReferenceUri);
              const referenceInstance = JsoncInstance.fromTextDocument(document);
              if (fragment.startsWith("/")) {
                //JSON POINTER
                if (!checkReference("#" + fragment, referenceInstance)) {
                  diagnostics.push(buildDiagnostic(valueInstance, `Invalid pointer reference in the external schema: ${ref}`));
                }
                return;
              }
              //ANCHOR FRAGMENT
              if (!isAnchor(fragment)) {
                diagnostics.push(buildDiagnostic(valueInstance, `Invalid anchor fragment pattern in the external reference: ${ref}`));
                return;
              }

              if (!searchAnchorFragment(dialectUri, referenceInstance, fragment)) {
                diagnostics.push(buildDiagnostic(valueInstance, `Invalid anchor fragment in the external reference: ${ref}`));
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
