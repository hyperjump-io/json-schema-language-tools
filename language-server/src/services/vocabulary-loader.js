/**
 * @import { Connection } from "vscode-languageserver"
 */

export class VocabularyLoader {
  #connection;

  /** @type {Set<string>} */
  #trusted;

  /** @type {Set<string>} */
  #loaded;

  /** @type {Map<string, Promise<void>>} */
  #loading;

  /** @param {Connection} connection */
  constructor(connection) {
    this.#connection = connection;
    this.#trusted = new Set();
    this.#loaded = new Set();
    this.#loading = new Map();

    // Listen for trust confirmations from the extension
    this.#connection.onNotification(
      "custom/addTrustedVocab",
      (/** @type {{ identifier: string }} */ { identifier }) => {
        this.#trusted.add(identifier);
      }
    );
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = await import(`https://esm.sh/${identifier}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof mod.default === "function") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await mod.default();
      }
      // Only mark loaded after successful registration.
      this.#loaded.add(identifier);
    } catch (error) {
      this.#connection.console.error(
        `Failed to load vocabulary "${identifier}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
