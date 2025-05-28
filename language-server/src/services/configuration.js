import { DidChangeConfigurationNotification } from "vscode-languageserver";
import ignore from "ignore";
import { pick } from "../util/util.js";

/**
 * @import { DidChangeConfigurationParams, NotificationHandler } from "vscode-languageserver"
 * @import { Server } from "./server.js";
 */


/**
 * @typedef {{
 *   defaultDialect?: string;
 *   schemaFilePatterns: string[];
 * }} LanguageServerSettings
 */

/**
 * @typedef {{
 *   tabSize?: number;
 *   insertSpaces?: boolean;
 *   detectIndentation: boolean;
 * }} EditorSettings
 */

/**
 * @typedef {{
 *   eol?: string;
 * }} FilesSettings
 */

/**
 * @typedef {LanguageServerSettings & EditorSettings & FilesSettings} DocumentSettings
 */

/**
 * @typedef {[
 *   Partial<LanguageServerSettings> | null,
 *   Partial<EditorSettings> | null,
 *   Partial<FilesSettings> | null
 * ]} Settings
 */

export class Configuration {
  #server;

  /** @type DocumentSettings | undefined */
  #settings;

  /** @type DocumentSettings */
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
      const settings = /** @type Settings */ (await this.#server.workspace.getConfiguration([
        { section: "jsonSchemaLanguageServer" },
        { section: "editor" },
        { section: "files" }
      ]));
      const [languageServerSettings, editorSettings, filesSettings] = settings;

      this.#settings = {
        ...this.#defaultSettings,
        ...languageServerSettings,
        ...pick(editorSettings ?? {}, "tabSize", "insertSpaces", "detectIndentation"),
        ...pick(filesSettings ?? {}, "eol")
      };
    }

    return this.#settings;
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
