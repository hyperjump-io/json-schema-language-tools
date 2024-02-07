import "@hyperjump/json-schema/draft-2019-09";
import { runTestSuite } from "./json-schema-test.js";


const skip = new Set([
  "|draft2019-09|ref.json|$id with file URI still resolves pointers - *nix",
  "|draft2019-09|ref.json|$id with file URI still resolves pointers - windows"
]);

runTestSuite("draft2019-09", "https://json-schema.org/draft/2019-09/schema", skip);
