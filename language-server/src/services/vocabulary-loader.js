import * as hjsExperimental from "@hyperjump/json-schema/experimental";
import * as hjsDraft202012 from "@hyperjump/json-schema/draft-2020-12";
import * as hjsBrowser from "@hyperjump/browser";

/**
 * @import { Connection } from "vscode-languageserver"
 */

// Expose the server bundle's own copies of @hyperjump packages on globalThis
// so that the HTTPS loader can serve synthetic bridge modules that re-export
// them.  This ensures remotely-loaded vocab packages share the same internal
// state (e.g. _dialects, _keywords) as the bundled server — avoiding the
// CJS/ESM dual-instance problem where esbuild's inlined CJS copy diverges
// from the ESM copy Node loads from node_modules.
globalThis.__hjsBridge = {
  "@hyperjump/json-schema/experimental": hjsExperimental,
  "@hyperjump/json-schema/draft-2020-12": hjsDraft202012,
  "@hyperjump/browser": hjsBrowser
};

export class VocabularyLoader {
  #connection;

  /** @type {Set<string>} */
  #trusted;

  /** @type {Set<string>} */
  #loaded;

  /** @type {Map<string, Promise<void>>} */
  #loading;

  /** @type {Promise<void>} */
  ready;

  /** @type {() => void} */
  #readyResolve;

  /**
   * @param {Connection} connection
   * @param {string[]} [initialTrusted]
   */
  constructor(connection, initialTrusted = []) {
    this.#connection = connection;
    this.#trusted = new Set(initialTrusted);
    this.#loaded = new Set();
    this.#loading = new Map();

    /** @type {() => void} */
    let resolve;
    this.ready = new Promise((r) => {
      resolve = r;
    });
    // @ts-expect-error – resolve is assigned synchronously above
    this.#readyResolve = resolve;

    // Listen for trust confirmations from the extension
    this.#connection.onNotification(
      "custom/addTrustedVocab",
      (/** @type {{ identifier: string }} */ { identifier }) => {
        this.#trusted.add(identifier);
      }
    );
  }

  /** @type {(identifiers: string[]) => void} */
  addTrusted(identifiers) {
    for (const identifier of identifiers) {
      this.#trusted.add(identifier);
    }
  }

  /**
   * Signal that initial vocabulary loading is complete.
   * Any code awaiting `this.ready` will proceed.
   */
  markReady() {
    this.#readyResolve();
  }

  /** @type {(identifiers: string[]) => Promise<void>} */
  async load(identifiers) {
    for (const identifier of identifiers) {
      await this.#loadOne(identifier);
    }
  }

  /** @type {(identifier: string) => Promise<void>} */
  async #loadOne(identifier) {
    // Already done — nothing to do.
    if (this.#loaded.has(identifier)) {
      return;
    }

    // In-flight — join the existing promise instead of starting a duplicate.
    if (this.#loading.has(identifier)) {
      return this.#loading.get(identifier);
    }

    // Start the load and register the promise *synchronously* before the first
    // await so any concurrent caller sees it immediately.
    const promise = this.#doLoad(identifier);
    this.#loading.set(identifier, promise);

    try {
      await promise;
    } finally {
      // Remove so a future load() can retry if this attempt failed.
      this.#loading.delete(identifier);
    }
  }

  /** @type {(identifier: string) => Promise<void>} */
  async #doLoad(identifier) {
    if (!this.#trusted.has(identifier)) {
      const response = await this.#connection.window.showWarningMessage(
        `This workspace wants to load a custom vocabulary: "${identifier}". `
        + `It will be fetched from esm.sh and executed in the language server. `
        + `Only allow this if you trust the source.`,
        { title: "Allow" },
        { title: "Deny" }
      );

      if (response?.title !== "Allow") {
        this.#connection.console.log(`Vocabulary "${identifier}" was denied.`);
        return;
      }

      this.#trusted.add(identifier);

      await this.#connection.sendNotification(
        "custom/persistTrustedVocab",
        { identifier }
      );
    }

    try {
      // Import the vocab package from esm.sh. Registration happens as a side
      // effect of the import — the package calls defineVocabulary/loadDialect
      // internally. We do NOT call mod.default() because the example package
      // (and the expected contract) is side-effect-based, not function-call-based.
      await /* @vite-ignore */ import(`https://esm.sh/${identifier}`);
      this.#connection.console.log(`Vocabulary "${identifier}" loaded successfully.`);
      this.#loaded.add(identifier);
    } catch (error) {
      this.#connection.console.error(
        `Failed to load vocabulary "${identifier}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
