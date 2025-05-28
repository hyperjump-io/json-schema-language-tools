import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestClient } from "../../test/test-client.ts";


describe("Feature - Completion", () => {
  let client: TestClient;

  beforeAll(async () => {
    client = new TestClient();
    await client.start();
  });

  afterAll(async () => {
    await client.stop();
  });

  test("completion provider capabilities", () => {
    expect(client.serverCapabilities?.completionProvider).to.eql({
      resolveProvider: false,
      triggerCharacters: ["\"", ":", " "]
    });
  });
});
