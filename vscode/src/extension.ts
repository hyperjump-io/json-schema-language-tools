import * as path from "node:path";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";
import type { ExtensionContext } from "vscode";

let client: LanguageClient | undefined;

const TRUSTED_VOCABS_KEY = "trustedVocabularies";

const activate = async (context: ExtensionContext) => {
  const serverModule = context.asAbsolutePath(path.join("out", "server.mjs"));
  const loaderModule = context.asAbsolutePath(path.join("out", "https-loader.mjs"));

  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--import", loaderModule]
      }
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009", "--import", loaderModule]
      }
    }
  };

  const trusted = context.globalState.get<string[]>(TRUSTED_VOCABS_KEY, []);

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "json" }],
    initializationOptions: {
      trustedVocabularies: trusted
    }
  };

  client = new LanguageClient(
    "jsonSchemaLanguageServer",
    "JSON Schema Language Server",
    serverOptions,
    clientOptions
  );

  await client.start();

  client.onNotification("custom/persistTrustedVocab", ({ identifier }: { identifier: string }) => {
    void (async () => {
      const current = context.globalState.get<string[]>(TRUSTED_VOCABS_KEY, []);
      if (!current.includes(identifier)) {
        await context.globalState.update(TRUSTED_VOCABS_KEY, [...current, identifier]);
      }
    })();
  });
};

const deactivate = async () => client?.stop();

module.exports = { activate, deactivate };
