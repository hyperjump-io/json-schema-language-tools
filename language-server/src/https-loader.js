/**
 * Custom Node.js loader that enables importing ES modules over HTTPS.
 * Required because Node.js doesn't support https: imports natively.
 *
 * Support Node >= 20 using `--import` by auto-registering.
 *
/* peer dependencies: when a remote
 * module (loaded from esm.sh) imports e.g. @hyperjump/json-schema/experimental,
 * we return a synthetic module that re-exports from globalThis.__hjsBridge.
 * This ensures the remote module shares the exact same internal state
 * (_dialects, _keywords, etc.) as the esbuild CJS bundle, avoiding the
 * CJS/ESM dual-instance problem.
 */
import { register } from "node:module";
if (typeof register === "function") {
  register(import.meta.url);
}

/**
 * Map of bridgeable package specifiers to their known export names.
 * When a remote module imports one of these, the loader returns synthetic
 * source that reads from globalThis.__hjsBridge (set by the server bundle).
 *
 * @type {Record<string, string[]>}
 */
const BRIDGE_EXPORTS = {
  "@hyperjump/json-schema/experimental": [
    "AnnotationsPlugin", "BASIC", "BasicOutputPlugin", "DETAILED", "DetailedOutputPlugin",
    "Validation", "addFormat", "addKeyword", "buildSchemaDocument", "canonicalUri",
    "compile", "defineVocabulary", "getDialect", "getDialectIds", "getKeyword",
    "getKeywordByName", "getKeywordId", "getKeywordName", "getSchema", "hasDialect",
    "hasVocabulary", "interpret", "loadDialect", "removeFormatHandler", "setFormatHandler",
    "toSchema", "unloadDialect"
  ],
  "@hyperjump/json-schema/draft-2020-12": [
    "FLAG", "InvalidSchemaError", "addSchema", "getAllRegisteredSchemaUris",
    "getMetaSchemaOutputFormat", "getShouldValidateFormat", "getShouldValidateSchema",
    "hasSchema", "registerSchema", "setMetaSchemaOutputFormat", "setShouldValidateFormat",
    "setShouldValidateSchema", "unregisterSchema", "validate"
  ],
  "@hyperjump/browser": [
    "RetrievalError", "UnknownMediaTypeError", "UnsupportedMediaTypeError",
    "UnsupportedUriSchemeError", "acceptableMediaTypes", "addMediaTypePlugin",
    "addUriSchemePlugin", "entries", "get", "has", "iter", "keys", "length",
    "removeMediaTypePlugin", "removeUriSchemePlugin", "retrieve", "setMediaTypeQuality",
    "step", "typeOf", "value", "values"
  ]
};

/**
 * @param {string} specifier
 * @param {{ parentURL?: string }} context
 * @param {Function} nextResolve
 */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("https://")) {
    return { shortCircuit: true, url: specifier };
  }

  if (context.parentURL?.startsWith("https://")) {
    const resolved = new URL(specifier, context.parentURL);
    const localSpecifier = toLocalSpecifier(resolved.pathname);

    // If this peer dependency has a bridge entry, resolve to a synthetic
    // bridge URL instead of the local node_modules copy.  The load hook
    // will return source that re-exports from globalThis.__hjsBridge,
    // ensuring the same module instance as the CJS bundle.
    if (localSpecifier && localSpecifier in BRIDGE_EXPORTS) {
      return { shortCircuit: true, url: `hjsbridge:${encodeURIComponent(localSpecifier)}` };
    }

    if (localSpecifier) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return nextResolve(localSpecifier, { ...context, parentURL: import.meta.url });
      } catch {
        // Not available locally — fetch from remote
      }
    }

    return { shortCircuit: true, url: resolved.href };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return nextResolve(specifier, context);
}

/**
 * Converts an esm.sh URL pathname for a scoped npm package back to a bare
 * specifier that Node can resolve from local node_modules.
 *
 * Examples:
 *   /@hyperjump/browser                             → @hyperjump/browser
 *   /@hyperjump/json-schema@^1.17.5/experimental    → @hyperjump/json-schema/experimental
 *
 * @param {string} pathname
 * @returns {string | null}
 */
function toLocalSpecifier(pathname) {
  const match = /^\/@([^/]+)\/([^/@?]+)(?:@[^/?]*)?(\/[^?]*)?/.exec(pathname);
  if (match) {
    const [, scope, pkg, subpath] = match;
    return `@${scope}/${pkg}${subpath ?? ""}`;
  }
  return null;
}

/**
 * @param {string} url
 * @param {object} context
 * @param {Function} nextLoad
 */
export async function load(url, context, nextLoad) {
  // Serve synthetic bridge modules for @hyperjump/* packages.
  // The source reads from globalThis.__hjsBridge (set by the server bundle)
  // so the remote vocab package shares the same internal state as the server.
  if (url.startsWith("hjsbridge:")) {
    const specifier = decodeURIComponent(url.slice("hjsbridge:".length));
    const exports = BRIDGE_EXPORTS[specifier];
    if (!exports) {
      throw new Error(`[loader] No bridge exports defined for: ${specifier}`);
    }

    const source = [
      `const _m = globalThis.__hjsBridge[${JSON.stringify(specifier)}];`,
      ...exports.map((name) => `export const ${name} = _m.${name};`),
      ""
    ].join("\n");

    return { shortCircuit: true, format: "module", source };
  }

  if (url.startsWith("https://")) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch module: ${url} (${response.status})`);
    }
    const source = await response.text();
    return { shortCircuit: true, format: "module", source };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return nextLoad(url, context);
}
