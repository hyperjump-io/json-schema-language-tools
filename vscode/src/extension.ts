import * as path from "node:path";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";

import type { ExtensionContext } from "vscode";


let client: LanguageClient | undefined;

// Must match the request names in language-server/src/services/trusted-vocabularies.js
const GET_TRUSTED_VOCABULARIES = "jsonSchemaLanguageServer/getTrustedVocabularies";
const TRUST_VOCABULARY = "jsonSchemaLanguageServer/trustVocabulary";
const TRUSTED_VOCABULARIES_KEY = "trustedVocabularies";

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
    documentSelector: [{ scheme: "file", language: "json" }]
  };

  client = new LanguageClient("jsonSchemaLanguageServer", "JSON Schema Language Server", serverOptions, clientOptions);
  client.onRequest(GET_TRUSTED_VOCABULARIES, () => {
    return context.globalState.get<string[]>(TRUSTED_VOCABULARIES_KEY, []);
  });

  client.onRequest(TRUST_VOCABULARY, async (specifier: string) => {
    const trusted = context.globalState.get<string[]>(TRUSTED_VOCABULARIES_KEY, []);
    if (typeof specifier === "string" && !trusted.includes(specifier)) {
      await context.globalState.update(TRUSTED_VOCABULARIES_KEY, [...trusted, specifier]);
    }
  });

  await client.start();
};

const deactivate = async () => client?.stop();

module.exports = { activate, deactivate };
