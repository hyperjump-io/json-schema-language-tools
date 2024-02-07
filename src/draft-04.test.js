import "@hyperjump/json-schema/draft-04";
import { runTestSuite } from "./json-schema-test.js";


const skip = new Set([
  "|draft4|refRemote.json|base URI change - change folder in subschema",
  "|draft4|ref.json|naive replacement of $ref with its destination is not correct",
  "|draft4|ref.json|$ref prevents a sibling id from changing the base uri",
  "|draft4|ref.json|id with file URI still resolves pointers - *nix",
  "|draft4|ref.json|id with file URI still resolves pointers - windows"
]);

runTestSuite("draft4", "http://json-schema.org/draft-04/schema", skip);
