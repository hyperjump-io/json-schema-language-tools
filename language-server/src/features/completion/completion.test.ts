import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../../test/test-client.js";

import type { DocumentSettings } from "../../services/configuration.js";


describe("Feature - Completion", () => {
  let client: TestClient<DocumentSettings>;

  beforeAll(async () => {
    client = new TestClient();
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