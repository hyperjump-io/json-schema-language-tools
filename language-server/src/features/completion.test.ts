import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../test-client.js";
import completion from "./completion.js";

import type { DocumentSettings } from "../configuration.js";


describe("Feature - Completion", () => {
  let client: TestClient<DocumentSettings>;

  beforeAll(async () => {
    client = new TestClient([completion]);
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  test("completion provider capabilities", async () => {
    expect(client.serverCapabilities?.completionProvider).to.eql({
      resolveProvider: false,
      triggerCharacters: ["\"", ":", " "]
    });
  });
});
