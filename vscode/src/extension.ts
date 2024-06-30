import * as path from "node:path";
import { LanguageClient, TransportKind, MarkupKind } from "vscode-languageclient/node.js";

import type { ExtensionContext } from "vscode";


let client: LanguageClient | undefined;

const activate = async (context: ExtensionContext) => {
  const serverModule = context.asAbsolutePath(path.join("out", "server.js"));
  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"]
      }
    }
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "json" }],
    capabilities: {
      textDocument: {
        hover: {
          contentFormat: [MarkupKind.Markdown, MarkupKind.PlainText]
        }
      }
    }
  };

  client = new LanguageClient("jsonSchemaLanguageServer", "JSON Schema Language Server", serverOptions, clientOptions);
  await client.start();
};

const deactivate = async () => client?.stop();

module.exports = { activate, deactivate };
