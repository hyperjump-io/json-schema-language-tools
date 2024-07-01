import {
  ConfigurationRequest,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializeRequest,
  InitializedNotification,
  RegistrationRequest,
  SemanticTokensRefreshRequest,
  WorkDoneProgressCreateRequest
} from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node.js";
import { randomUUID } from "node:crypto";
import { Duplex } from "node:stream";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { resolveIri } from "@hyperjump/uri";
import { merge } from "merge-anything";
import { buildServer } from "./build-server.js";

import type { Connection, InitializeParams } from "vscode-languageserver";
import type { Feature } from "./build-server.js";
import type { DocumentSettings } from "./features/document-settings.js";


export class TestStream extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit("data", chunk);
    done();
  }

  _read(_size: number) {
  }
}

export const getTestClient = (features: Feature[]) => {
  const up = new TestStream();
  const down = new TestStream();

  const server = createConnection(up, down);
  buildServer(server, features);

  const client = createConnection(down, up);
  client.listen();

  return client;
};

export const initializeServer = async (client: Connection, initParams: Partial<InitializeParams> = {}, settings: Partial<DocumentSettings> | null = null) => {
  client.onRequest(RegistrationRequest.type, () => {
    // Ignore client/registerCapability request for now
  });

  client.onRequest(SemanticTokensRefreshRequest.type, () => {
    // Ignore workspace/semanticTokens/refresh request for now
  });

  client.onRequest(WorkDoneProgressCreateRequest.type, () => {
    // Ignore window/workDoneProgress/create for now
  });

  client.onRequest(ConfigurationRequest.type, () => {
    return [settings];
  });

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
  const response = await client.sendRequest(InitializeRequest.type, merge(defaultInitParams, initParams));

  await client.sendNotification(InitializedNotification.type, {});

  return response.capabilities;
};

export const openDocument = async (client: Connection, uri: string, text?: string) => {
  const baseUri = pathToFileURL(`/${randomUUID()}/`).toString();
  const documentUri = resolveIri(uri, baseUri);

  await client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: documentUri,
      languageId: "json",
      version: 0,
      text: text ?? await readFile(fileURLToPath(uri), "utf-8")
    }
  });

  return documentUri;
};

export const closeDocument = async (client: Connection, uri: string) => {
  await client.sendNotification(DidCloseTextDocumentNotification.type, {
    textDocument: {
      uri: uri
    }
  });
};

export const setupWorkspace = async (files: Record<string, string>) => {
  const workspaceFolder = await mkdtemp(join(tmpdir(), "test-workspace-"));

  for (const path in files) {
    await writeFile(join(workspaceFolder, path), files[path], "utf-8");
  }

  return pathToFileURL(workspaceFolder).toString();
};

export const tearDownWorkspace = async (workspaceFolder: string) => {
  await rm(fileURLToPath(workspaceFolder), { recursive: true });
};
