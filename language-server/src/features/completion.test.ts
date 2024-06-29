import { beforeAll, describe, expect, test } from "vitest";
import { getTestClient, initializeServer } from "../test-utils.js";
import completion from "./completion.js";

import type { Connection, ServerCapabilities } from "vscode-languageserver";


describe("Feature - Completion", () => {
  let client: Connection;
  let capabilities: ServerCapabilities;

  beforeAll(async () => {
    client = getTestClient([completion]);
    capabilities = await initializeServer(client);
  });

  test("completion provider capabilities", async () => {
    expect(capabilities.completionProvider).to.eql({
      resolveProvider: false,
      triggerCharacters: ["\"", ":", " "]
    });
  });
});
