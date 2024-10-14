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

    this.listen = this.#connection.listen; // eslint-disable-line @typescript-eslint/unbound-method
    this.onRequest = this.#connection.onRequest; // eslint-disable-line @typescript-eslint/unbound-method
    this.sendRequest = this.#connection.sendRequest; // eslint-disable-line @typescript-eslint/unbound-method
    this.onNotification = this.#connection.onNotification; // eslint-disable-line @typescript-eslint/unbound-method
    this.sendNotification = this.#connection.sendNotification; // eslint-disable-line @typescript-eslint/unbound-method
    this.onProgress = this.#connection.onProgress; // eslint-disable-line @typescript-eslint/unbound-method
    this.sendProgress = this.#connection.sendProgress; // eslint-disable-line @typescript-eslint/unbound-method

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

    this.onDidChangeConfiguration = this.#connection.onDidChangeConfiguration; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDidChangeWatchedFiles = this.#connection.onDidChangeWatchedFiles; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDidOpenTextDocument = this.#connection.onDidOpenTextDocument; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDidChangeTextDocument = this.#connection.onDidChangeTextDocument; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDidCloseTextDocument = this.#connection.onDidCloseTextDocument; // eslint-disable-line @typescript-eslint/unbound-method
    this.onWillSaveTextDocument = this.#connection.onWillSaveTextDocument; // eslint-disable-line @typescript-eslint/unbound-method
    this.onWillSaveTextDocumentWaitUntil = this.#connection.onWillSaveTextDocumentWaitUntil; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDidSaveTextDocument = this.#connection.onDidSaveTextDocument; // eslint-disable-line @typescript-eslint/unbound-method
    this.sendDiagnostics = this.#connection.sendDiagnostics; // eslint-disable-line @typescript-eslint/unbound-method
    this.onHover = this.#connection.onHover; // eslint-disable-line @typescript-eslint/unbound-method
    this.onCompletion = this.#connection.onCompletion; // eslint-disable-line @typescript-eslint/unbound-method
    this.onCompletionResolve = this.#connection.onCompletionResolve; // eslint-disable-line @typescript-eslint/unbound-method
    this.onSignatureHelp = this.#connection.onSignatureHelp; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDeclaration = this.#connection.onDeclaration; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDefinition = this.#connection.onDefinition; // eslint-disable-line @typescript-eslint/unbound-method
    this.onTypeDefinition = this.#connection.onTypeDefinition; // eslint-disable-line @typescript-eslint/unbound-method
    this.onImplementation = this.#connection.onImplementation; // eslint-disable-line @typescript-eslint/unbound-method
    this.onReferences = this.#connection.onReferences; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentHighlight = this.#connection.onDocumentHighlight; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentSymbol = this.#connection.onDocumentSymbol; // eslint-disable-line @typescript-eslint/unbound-method
    this.onWorkspaceSymbol = this.#connection.onWorkspaceSymbol; // eslint-disable-line @typescript-eslint/unbound-method
    this.onWorkspaceSymbolResolve = this.#connection.onWorkspaceSymbolResolve; // eslint-disable-line @typescript-eslint/unbound-method
    this.onCodeAction = this.#connection.onCodeAction; // eslint-disable-line @typescript-eslint/unbound-method
    this.onCodeActionResolve = this.#connection.onCodeActionResolve; // eslint-disable-line @typescript-eslint/unbound-method
    this.onCodeLens = this.#connection.onCodeLens; // eslint-disable-line @typescript-eslint/unbound-method
    this.onCodeLensResolve = this.#connection.onCodeLensResolve; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentFormatting = this.#connection.onDocumentFormatting; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentRangeFormatting = this.#connection.onDocumentRangeFormatting; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentOnTypeFormatting = this.#connection.onDocumentOnTypeFormatting; // eslint-disable-line @typescript-eslint/unbound-method
    this.onRenameRequest = this.#connection.onRenameRequest; // eslint-disable-line @typescript-eslint/unbound-method
    this.onPrepareRename = this.#connection.onPrepareRename; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentLinks = this.#connection.onDocumentLinks; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentLinkResolve = this.#connection.onDocumentLinkResolve; // eslint-disable-line @typescript-eslint/unbound-method
    this.onDocumentColor = this.#connection.onDocumentColor; // eslint-disable-line @typescript-eslint/unbound-method
    this.onColorPresentation = this.#connection.onColorPresentation; // eslint-disable-line @typescript-eslint/unbound-method
    this.onFoldingRanges = this.#connection.onFoldingRanges; // eslint-disable-line @typescript-eslint/unbound-method
    this.onSelectionRanges = this.#connection.onSelectionRanges; // eslint-disable-line @typescript-eslint/unbound-method
    this.onExecuteCommand = this.#connection.onExecuteCommand; // eslint-disable-line @typescript-eslint/unbound-method
    this.dispose = this.#connection.dispose; // eslint-disable-line @typescript-eslint/unbound-method
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
