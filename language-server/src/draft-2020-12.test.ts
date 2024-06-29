import "@hyperjump/json-schema/draft-2020-12";
import { runTestSuite } from "./json-schema-test.js";


const skip = new Set([
  "|draft2020-12|ref.json|$id with file URI still resolves pointers - *nix",
  "|draft2020-12|ref.json|$id with file URI still resolves pointers - windows"
]);

runTestSuite("draft2020-12", "https://json-schema.org/draft/2020-12/schema", skip);
