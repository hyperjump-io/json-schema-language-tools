import {
  ConfigurationRequest,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializeRequest,
  InitializedNotification,
  RegistrationRequest,
  SemanticTokensRefreshRequest,
  WorkDoneProgressCreateRequest,
  createConnection
} from "vscode-languageserver/node.js";
import { Duplex } from "node:stream";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { merge } from "merge-anything";
import { buildServer } from "./build-server.js";


export class TestStream extends Duplex {
  _write(chunk, _encoding, done) {
    this.emit("data", chunk);
    done();
  }

  _read(_size) {
  }
}

export const getTestClient = (features) => {
  const up = new TestStream();
  const down = new TestStream();

  const server = createConnection(up, down);
  buildServer(server, features);

  const client = createConnection(down, up);
  client.listen();

  return client;
};

export const initializeServer = async (client, initParams = {}, settings = null) => {
  client.onRequest(RegistrationRequest, () => {
    // Ignore client/registerCapability request for now
  });

  client.onRequest(SemanticTokensRefreshRequest.method, () => {
    // Ignore workspace/semanticTokens/refresh request for now
  });

  client.onRequest(WorkDoneProgressCreateRequest, () => {
    // Ignore window/workDoneProgress/create for now
  });

  client.onRequest(ConfigurationRequest, () => {
    return [settings];
  });

  /**
   * @type {import("vscode-languageserver/node.js").InitializeParams}
   */
  const init = merge({
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
  }, initParams);
  const response = await client.sendRequest(InitializeRequest, init);

  await client.sendNotification(InitializedNotification);

  // TODO: This is a hack. Find a way to know when initialized is finished
  // Block for a while to allow InitializedNotification time to finish
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  return response.capabilities;
};

export const openDocument = async (client, uri, text) => {
  /**
   * @type {import("vscode-languageserver/node.js").DidOpenTextDocumentParams}
   */
  const openParams = {
    textDocument: {
      uri: uri,
      languageId: "json",
      version: 0,
      text: text ?? await readFile(fileURLToPath(uri), "utf-8")
    }
  };
  await client.sendNotification(DidOpenTextDocumentNotification, openParams);
};

export const closeDocument = async (client, uri) => {
  /**
   * @type {import("vscode-languageserver/node.js").DidCloseTextDocumentParams}
   */
  const closeParams = {
    textDocument: {
      uri: uri
    }
  };
  await client.sendNotification(DidCloseTextDocumentNotification, closeParams);
};

export const setupWorkspace = async (files) => {
  const workspaceFolder = await mkdtemp(join(tmpdir(), "test-workspace-"));

  for (const path in files) {
    await writeFile(join(workspaceFolder, path), files[path], "utf-8");
  }

  return pathToFileURL(workspaceFolder).toString();
};

export const tearDownWorkspace = async (workspaceFolder) => {
  await rm(fileURLToPath(workspaceFolder), { recursive: true });
};
