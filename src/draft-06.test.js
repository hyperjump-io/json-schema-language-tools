import "@hyperjump/json-schema/draft-06";
import { runTestSuite } from "./json-schema-test.js";


const skip = new Set([
  "|draft6|refRemote.json|base URI change - change folder in subschema",
  "|draft6|ref.json|$ref prevents a sibling $id from changing the base uri",
  "|draft6|ref.json|naive replacement of $ref with its destination is not correct",
  "|draft6|ref.json|$id with file URI still resolves pointers - *nix",
  "|draft6|ref.json|$id with file URI still resolves pointers - windows"
]);

runTestSuite("draft6", "http://json-schema.org/draft-06/schema", skip);
