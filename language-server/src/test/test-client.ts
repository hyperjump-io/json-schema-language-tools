import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { Duplex } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigurationRequest,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  ExitNotification,
  FileChangeType,
  InitializedNotification,
  InitializeRequest,
  RegistrationRequest,
  SemanticTokensRefreshRequest,
  SemanticTokensRequest,
  ShutdownRequest,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node.js";
import { URI } from "vscode-uri";
import { merge } from "merge-anything";
import { buildServer } from "../build-server.js";
import { wait } from "./test-utils.ts";
import { resolveIri } from "../util/util.js";

import type {
  Connection,
  DidChangeConfigurationRegistrationOptions,
  InitializeParams,
  ServerCapabilities
} from "vscode-languageserver";


export class TestClient<Configuration> {
  private client: Connection;
  private serverName: string;
  private _serverCapabilities: ServerCapabilities | undefined;
  private _settings: Partial<Configuration> | undefined;
  private configurationChangeNotificationOptions: DidChangeConfigurationRegistrationOptions | null | undefined;
  private openDocuments: Set<string>;
  private workspaceFolder: Promise<string>;
  private watchEnabled: boolean;

  onRequest: Connection["onRequest"];
  sendRequest: Connection["sendRequest"];
  onNotification: Connection["onNotification"];
  sendNotification: Connection["sendNotification"];
  onProgress: Connection["onProgress"];
  sendProgress: Connection["sendProgress"];

  constructor(serverName = "jsonSchemaLanguageServer") {
    this.serverName = serverName;
    this.watchEnabled = false;
    this.openDocuments = new Set();
    this.workspaceFolder = mkdtemp(join(tmpdir(), "test-workspace-"))
      .then((path) => URI.file(path).toString() + "/");

    const up = new TestStream();
    const down = new TestStream();

    const connection = createConnection(up, down);

    const server = buildServer(connection);
    server.listen();

    this.client = createConnection(down, up);
    this.onRequest = this.client.onRequest.bind(this.client);
    this.sendRequest = this.client.sendRequest.bind(this.client);
    this.onNotification = this.client.onNotification.bind(this.client);
    this.sendNotification = this.client.sendNotification.bind(this.client);
    this.onProgress = this.client.onProgress.bind(this.client);
    this.sendProgress = this.client.sendProgress.bind(this.client);

    this.client.onRequest(RegistrationRequest.type, ({ registrations }) => {
      for (const registration of registrations) {
        if (registration.method === DidChangeConfigurationNotification.method) {
          this.configurationChangeNotificationOptions = registration.registerOptions === undefined
            ? null
            : registration.registerOptions as DidChangeConfigurationRegistrationOptions;
        } else if (registration.method === DidChangeWatchedFilesNotification.method) {
          this.watchEnabled = true;
        } else {
          throw Error(`Unsupported Registration: '${registration.method}'`);
        }
      }
    });

    this.client.onRequest(SemanticTokensRefreshRequest.type, async () => {
      for (const uri of this.openDocuments) {
        await this.client.sendRequest(SemanticTokensRequest.type, {
          textDocument: { uri }
        });
      }
    });

    this.client.onRequest(WorkDoneProgressCreateRequest.type, () => {
      // Nothing to do
    });

    this.client.onRequest(ConfigurationRequest.type, (params) => {
      return params.items
        .filter((configurationItem) => configurationItem.section === this.serverName)
        .map(() => {
          return this._settings;
        });
    });

    this.client.listen();
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
        },
        textDocument: {
          semanticTokens: {
            dynamicRegistration: true,
            tokenTypes: [
              "namespace",
              "type",
              "class",
              "enum",
              "interface",
              "struct",
              "typeParameter",
              "parameter",
              "variable",
              "property",
              "enumMember",
              "event",
              "function",
              "method",
              "macro",
              "keyword",
              "modifier",
              "comment",
              "string",
              "number",
              "regexp",
              "operator",
              "decorator"
            ],
            tokenModifiers: [
              "declaration",
              "definition",
              "readonly",
              "static",
              "deprecated",
              "abstract",
              "async",
              "modification",
              "documentation",
              "defaultLibrary"
            ],
            formats: ["relative"],
            requests: {
              range: true,
              full: {
                delta: true
              }
            },
            multilineTokenSupport: false,
            overlappingTokenSupport: false,
            serverCancelSupport: true,
            augmentsSyntaxTokens: true
          }
        }
      },
      workspaceFolders: [
        {
          name: "root",
          uri: await this.workspaceFolder
        }
      ]
    };

    const initializeResult = await this.client.sendRequest(InitializeRequest.type, merge(defaultInitParams, params));
    this._serverCapabilities = initializeResult.capabilities;

    await this.client.sendNotification(InitializedNotification.type, {});

    // Wait for dynamic registrations to be completed
    await wait(100);

    await this.changeConfiguration(this._settings ?? {});
  }

  async stop() {
    await this.client.sendRequest(ShutdownRequest.type);
    await this.client.sendNotification(ExitNotification.type);
    await rm(fileURLToPath(await this.workspaceFolder), { recursive: true });
    this.client.dispose();
  }

  async changeConfiguration(settings: Partial<Configuration>) {
    this._settings = settings;

    const buildCompleted = this.buildCompleted();

    if (this.configurationChangeNotificationOptions === null) {
      await this.client.sendNotification(DidChangeConfigurationNotification.type, {
        settings: null
      });
    } else if (this.configurationChangeNotificationOptions) {
      await this.client.sendNotification(DidChangeConfigurationNotification.type, {
        settings: {
          [this.serverName]: this._settings
        }
      });
    }

    await buildCompleted;
  }

  async writeDocument(uri: string, text: string) {
    const fullUri = resolveIri(uri, await this.workspaceFolder);
    const exists = await access(fullUri).then(() => true).catch(() => false);

    await writeFile(fileURLToPath(fullUri), text, "utf-8");

    const buildCompleted = this.buildCompleted();

    if (this.watchEnabled) {
      await this.client.sendNotification(DidChangeWatchedFilesNotification.type, {
        changes: [{
          type: exists ? FileChangeType.Changed : FileChangeType.Created,
          uri: fullUri
        }]
      });
    }

    await buildCompleted;

    return fullUri;
  }

  async deleteDocument(uri: string) {
    const fullUri = resolveIri(uri, await this.workspaceFolder);

    await rm(fileURLToPath(fullUri));

    const buildCompleted = this.buildCompleted();

    if (this.watchEnabled) {
      await this.client.sendNotification(DidChangeWatchedFilesNotification.type, {
        changes: [{
          type: FileChangeType.Deleted,
          uri: fullUri
        }]
      });
    }

    await buildCompleted;

    return fullUri;
  }

  async openDocument(uri: string) {
    const documentUri = resolveIri(uri, await this.workspaceFolder);

    await this.client.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: documentUri,
        languageId: "json",
        version: 0,
        text: await readFile(fileURLToPath(documentUri), "utf-8")
      }
    });

    this.openDocuments.add(documentUri);

    return documentUri;
  }

  async closeDocument(uri: string) {
    this.openDocuments.delete(uri);

    await this.client.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: {
        uri: uri
      }
    });
  }

  // TODO: Duplicated code
  private buildCompleted() {
    return new Promise<void>((resolve) => {
      this.client.onRequest(WorkDoneProgressCreateRequest.type, ({ token }) => {
        this.client.onProgress(WorkDoneProgress.type, token, ({ kind }) => {
          if (kind === "end") {
            resolve();
          }
        });
      });
    });
  }
}

export class TestStream extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit("data", chunk);
    done();
  }

  _read() {
  }
}
