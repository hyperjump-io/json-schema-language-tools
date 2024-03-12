"use strict";
const path = require("node:path");
const { LanguageClient } = require("vscode-languageclient/node.js");


let client;

const activate = (context) => {
  // const serverModule = context.asAbsolutePath(path.join("out", "server.js"));
  // const serverOptions = {
  //   run: {
  //     module: serverModule,
  //     transport: TransportKind.ipc
  //   },
  //   debug: {
  //     module: serverModule,
  //     transport: TransportKind.ipc,
  //     options: {
  //       execArgc: ["--nolazy", "--inspect=6009"]
  //     }
  //   }
  // };

  // Temporary Hack. Get the above code working.
  const serverOptions = {
    command: "node",
    args: [context.asAbsolutePath(path.join("..", "language-server", "src", "server.js")), "--stdio"]
  };

  const clientOptions = {
    documentSelector: [
      { language: "json", pattern: "**/*.schema.json" },
      { language: "json", pattern: "**/schema.json" }
    ]
  };

  client = new LanguageClient("jsonSchemaLanguageServer", "JSON Schema Language Server", serverOptions, clientOptions);
  client.start();
};

const deactivate = () => client?.stop();

module.exports = { activate, deactivate };
