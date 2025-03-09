import { DidChangeConfigurationNotification } from "vscode-languageserver";
import ignore from "ignore";

/**
 * @import { DidChangeConfigurationParams, NotificationHandler } from "vscode-languageserver"
 * @import { Server } from "./server.js";
 */


/**
 * @typedef {{
 *   defaultDialect?: string;
 *   schemaFilePatterns: string[];
 *   detectIndentation?: boolean;
 *   tabSize?: number;
 *   insertSpaces?: boolean;
 *   endOfLine: string;
 * }} DocumentSettings
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
      schemaFilePatterns: ["*.schema.json", "schema.json"],
      detectIndentation: true
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
      this.#settings = undefined;
      this.#matcher = undefined;

      for (const handler of this.#didChangeConfigurationHandlers) {
        handler(params);
      }
    });
  }

  /** @type () => Promise<DocumentSettings> */
  async get() {
    if (!this.#settings) {
      /** @type {unknown[]} */
      const config = await this.#server.workspace.getConfiguration([
        { section: "jsonSchemaLanguageServer" },
        { section: "editor" },
        { section: "files.eol" }
      ]);
      const [extensionSettings, editorSettings, eol] = /** @type [Partial<DocumentSettings> | null, Partial<DocumentSettings> | null, string | null] */ (config);
      const indentationSettings = {
        tabSize: editorSettings?.tabSize,
        insertSpaces: editorSettings?.insertSpaces,
        detectIndentation: editorSettings?.detectIndentation ?? this.#defaultSettings.detectIndentation,
        endOfLine: eol

      };

      const fullSettings = {
        ...this.#defaultSettings,
        ...extensionSettings,
        ...indentationSettings
      };

      this.#settings = /** @type DocumentSettings */ (fullSettings);
      this.#matcher = undefined;
    }

    return /** @type DocumentSettings */ (this.#settings);
  }

  /** @type (uri: string) => Promise<boolean> */
  async isSchema(uri) {
    if (!this.#matcher) {
      const { schemaFilePatterns } = await this.get();

      const matcher = ignore().add(schemaFilePatterns);
      this.#matcher = (path) => matcher.ignores(path);
    }

    return this.#matcher(uri);
  }

  /** @type (handler: NotificationHandler<DidChangeConfigurationParams>) => void */
  onDidChangeConfiguration(handler) {
    this.#didChangeConfigurationHandlers.push(handler);
  }
}
