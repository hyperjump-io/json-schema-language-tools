/**
 * @import { Server } from "./server.js"
 */


export const GET_TRUSTED_VOCABULARIES = "jsonSchemaLanguageServer/getTrustedVocabularies";
export const TRUST_VOCABULARY = "jsonSchemaLanguageServer/trustVocabulary";

export const TRUST_ACTION = "Trust and Load";
export const DENY_ACTION = "Don't Load";

/**
 * Remembers which custom vocabularies the user has agreed to run.
 *
 * Trust decisions are persisted by the client (for example, VS Code's
 * `globalState`) rather than by the server. The server asks for the list with a
 * custom request, and reports new decisions with another. Persisting on the
 * client keeps the decision out of the workspace so it can't be committed to a
 * repository and trusted on someone else's machine.
 *
 * If a client doesn't implement the custom requests, trust only lasts for the
 * life of the server process and the user is asked again next session.
 */
export class TrustedVocabularies {
  #server;

  /** @type Set<string> */
  #sessionTrusted;

  /** @type Set<string> */
  #sessionDenied;

  /**
   * @param {Server} server
   */
  constructor(server) {
    this.#server = server;
    this.#sessionTrusted = new Set();
    this.#sessionDenied = new Set();
  }

  /**
   * Resolves `true` if the vocabulary is trusted, asking the user if needed.
   *
   * @type (specifier: string) => Promise<boolean>
   */
  async confirm(specifier) {
    if (this.#sessionDenied.has(specifier)) {
      return false;
    }

    if (this.#sessionTrusted.has(specifier) || (await this.#persisted()).includes(specifier)) {
      return true;
    }

    const response = await this.#server.window.showWarningMessage(
      `The JSON Schema language server wants to download and run the custom vocabulary "${specifier}" from esm.sh. `
      + "Only continue if you trust this package and the person who asked you to use it. "
      + "It will run with the same permissions as your editor and can access your files and network.",
      { title: TRUST_ACTION },
      { title: DENY_ACTION }
    );

    if (response?.title !== TRUST_ACTION) {
      this.#sessionDenied.add(specifier);
      return false;
    }

    this.#sessionTrusted.add(specifier);
    await this.#persist(specifier);
    return true;
  }

  /** @type () => Promise<string[]> */
  async #persisted() {
    try {
      /** @type unknown */
      const trusted = await this.#server.sendRequest(GET_TRUSTED_VOCABULARIES);
      return Array.isArray(trusted) ? trusted.filter((item) => typeof item === "string") : [];
    } catch (_error) {
      // The client doesn't support persisting trust
      return [];
    }
  }

  /** @type (specifier: string) => Promise<void> */
  async #persist(specifier) {
    try {
      await this.#server.sendRequest(TRUST_VOCABULARY, specifier);
    } catch (_error) {
      this.#server.console.log(`Unable to remember trust for ${specifier}. You will be asked again next session.`);
    }
  }
}
