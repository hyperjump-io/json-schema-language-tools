import * as hyperjump from "@hyperjump/json-schema/experimental";

/**
 * @import { Server } from "./server.js"
 * @import { Configuration } from "./configuration.js"
 * @import { TrustedVocabularies } from "./trusted-vocabularies.js"
 */


export const ESM_SH = "http://localhost:8000";

// An exact, published npm version: `name@1.2.3` or `@scope/name@1.2.3-beta.1`.
// Ranges and tags (`latest`) are refused because trusting a package has to mean
// trusting specific code, not whatever the package becomes later. This also
// rules out anything that could change the URL we fetch (paths, query strings,
// other hosts).
const specifierPattern = /^(?:@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * @typedef {(api: typeof hyperjump) => void | Promise<void>} VocabularySetup
 */

export class CustomVocabularies {
  #server;
  #configuration;
  #trusted;

  /** @type Set<string> */
  #loaded;

  /** @type Set<string> */
  #failed;

  /** @type Set<() => void | Promise<void>> */
  #didLoadHandlers;

  #pending;

  /**
   * @param {Server} server
   * @param {Configuration} configuration
   * @param {TrustedVocabularies} trusted
   */
  constructor(server, configuration, trusted) {
    this.#server = server;
    this.#configuration = configuration;
    this.#trusted = trusted;

    this.#loaded = new Set();
    this.#failed = new Set();
    this.#didLoadHandlers = new Set();
    this.#pending = Promise.resolve();

    this.#server.onInitialized(() => {
      this.#enqueue();
    });

    this.#configuration.onDidChangeConfiguration(() => {
      // Retry anything the user edited their way out of, but don't re-prompt for
      // a vocabulary they already declined or that is already loaded.
      this.#enqueue();
    });
  }

  /**
   * Registers a handler that is called after one or more vocabularies have been
   * loaded so that schemas that depend on them can be re-validated.
   *
   * @type (handler: () => void | Promise<void>) => void
   */
  onDidLoad(handler) {
    this.#didLoadHandlers.add(handler);
  }

  /** @type () => Promise<void> */
  async idle() {
    await this.#pending;
  }

  #enqueue() {
    // Loading is serialized so two configuration changes in a row can't prompt
    // for, or load, the same vocabulary twice.
    this.#pending = this.#pending.then(() => this.#sync()).catch((error) => {
      this.#server.console.error(`Failed to load custom vocabularies: ${errorMessage(error)}`);
    });
  }

  /** @type () => Promise<void> */
  async #sync() {
    const { customVocabularies = [] } = await this.#configuration.get();
    if (!Array.isArray(customVocabularies)) {
      return;
    }

    let loadedAny = false;
    for (const specifier of new Set(customVocabularies)) {
      if (this.#loaded.has(specifier) || this.#failed.has(specifier)) {
        continue;
      }

      if (await this.#load(specifier)) {
        loadedAny = true;
      }
    }

    if (loadedAny) {
      for (const handler of this.#didLoadHandlers) {
        await handler();
      }
    }
  }

  /** @type (specifier: unknown) => Promise<boolean> */
  async #load(specifier) {
    if (typeof specifier !== "string" || !specifierPattern.test(specifier)) {
      this.#server.window.showErrorMessage(
        `Invalid custom vocabulary "${String(specifier)}". Use an npm package with an exact version, such as "my-vocabulary@1.0.0".`
      );
      this.#failed.add(String(specifier));
      return false;
    }

    // Every failure path below is remembered so the same broken or declined
    // vocabulary doesn't prompt or error again on each configuration change.
    this.#failed.add(specifier);

    if (!await this.#trusted.confirm(specifier)) {
      this.#server.console.log(`Custom vocabulary not trusted, skipping: ${specifier}`);
      return false;
    }

    try {
      const setup = await importFromEsmSh(specifier);
      await setup(hyperjump);
    } catch (error) {
      this.#server.window.showErrorMessage(`Unable to load custom vocabulary "${specifier}": ${errorMessage(error)}`);
      return false;
    }

    this.#failed.delete(specifier);
    this.#loaded.add(specifier);
    this.#server.console.log(`Loaded custom vocabulary: ${specifier}`);
    return true;
  }
}

/**
 * Node can't `import()` an https URL, and the modules esm.sh serves import
 * their dependencies by absolute path, so we ask for a standalone bundle and
 * import the source text directly. Packages must not depend on
 * `@hyperjump/json-schema` themselves. The language server passes its own
 * instance to the package's setup function so vocabularies are registered where
 * the server can see them.
 *
 * @type (specifier: string) => Promise<VocabularySetup>
 */
const importFromEsmSh = async (specifier) => {
  const response = await fetch(`${ESM_SH}/${specifier}?standalone`, { redirect: "follow" });
  if (!response.ok) {
    throw Error(`esm.sh responded with ${response.status} ${response.statusText}`);
  }

  const source = await response.text();
  /** @type {{ default?: unknown }} */
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`); // eslint-disable-line @typescript-eslint/no-unsafe-assignment

  if (typeof module.default !== "function") {
    throw Error("The package must have a function as its default export");
  }

  return /** @type VocabularySetup */ (module.default);
};

/** @type (error: unknown) => string */
const errorMessage = (error) => error instanceof Error ? error.message : String(error);
