import { DidCloseTextDocumentNotification, DidOpenTextDocumentNotification, createConnection } from "vscode-languageserver/node";
import { Duplex } from "node:stream";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
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
  await client.sendNotification(DidOpenTextDocumentNotification.type, openParams);
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
  await client.sendNotification(DidCloseTextDocumentNotification.type, closeParams);
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
