import { fileURLToPath } from "node:url";
import picomatch from "picomatch";

/**
 * @import { Connection, DidChangeConfigurationParams, NotificationHandler } from "vscode-languageserver"
 */


/**
 * @typedef {{
 *   defaultDialect?: string;
 *   schemaFilePatterns: string[];
 * }} DocumentSettings
 */

export class Configuration {
  #connection;

  /** @type DocumentSettings | undefined */
  #settings;
  /** @type Partial<DocumentSettings> */
  #defaultSettings;

  /** @type ((uri: string) => boolean) | undefined */
  #matcher;

  /** @type NotificationHandler<DidChangeConfigurationParams>[] */
  #didChangeConfigurationHandlers;

  /**
   * @param {Connection} connection
   */
  constructor(connection) {
    this.#connection = connection;

    this.#defaultSettings = {
      schemaFilePatterns: ["**/*.schema.json", "**/schema.json"]
    };

    this.#didChangeConfigurationHandlers = [];

    this.#connection.onDidChangeConfiguration((params) => {
      this.#settings = { ...this.#defaultSettings, ...params.settings.jsonSchemaLanguageServer };
      this.#matcher = undefined;

      for (const handler of this.#didChangeConfigurationHandlers) {
        handler(params);
      }
    });
  }

  /** @type () => Promise<DocumentSettings> */
  async get() {
    if (!this.#settings) {
      const result = await this.#connection.workspace.getConfiguration({
        section: "jsonSchemaLanguageServer"
      }) ?? {};
      this.#settings = { ...this.#defaultSettings, ...result };
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
