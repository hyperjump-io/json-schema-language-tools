import { merge } from "merge-anything";

/**
 * @import {
 *   Connection,
 *   HandlerResult,
 *   InitializedParams,
 *   InitializeError,
 *   InitializeParams,
 *   InitializeResult,
 *   NotificationHandler,
 *   NotificationHandler0,
 *   RequestHandler0,
 *   ServerRequestHandler
 * } from "vscode-languageserver"
 */

/** @implements Connection */
export class Server {
  #connection;

  /** @type Set<ServerRequestHandler<InitializeParams, InitializeResult, never, InitializeError>> */
  #initializeHandlers;

  /** @type Set<NotificationHandler<InitializedParams>> */
  #initializedHandlers;

  /** @type Set<RequestHandler0<void, void>> */
  #shutdownHandlers;

  /** @type Set<NotificationHandler0> */
  #exitHandlers;

  /**
   * @param {Connection} connection
   */
  constructor(connection) {
    this.#connection = connection;

    this.listen = this.#connection.listen;
    this.onRequest = this.#connection.onRequest;
    this.sendRequest = this.#connection.sendRequest;
    this.onNotification = this.#connection.onNotification;
    this.sendNotification = this.#connection.sendNotification;
    this.onProgress = this.#connection.onProgress;
    this.sendProgress = this.#connection.sendProgress;

    this.#initializeHandlers = new Set();
    this.#connection.onInitialize((params, token, workDoneProgress) => {
      connection.console.log("Initializing JSON Schema service ...");

      /** @type HandlerResult<InitializeResult, InitializeError> */
      let initializeResult = {
        capabilities: {}
      };
      for (const handler of this.#initializeHandlers) {
        const handlerResult = handler(params, token, workDoneProgress);
        initializeResult = merge(initializeResult, handlerResult);
      }

      return initializeResult;
    });

    this.#initializedHandlers = new Set();
    this.#connection.onInitialized((params) => {
      for (const handler of this.#initializedHandlers) {
        handler(params);
      }
    });

    this.#shutdownHandlers = new Set();
    this.#connection.onShutdown(async (params) => {
      for (const handler of this.#shutdownHandlers) {
        await handler(params);
      }
    });

    this.#exitHandlers = new Set();
    this.#connection.onExit(() => {
      for (const handler of this.#exitHandlers) {
        handler();
      }
    });

    this.onDidChangeConfiguration = this.#connection.onDidChangeConfiguration;
    this.onDidChangeWatchedFiles = this.#connection.onDidChangeWatchedFiles;
    this.onDidOpenTextDocument = this.#connection.onDidOpenTextDocument;
    this.onDidChangeTextDocument = this.#connection.onDidChangeTextDocument;
    this.onDidCloseTextDocument = this.#connection.onDidCloseTextDocument;
    this.onWillSaveTextDocument = this.#connection.onWillSaveTextDocument;
    this.onWillSaveTextDocumentWaitUntil = this.#connection.onWillSaveTextDocumentWaitUntil;
    this.onDidSaveTextDocument = this.#connection.onDidSaveTextDocument;
    this.sendDiagnostics = this.#connection.sendDiagnostics;
    this.onHover = this.#connection.onHover;
    this.onCompletion = this.#connection.onCompletion;
    this.onCompletionResolve = this.#connection.onCompletionResolve;
    this.onSignatureHelp = this.#connection.onSignatureHelp;
    this.onDeclaration = this.#connection.onDeclaration;
    this.onDefinition = this.#connection.onDefinition;
    this.onTypeDefinition = this.#connection.onTypeDefinition;
    this.onImplementation = this.#connection.onImplementation;
    this.onReferences = this.#connection.onReferences;
    this.onDocumentHighlight = this.#connection.onDocumentHighlight;
    this.onDocumentSymbol = this.#connection.onDocumentSymbol;
    this.onWorkspaceSymbol = this.#connection.onWorkspaceSymbol;
    this.onWorkspaceSymbolResolve = this.#connection.onWorkspaceSymbolResolve;
    this.onCodeAction = this.#connection.onCodeAction;
    this.onCodeActionResolve = this.#connection.onCodeActionResolve;
    this.onCodeLens = this.#connection.onCodeLens;
    this.onCodeLensResolve = this.#connection.onCodeLensResolve;
    this.onDocumentFormatting = this.#connection.onDocumentFormatting;
    this.onDocumentRangeFormatting = this.#connection.onDocumentRangeFormatting;
    this.onDocumentOnTypeFormatting = this.#connection.onDocumentOnTypeFormatting;
    this.onRenameRequest = this.#connection.onRenameRequest;
    this.onPrepareRename = this.#connection.onPrepareRename;
    this.onDocumentLinks = this.#connection.onDocumentLinks;
    this.onDocumentLinkResolve = this.#connection.onDocumentLinkResolve;
    this.onDocumentColor = this.#connection.onDocumentColor;
    this.onColorPresentation = this.#connection.onColorPresentation;
    this.onFoldingRanges = this.#connection.onFoldingRanges;
    this.onSelectionRanges = this.#connection.onSelectionRanges;
    this.onExecuteCommand = this.#connection.onExecuteCommand;
    this.dispose = this.#connection.dispose;
  }

  /** @type Connection["onInitialize"] */
  onInitialize(handler) {
    this.#initializeHandlers.add(handler);
    return {
      dispose: () => {
        this.#initializeHandlers.delete(handler);
      }
    };
  }

  /** @type Connection["onInitialized"] */
  onInitialized(handler) {
    this.#initializedHandlers.add(handler);
    return {
      dispose: () => {
        this.#initializedHandlers.delete(handler);
      }
    };
  }

  /** @type Connection["onShutdown"] */
  onShutdown(handler) {
    this.#shutdownHandlers.add(handler);
    return {
      dispose: () => {
        this.#shutdownHandlers.delete(handler);
      }
    };
  }

  /** @type Connection["onExit"] */
  onExit(handler) {
    this.#exitHandlers.add(handler);
    return {
      dispose: () => {
        this.#exitHandlers.delete(handler);
      }
    };
  }

  get console() {
    return this.#connection.console;
  }

  get tracer() {
    return this.#connection.tracer;
  }

  get telemetry() {
    return this.#connection.telemetry;
  }

  get client() {
    return this.#connection.client;
  }

  get window() {
    return this.#connection.window;
  }

  get workspace() {
    return this.#connection.workspace;
  }

  get languages() {
    return this.#connection.languages;
  }

  get notebooks() {
    return this.#connection.notebooks;
  }
}
