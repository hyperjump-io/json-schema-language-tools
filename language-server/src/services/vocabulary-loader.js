import { getDialectIds } from "@hyperjump/json-schema/experimental";

/**
 * @import { Connection } from "vscode-languageserver"
 * @import { Configuration } from "./configuration.js"
 * @import { Server } from "./server.js"
 */

// Packages that must be resolved from the local server bundle rather than
// fetched fresh from esm.sh.  Passed as the `?external=` query param so
// esm.sh leaves their imports as bare specifiers — the https-loader then
// redirects those bare specifiers to the local node_modules copy, giving the
// remote vocab package the exact same module instance as the bundled server.
const ESM_EXTERNALS = [
  "@hyperjump/json-schema",
  "@hyperjump/json-schema/draft-04",
  "@hyperjump/json-schema/draft-06",
  "@hyperjump/json-schema/draft-07",
  "@hyperjump/json-schema/draft-2019-09",
  "@hyperjump/json-schema/draft-2020-12",
  "@hyperjump/json-schema/openapi-3-0",
  "@hyperjump/json-schema/openapi-3-1",
  "@hyperjump/json-schema/openapi-3-2",
  "@hyperjump/json-schema/experimental",
  "@hyperjump/json-schema/instance/experimental",
  "@hyperjump/json-schema/annotations",
  "@hyperjump/json-schema/annotations/experimental",
  "@hyperjump/json-schema/annotated-instance/experimental",
  "@hyperjump/json-schema/bundle",
  "@hyperjump/json-schema/formats",
  "@hyperjump/json-schema/formats-lite",
  "@hyperjump/browser"
].join(",");

export class VocabularyLoader {
  #connection;
  #configuration;
  #server;

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

  /** @type {import("vscode-languageserver").ClientCapabilities | undefined} */
  #clientCapabilities;

  /**
   * @param {Connection} connection
   * @param {Configuration} configuration
   * @param {Server} server
   * @param {string[]} [initialTrusted]
   */
  constructor(connection, configuration, server, initialTrusted = []) {
    this.#connection = connection;
    this.#trusted = new Set(initialTrusted);
    this.#loaded = new Set();
    this.#loading = new Map();
    this.#configuration = configuration;
    this.#server = server;

    server.onInitialize((params) => {
      /** @type {string[]} */
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const trusted = params.initializationOptions?.trustedVocabularies ?? [];
      this.addTrusted(trusted);
      this.setClientCapabilities(params.capabilities);
      return { capabilities: {} };
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    server.onInitialized(async () => {
      try {
        const { customVocabularies } = await this.#configuration.get();
        await this.load(customVocabularies);
      } finally {
        this.markReady();
      }
    });

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

  /** @type {(capabilities: import("vscode-languageserver").ClientCapabilities) => void} */
  setClientCapabilities(capabilities) {
    this.#clientCapabilities = capabilities;
  }

  /** @type {(identifiers: string[]) => Promise<void>} */
  async load(identifiers) {
    const newIdentifiers = identifiers.filter((id) => !this.#loaded.has(id));
    if (newIdentifiers.length === 0) {
      return;
    }
    this.#connection.console.log(`Configured custom vocabularies: ${JSON.stringify(identifiers)}`);
    for (const identifier of identifiers) {
      await this.#loadOne(identifier);
    }
    this.#connection.console.log(`Registered dialects: ${JSON.stringify(getDialectIds())}`);
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
      const supportsPopup = this.#clientCapabilities?.window?.showMessage !== undefined;

      if (!supportsPopup) {
        this.#connection.console.log(`Vocabulary "${identifier}" skipped: client does not support confirmation dialogs (e.g. Neovim).`);
        return;
      }

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
      const mod = await import(`https://esm.sh/${identifier}?external=${ESM_EXTERNALS}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof mod.default === "function") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await mod.default();
      }
      this.#connection.console.log(`Vocabulary "${identifier}" loaded successfully.`);
      this.#loaded.add(identifier);
    } catch (error) {
      this.#connection.console.error(
        `Failed to load vocabulary "${identifier}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
