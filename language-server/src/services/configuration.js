import { fileURLToPath } from "node:url";
import { DidChangeConfigurationNotification } from "vscode-languageserver";
import picomatch from "picomatch";

/**
 * @import { DidChangeConfigurationParams, NotificationHandler } from "vscode-languageserver"
 * @import { Server } from "./server.js";
 */


/**
 * @typedef {{
 *   defaultDialect?: string;
 *   schemaFilePatterns: string[];
 * }} DocumentSettings
 */

/**
 * @typedef {{
 *   jsonSchemaLanguageServer?: DocumentSettings;
 * }} Settings
 */

export class Configuration {
  #server;

  /** @type DocumentSettings | undefined */
  #settings;
  /** @type Partial<DocumentSettings> */
  #defaultSettings;

  /** @type ((uri: string) => boolean) | undefined */
  #matcher;

  /** @type NotificationHandler<DidChangeConfigurationParams>[] */
  #didChangeConfigurationHandlers;

  /**
   * @param {Server} server
   */
  constructor(server) {
    this.#server = server;

    this.#defaultSettings = {
      schemaFilePatterns: ["**/*.schema.json", "**/schema.json"]
    };

    let hasDidChangeConfigurationCapability = false;

    this.#server.onInitialize(({ capabilities }) => {
      hasDidChangeConfigurationCapability = !!capabilities.workspace?.didChangeConfiguration?.dynamicRegistration;

      return { capabilities: {} };
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.#server.onInitialized(async () => {
      if (hasDidChangeConfigurationCapability) {
        await this.#server.client.register(DidChangeConfigurationNotification.type, {
          section: "jsonSchemaLanguageServer"
        });
      }
    });

    this.#didChangeConfigurationHandlers = [];

    this.#server.onDidChangeConfiguration((params) => {
      /** @type unknown */
      const settings = params.settings;

      /** @type unknown */
      const fullSettings = {
        ...this.#defaultSettings,
        .../** @type Settings */(settings).jsonSchemaLanguageServer
      };
      this.#settings = /** @type DocumentSettings */ (fullSettings);
      this.#matcher = undefined;

      for (const handler of this.#didChangeConfigurationHandlers) {
        handler(params);
      }
    });
  }

  /** @type () => Promise<DocumentSettings> */
  async get() {
    if (!this.#settings) {
      /** @type unknown */
      const result = await this.#server.workspace.getConfiguration({
        section: "jsonSchemaLanguageServer"
      });
      const settings = result ?? {};
      /** @type unknown */
      const fullSettings = { ...this.#defaultSettings, ...settings };
      this.#settings = /** @type DocumentSettings */ (fullSettings);
      this.#matcher = undefined;
    }

    return /** @type DocumentSettings */ (this.#settings);
  }

  /** @type (uri: string) => Promise<boolean> */
  async isSchema(uri) {
    if (!this.#matcher) {
      const { schemaFilePatterns } = await this.get();
      this.#matcher = picomatch(schemaFilePatterns);
    }

    const path = fileURLToPath(uri);
    return this.#matcher(path);
  }

  /** @type (handler: NotificationHandler<DidChangeConfigurationParams>) => void */
  onDidChangeConfiguration(handler) {
    this.#didChangeConfigurationHandlers.push(handler);
  }
}
