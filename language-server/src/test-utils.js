import { Duplex } from "node:stream";
import { DidOpenTextDocumentNotification, createConnection } from "vscode-languageserver/node";
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
      text: text
    }
  };
  await client.sendNotification(DidOpenTextDocumentNotification.type, openParams);
};
