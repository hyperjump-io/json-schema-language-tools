import * as path from "node:path";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";
import type { ExtensionContext } from "vscode";

let client: LanguageClient | undefined;

const TRUSTED_VOCABS_KEY = "trustedVocabularies";

const activate = async (context: ExtensionContext) => {
  const serverModule = context.asAbsolutePath(path.join("out", "server.js"));
  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] }
    }
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "json" }]
  };

  client = new LanguageClient(
    "jsonSchemaLanguageServer",
    "JSON Schema Language Server",
    serverOptions,
    clientOptions
  );

  await client.start();

  // Restore trusted vocabs from globalState into server on startup
  const trusted = context.globalState.get<string[]>(TRUSTED_VOCABS_KEY, []);
  for (const identifier of trusted) {
    await client.sendNotification("custom/addTrustedVocab", { identifier });
  }

  // Persist newly trusted vocabs into globalState
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
