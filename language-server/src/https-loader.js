/**
 * Custom Node.js loader that enables importing ES modules over HTTPS.
 * Required because Node.js doesn't support https: imports natively.
 *
 * Support Node >= 20 using `--import` by auto-registering.
 */
import { register } from "node:module";
if (typeof register === "function") {
  register(import.meta.url);
}


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
    return { shortCircuit: true, url: resolved.href };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return nextResolve(specifier, context);
}

/**
 * @param {string} url
 * @param {object} context
 * @param {Function} nextLoad
 */
export async function load(url, context, nextLoad) {
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
