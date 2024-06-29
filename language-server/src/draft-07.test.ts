import "@hyperjump/json-schema/draft-07";
import { runTestSuite } from "./json-schema-test.js";


const skip = new Set([
  "|draft7|refRemote.json|base URI change - change folder in subschema",
  "|draft7|ref.json|naive replacement of $ref with its destination is not correct",
  "|draft7|ref.json|$ref prevents a sibling $id from changing the base uri",
  "|draft7|ref.json|$id with file URI still resolves pointers - *nix",
  "|draft7|ref.json|$id with file URI still resolves pointers - windows"
]);

runTestSuite("draft7", "http://json-schema.org/draft-07/schema", skip);
