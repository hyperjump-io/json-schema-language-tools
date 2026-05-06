/**
 * @import { Connection } from "vscode-languageserver"
 */

// Packages that must be resolved from the local server bundle rather than
// fetched fresh from esm.sh.  Passed as the `?external=` query param so
// esm.sh leaves their imports as bare specifiers — the https-loader then
// redirects those bare specifiers to the local node_modules copy, giving the
// remote vocab package the exact same module instance as the bundled server.
const ESM_EXTERNALS = [
  "@hyperjump/json-schema",
  "@hyperjump/browser"
].join(",");

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
      // Import the vocab package from esm.sh.
      //
      // The `?external=` param tells esm.sh to leave @hyperjump/* imports as
      // bare specifiers instead of rewriting them to esm.sh CDN URLs.  The
      // https-loader's resolve hook then intercepts those bare specifiers and
      // points them at the local node_modules copy, so defineVocabulary /
      // loadDialect calls land on the same instance the server already uses.
      //
      // Registration happens as a side effect of the import — the package
      // calls defineVocabulary/loadDialect internally on import, so we do
      // not need to call mod.default().
      await /* @vite-ignore */ import(`https://esm.sh/${identifier}?external=${ESM_EXTERNALS}`);
      this.#connection.console.log(`Vocabulary "${identifier}" loaded successfully.`);
      this.#loaded.add(identifier);
    } catch (error) {
      this.#connection.console.error(
        `Failed to load vocabulary "${identifier}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
