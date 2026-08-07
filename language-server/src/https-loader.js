/**
 * Custom Node.js loader that enables importing ES modules over HTTPS.
 * Required because Node.js doesn't support https: imports natively.
 *
 * Supports Node >= 20 using `--import` by auto-registering.
 *
 * When a remote module (loaded from esm.sh) was built with
 * `?external=@hyperjump/...`, esm.sh leaves those imports as bare specifiers.
 * The resolve hook below detects them (non-https specifier whose parentURL is
 * esm.sh) and resolves them via the local node_modules copy, so the remote
 * vocab package shares the exact same instance as the bundled server.
 */
import { register, createRequire } from "node:module";
import { pathToFileURL } from "node:url";

if (typeof register === "function") {
  register(import.meta.url);
}


const localRequire = createRequire(import.meta.url);

/** @type {import('node:module').ResolveHook} */
export function resolve(specifier, context, nextResolve) {
  // Any https:// import → keep as-is, we'll fetch it in load()
  if (specifier.startsWith("https://esm.sh")) {
    return { shortCircuit: true, url: specifier };
  }

  if (context.parentURL?.startsWith("https://esm.sh")) {
    if (specifier.startsWith("/")) {
      // Relative path on esm.sh (e.g. /gh/foo/bar/es2022/index.mjs)
      return {
        shortCircuit: true,
        url: new URL(specifier, context.parentURL).href
      };
    } else {
      // Bare specifier that esm.sh left external (e.g. @hyperjump/json-schema)
      // → resolve from local node_modules so we share the same instance
      return {
        shortCircuit: true,
        url: pathToFileURL(localRequire.resolve(specifier)).href
      };
    }
  }

  return nextResolve(specifier, context);
}

/**
 * @param {string} url
 * @param {unknown} _context
 * @param {import('node:module').LoadHook extends (url: string, context: infer _C, nextLoad: infer NL) => infer _R ? NL : never} nextLoad
 */
export async function load(url, _context, nextLoad) {
  if (url.startsWith("https://esm.sh")) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch module: ${url} (${response.status})`);
    }
    return {
      format: "module",
      source: await response.text(),
      shortCircuit: true
    };
  }

  return nextLoad(url);
}
