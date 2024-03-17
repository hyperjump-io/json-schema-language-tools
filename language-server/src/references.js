import { validate } from "./json-schema.js";
import { JsoncInstance } from "./jsonc-instance.js";
import { contextDialectUri } from "./server.js";
import { buildDiagnostic, extractBaseUri, isValidUrl } from "./util.js";
import {getKeywordName} from "@hyperjump/json-schema/experimental";

// TODO: Handle anchor fragments

/**
 *
 * @param {JsoncInstance} instance
 * @returns
 */
export const validateReferences = async (instance) => {
  const diagnostics = [];
  const promises = [];
  const referenceKeywordIds = ["https://json-schema.org/keyword/ref", "https://json-schema.org/keyword/draft-04/ref"];

  let baseUri = "";
  const referenceKeywordNames = referenceKeywordIds.map((keywordId) => getKeywordName(contextDialectUri, keywordId))
  /**
   *
   * @param {JsoncInstance} instance
   * @param {string} basePath
   * @returns
   */
  async function validateRefs(instance, basePath = "") {
    if (instance.typeOf() === "object") {
      for (const [key, valueInstance] of instance.entries()) {
        if (key.value() == "$id" && typeof valueInstance.value() === "string") {
          baseUri = extractBaseUri(valueInstance.value());
        }
        if (
          referenceKeywordNames.includes(key.value()) && typeof valueInstance.value() === "string"
        ) {
          const ref = valueInstance.value();
          const isLocalRef = isLocalReference(ref);
          if (isLocalRef) {
            const isValidRef = checkLocalReference(ref, instance);
            if (!isValidRef) {
              diagnostics.push(
                buildDiagnostic(valueInstance, `Invalid reference: ${ref}`)
              );
            }
            return;
          }
          promises.push(
            handleExternalReference(ref, baseUri).then((isValidRef) => {
              if (!isValidRef.success) {
                diagnostics.push(
                  buildDiagnostic(valueInstance, isValidRef.error)
                );
              }
            })
          );
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
  await Promise.all(promises);

  return diagnostics;
};

function isLocalReference(ref) {
  return ref.startsWith("#");
}

const checkLocalReference = (ref, instance) => {
  const resolvedRef = instance.get(ref);
  return resolvedRef !== undefined;
};

const handleExternalReference = async (ref, baseUri) => {
  let url = ref;
  if (ref.startsWith("/")) {
    if (!baseUri)
      return { success: false, error: "Invalid $id for relative schema uri" };
    url = baseUri + ref;
  } else if (!isValidUrl(ref)) {
    return { success: false, error: "Invalid $ref url" };
  }
  try {
    const schema = await fetchExternalSchema(url);
    const instance = JsoncInstance.fromJSON(JSON.stringify(schema));
    let isValidRef = false;
    try {
      [isValidRef] = await validate(url, instance);
    } catch {}
    if (isValidRef.valid) {
      return { success: true };
    } else {
      return { success: false, error: "Not a valid reference" };
    }
  } catch (error) {
    return { error: error.message, success: false };
  }
};

const fetchExternalSchema = async (url) => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to fetch schema");
    }
    const schema = await response.json();
    return schema;
  } catch (error) {
    throw new Error("Failed to fetch schema");
  }
};
