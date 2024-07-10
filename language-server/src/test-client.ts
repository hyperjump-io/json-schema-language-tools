import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Duplex } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ConfigurationRequest,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializedNotification,
  InitializeRequest,
  RegistrationRequest,
  SemanticTokensRefreshRequest,
  SemanticTokensRequest,
  ShutdownRequest,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node.js";
import { resolveIri } from "@hyperjump/uri";
import { merge } from "merge-anything";
import { buildServer } from "./build-server.js";
import { wait } from "./test-utils.js";

import type {
  Connection,
  DidChangeConfigurationRegistrationOptions,
  InitializeParams,
  ServerCapabilities
} from "vscode-languageserver";
import type { Feature } from "./build-server.js";


export class TestClient<Configuration> {
  private _client: Connection;
  private _server: Connection;
  private _serverName: string;
  private _serverCapabilities: ServerCapabilities | undefined;
  private _settings: Partial<Configuration> | undefined;
  private _configurationChangeNotificationOptions: DidChangeConfigurationRegistrationOptions | null | undefined;
  private openDocuments: Set<string> = new Set();

  onRequest: Connection["onRequest"];
  sendRequest: Connection["sendRequest"];
  onNotification: Connection["onNotification"];
  sendNotification: Connection["sendNotification"];
  onProgress: Connection["onProgress"];
  sendProgress: Connection["sendProgress"];

  constructor(features: Feature[], serverName: string = "jsonSchemaLanguageServer") {
    this._serverName = serverName;

    const up = new TestStream();
    const down = new TestStream();

    this._server = createConnection(up, down);
    buildServer(this._server, features);

    this._client = createConnection(down, up);
    this.onRequest = this._client.onRequest.bind(this._client);
    this.sendRequest = this._client.sendRequest.bind(this._client);
    this.onNotification = this._client.onNotification.bind(this._client);
    this.sendNotification = this._client.sendNotification.bind(this._client);
    this.onProgress = this._client.onProgress.bind(this._client);
    this.sendProgress = this._client.sendProgress.bind(this._client);

    this._client.onRequest(RegistrationRequest.type, ({ registrations }) => {
      for (const registration of registrations) {
        if (registration.method === DidChangeConfigurationNotification.method) {
          this._configurationChangeNotificationOptions = registration.registerOptions === undefined
            ? null
            : registration.registerOptions as DidChangeConfigurationRegistrationOptions;
        } else if (registration.method === DidChangeWatchedFilesNotification.method) {
          // Ignore for now
        } else {
          throw Error(`Unsupported Registration: '${registration.method}'`);
        }
      }
    });

    this._client.onRequest(SemanticTokensRefreshRequest.type, async () => {
      for (const uri of this.openDocuments) {
        await this._client.sendRequest(SemanticTokensRequest.type, {
          textDocument: { uri }
        });
      }
    });

    this._client.onRequest(WorkDoneProgressCreateRequest.type, () => {
      // Nothing to do
    });

    this._client.onRequest(ConfigurationRequest.type, (params) => {
      return params.items
        .filter((configurationItem) => configurationItem.section === this._serverName)
        .map(() => {
          return this._settings;
        });
    });

    this._client.listen();
  }

  get serverCapabilities() {
    return structuredClone(this._serverCapabilities);
  }

  get settings() {
    return structuredClone(this._settings);
  }

  async start(params: Partial<InitializeParams> = {}) {
    const defaultInitParams: InitializeParams = {
      processId: null,
      rootUri: null,
      capabilities: {
        workspace: {
          workspaceFolders: true,
          didChangeWatchedFiles: {
            dynamicRegistration: true
          },
          configuration: true,
          didChangeConfiguration: {
            dynamicRegistration: true
          }
        },
        window: {
          workDoneProgress: true
        }
      }
    };
    const initializeResult = await this._client.sendRequest(InitializeRequest.type, merge(defaultInitParams, params));
    this._serverCapabilities = initializeResult.capabilities;

    await this._client.sendNotification(InitializedNotification.type, {});

    // Wait for dynamic registrations to be completed
    await wait(100);
  }

  async stop() {
    await this._client.sendRequest(ShutdownRequest.type);
    await this._client.sendNotification(ExitNotification.type);
    this._client.dispose();
  }

  async changeConfiguration(settings: Partial<Configuration>) {
    this._settings = settings;

    if (this._configurationChangeNotificationOptions === null) {
      await this._client.sendNotification(DidChangeConfigurationNotification.type, {
        settings: null
      });
    } else if (this._configurationChangeNotificationOptions) {
      await this._client.sendNotification(DidChangeConfigurationNotification.type, {
        settings: {
          [this._serverName]: this._settings
        }
      });
    }

    // Wait for workspace rebuild to complete
    await wait(100);
  }

  async openDocument(uri: string, text?: string) {
    const baseUri = pathToFileURL(`/${randomUUID()}/`).toString();
    const documentUri = resolveIri(uri, baseUri);

    await this._client.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: documentUri,
        languageId: "json",
        version: 0,
        text: text ?? await readFile(fileURLToPath(uri), "utf-8")
      }
    });

    this.openDocuments.add(documentUri);

    return documentUri;
  }

  async closeDocument(uri: string) {
    this.openDocuments.delete(uri);

    await this._client.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: {
        uri: uri
      }
    });
  }
}

export class TestStream extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit("data", chunk);
    done();
  }

  _read(_size: number) {
  }
}
