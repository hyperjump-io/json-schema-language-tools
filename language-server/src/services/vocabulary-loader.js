/**
 * @import { Connection } from "vscode-languageserver"
 */

export class VocabularyLoader {
  #connection;

  /** @type Set<string> */
  #trusted;

  /** @param {Connection} connection */
  constructor(connection) {
    this.#connection = connection;
    this.#trusted = new Set();

    // Listen for trust confirmations from the extension
    this.#connection.onNotification(
      "custom/addTrustedVocab",
      (/** @type {{ identifier: string }} */ { identifier }) => {
        this.#trusted.add(identifier);
      }
    );
  }

  /** @type (identifiers: string[]) => Promise<void> */
  async load(identifiers) {
    for (const identifier of identifiers) {
      await this.#loadOne(identifier);
    }
  }

  /** @type (identifier: string) => Promise<void> */
  async #loadOne(identifier) {
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
      const redirectRes = await fetch(`https://esm.sh/${identifier}`);
      const redirectCode = await redirectRes.text();

      const match = /from "(\/.+?)"/.exec(redirectCode);
      if (!match) {
        throw new Error("Could not resolve module path from esm.sh");
      }

      const actualUrl = `https://esm.sh${match[1]}`;
      const res = await fetch(actualUrl);
      const code = await res.text();

      const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = await import(dataUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      if (typeof mod.default === "function") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await mod.default();
      } else {
        this.#connection.console.warn(`Vocabulary "${identifier}" does not export a default function.`);
      }
    } catch (error) {
      this.#connection.console.error(`Failed to load vocabulary "${identifier}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
