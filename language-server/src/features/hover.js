import { MarkupKind } from "vscode-languageserver";
import * as SchemaDocument from "../schema-document.js";
import { getSchemaDocument } from "./schema-registry.js";
import { isPropertyNode } from "../util.js";

/**
 * @import { Feature } from "../build-server.js"
 */


/** @type Feature */
export default {
  async load(connection, documents) {
    connection.onHover(async ({ textDocument, position }) => {
      const document = documents.get(textDocument.uri);
      if (!document) {
        return;
      }

      const schemaDocument = await getSchemaDocument(connection, document);
      const offset = document.offsetAt(position);
      const keywordNode = SchemaDocument.findNodeAtOffset(schemaDocument, offset);

      if (keywordNode?.keywordUri && isPropertyNode(keywordNode) && descriptions[keywordNode.keywordUri]) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: descriptions[keywordNode.keywordUri]
          },
          range: {
            start: document.positionAt(keywordNode.offset),
            end: document.positionAt(keywordNode.offset + keywordNode.textLength - 1)
          }
        };
      }
    });
  },

  onInitialize() {
    return {
      hoverProvider: true
    };
  },

  async onInitialized() {
  },

  async onShutdown() {
  }
};

/** @type Record<string, string> */
const descriptions = {
  "https://json-schema.org/keyword/schema": `This keyword is both used as a JSON Schema dialect identifier and as a reference to a JSON Schema which describes the set of valid schemas written for this particular dialect. Learn more: https://www.learnjsonschema.com/2020-12/core/schema/`,
  "https://json-schema.org/keyword/additionalProperties": `Validation succeeds if the schema validates against each value not matched by other object applicators in this vocabulary. Learn more: https://www.learnjsonschema.com/2020-12/applicator/additionalproperties/`,
  "https://json-schema.org/keyword/allOf": `An instance validates successfully against this keyword if it validates successfully against all schemas defined by this keyword’s value. Learn more: https://www.learnjsonschema.com/2020-12/applicator/allof/`,
  "https://json-schema.org/keyword/anchor": `This keyword is used to create plain name fragments that are not tied to any particular structural location for referencing purposes, which are taken into consideration for static referencing. Learn more: https://www.learnjsonschema.com/2020-12/core/anchor/`,
  "https://json-schema.org/keyword/anyOf": `An instance validates successfully against this keyword if it validates successfully against at least one schema defined by this keyword’s value. Learn more: https://www.learnjsonschema.com/2020-12/applicator/anyof/`,
  "https://json-schema.org/keyword/conditional": ``,
  "https://json-schema.org/keyword/const": `Validation succeeds if the instance is equal to this keyword’s value. Learn more: https://www.learnjsonschema.com/2020-12/validation/const/`,
  "https://json-schema.org/keyword/contains": `Validation succeeds if the instance contains an element that validates against this schema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/contains/`,
  "https://json-schema.org/keyword/comment": `This keyword reserves a location for comments from schema authors to readers or maintainers of the schema. Learn more: https://www.learnjsonschema.com/2020-12/core/comment/`,
  "https://json-schema.org/keyword/contentEncoding": `The string instance should be interpreted as encoded binary data and decoded using the encoding named by this property. Learn more: https://www.learnjsonschema.com/2020-12/content/contentencoding/`,
  "https://json-schema.org/keyword/contentMediaType": `This keyword declares the media type of the string instance. Learn more: https://www.learnjsonschema.com/2020-12/content/contentmediatype/`,
  "https://json-schema.org/keyword/contentSchema": `This keyword declares a schema which describes the structure of the string. Learn more: https://www.learnjsonschema.com/2020-12/content/contentschema/`,
  "https://json-schema.org/keyword/default": `This keyword can be used to supply a default JSON value associated with a particular schema. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/default/`,
  "https://json-schema.org/keyword/definitions": `This keyword is used in meta-schemas to identify the required and optional vocabularies available for use in schemas described by that meta-schema. Learn more: https://www.learnjsonschema.com/2020-12/core/defs/`,
  "https://json-schema.org/keyword/dependentRequired": `Validation succeeds if, for each name that appears in both the instance and as a name within this keyword’s value, every item in the corresponding array is also the name of a property in the instance. Learn more: https://www.learnjsonschema.com/2020-12/validation/dependentrequired/`,
  "https://json-schema.org/keyword/dependentSchemas": `This keyword specifies subschemas that are evaluated if the instance is an object and contains a certain property. Learn more: https://www.learnjsonschema.com/2020-12/applicator/dependentschemas/`,
  "https://json-schema.org/keyword/deprecated": `This keyword indicates that applications should refrain from using the declared property. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/deprecated/`,
  "https://json-schema.org/keyword/description": `An explanation about the purpose of the instance described by the schema. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/description/`,
  "https://json-schema.org/keyword/dynamicAnchor": `This keyword is used to create plain name fragments that are not tied to any particular structural location for referencing purposes, which are taken into consideration for dynamic referencing. Learn more: https://www.learnjsonschema.com/2020-12/core/dynamicanchor/`,
  "https://json-schema.org/keyword/dynamicRef": `This keyword is used to reference an identified schema, deferring the full resolution until runtime, at which point it is resolved each time it is encountered while evaluating an instance. Learn more: https://www.learnjsonschema.com/2020-12/core/dynamicref/`,
  "https://json-schema.org/keyword/else": `When if is present, and the instance fails to validate against its subschema, then validation succeeds against this keyword if the instance successfully validates against this keyword’s subschema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/else/`,
  "https://json-schema.org/keyword/enum": `Validation succeeds if the instance is equal to one of the elements in this keyword’s array value. Learn more: https://www.learnjsonschema.com/2020-12/validation/enum/`,
  "https://json-schema.org/keyword/examples": `This keyword is used to provide sample JSON values associated with a particular schema, for the purpose of illustrating usage. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/examples/`,
  "https://json-schema.org/keyword/exclusiveMaximum": `Validation succeeds if the numeric instance is less than the given number. Learn more: https://www.learnjsonschema.com/2020-12/validation/exclusivemaximum/`,
  "https://json-schema.org/keyword/exclusiveMinimum": `Validation succeeds if the numeric instance is greater than the given number. Learn more: https://www.learnjsonschema.com/2020-12/validation/exclusiveminimum/`,
  "https://json-schema.org/keyword/format": `Define semantic information about a string instance. Learn more: https://www.learnjsonschema.com/2020-12/format-annotation/format/`,
  "https://json-schema.org/keyword/format-assertion": `Define and assert semantic information about a string instance. Learn more: https://www.learnjsonschema.com/2020-12/format-assertion/format/`,
  "https://json-schema.org/keyword/id": `This keyword declares an identifier for the schema resource. Learn more: https://www.learnjsonschema.com/2020-12/core/id/`,
  "https://json-schema.org/keyword/if": `This keyword declares a condition based on the validation result of the given schema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/if/`,
  "https://json-schema.org/keyword/itemPattern": ``,
  "https://json-schema.org/keyword/items": `Validation succeeds if each element of the instance not covered by prefixItems validates against this schema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/items/`,
  "https://json-schema.org/keyword/maxContains": `The number of times that the contains keyword (if set) successfully validates against the instance must be less than or equal to the given integer. Learn more: https://www.learnjsonschema.com/2020-12/validation/maxcontains/`,
  "https://json-schema.org/keyword/maxItems": `An array instance is valid if its size is less than, or equal to, the value of this keyword. Learn more: https://www.learnjsonschema.com/2020-12/validation/maxitems/`,
  "https://json-schema.org/keyword/maxLength": `A string instance is valid against this keyword if its length is less than, or equal to, the value of this keyword. Learn more: https://www.learnjsonschema.com/2020-12/validation/maxlength/`,
  "https://json-schema.org/keyword/maxProperties": `An object instance is valid if its number of properties is less than, or equal to, the value of this keyword. Learn more: https://www.learnjsonschema.com/2020-12/validation/maxproperties/`,
  "https://json-schema.org/keyword/maximum": `Validation succeeds if the numeric instance is less than or equal to the given number. Learn more: https://www.learnjsonschema.com/2020-12/validation/maximum/`,
  "https://json-schema.org/keyword/minContains": `The number of times that the contains keyword (if set) successfully validates against the instance must be greater than or equal to the given integer. Learn more: https://www.learnjsonschema.com/2020-12/validation/mincontains/`,
  "https://json-schema.org/keyword/minItems": `An array instance is valid if its size is greater than, or equal to, the value of this keyword. Learn more: https://www.learnjsonschema.com/2020-12/validation/minitems/`,
  "https://json-schema.org/keyword/minLength": `A string instance is valid against this keyword if its length is greater than, or equal to, the value of this keyword. Learn more: https://www.learnjsonschema.com/2020-12/validation/minlength/`,
  "https://json-schema.org/keyword/minProperties": `An object instance is valid if its number of properties is greater than, or equal to, the value of this keyword. Learn more: https://www.learnjsonschema.com/2020-12/validation/minproperties/`,
  "https://json-schema.org/keyword/minimum": `Validation succeeds if the numeric instance is greater than or equal to the given number. Learn more: https://www.learnjsonschema.com/2020-12/validation/minimum/`,
  "https://json-schema.org/keyword/multipleOf": `A numeric instance is valid only if division by this keyword’s value results in an integer. Learn more: https://www.learnjsonschema.com/2020-12/validation/multipleof/`,
  "https://json-schema.org/keyword/not": `An instance is valid against this keyword if it fails to validate successfully against the schema defined by this keyword. Learn more: https://www.learnjsonschema.com/2020-12/applicator/not/`,
  "https://json-schema.org/keyword/oneOf": `An instance validates successfully against this keyword if it validates successfully against exactly one schema defined by this keyword’s value. Learn more: https://www.learnjsonschema.com/2020-12/applicator/oneof/`,
  "https://json-schema.org/keyword/pattern": `A string instance is considered valid if the regular expression matches the instance successfully. Learn more: https://www.learnjsonschema.com/2020-12/validation/pattern/`,
  "https://json-schema.org/keyword/patternProperties": `Validation succeeds if, for each instance name that matches any regular expressions that appear as a property name in this keyword’s value, the child instance for that name successfully validates against each schema that corresponds to a matching regular expression. Learn more: https://www.learnjsonschema.com/2020-12/applicator/patternproperties/`,
  "https://json-schema.org/keyword/prefixItems": `Validation succeeds if each element of the instance validates against the schema at the same position, if any. Learn more: https://www.learnjsonschema.com/2020-12/applicator/prefixitems/`,
  "https://json-schema.org/keyword/properties": `Validation succeeds if, for each name that appears in both the instance and as a name within this keyword’s value, the child instance for that name successfully validates against the corresponding schema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/properties/`,
  "https://json-schema.org/keyword/propertyDependencies": ``,
  "https://json-schema.org/keyword/propertyNames": `Validation succeeds if the schema validates against every property name in the instance. Learn more: https://www.learnjsonschema.com/2020-12/applicator/propertynames/`,
  "https://json-schema.org/keyword/readOnly": `This keyword indicates that the value of the instance is managed exclusively by the owning authority, and attempts by an application to modify the value of this property are expected to be ignored or rejected by that owning authority. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/readonly/`,
  "https://json-schema.org/keyword/ref": `This keyword is used to reference a statically identified schema. Learn more: https://www.learnjsonschema.com/2020-12/core/ref/`,
  "https://json-schema.org/keyword/requireAllExcept": ``,
  "https://json-schema.org/keyword/required": `An object instance is valid against this keyword if every item in the array is the name of a property in the instance. Learn more: https://www.learnjsonschema.com/2020-12/validation/required/`,
  "https://json-schema.org/keyword/title": `A preferably short description about the purpose of the instance described by the schema. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/title/`,
  "https://json-schema.org/keyword/then": `When if is present, and the instance successfully validates against its subschema, then validation succeeds against this keyword if the instance also successfully validates against this keyword’s subschema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/then/`,
  "https://json-schema.org/keyword/type": `Validation succeeds if the type of the instance matches the type represented by the given type, or matches at least one of the given types. Learn more: https://www.learnjsonschema.com/2020-12/validation/type/`,
  "https://json-schema.org/keyword/unevaluatedItems": `Validates array elements that did not successfully validate against other standard array applicators. Learn more: https://www.learnjsonschema.com/2020-12/unevaluated/unevaluateditems/`,
  "https://json-schema.org/keyword/unevaluatedProperties": `Validates object properties that did not successfully validate against other standard object applicators. Learn more: https://www.learnjsonschema.com/2020-12/unevaluated/unevaluatedproperties/`,
  "https://json-schema.org/keyword/uniqueItems": `If this keyword is set to the boolean value true, the instance validates successfully if all of its elements are unique. Learn more: https://www.learnjsonschema.com/2020-12/validation/uniqueitems/`,
  "https://json-schema.org/keyword/vocabulary": `This keyword is used in meta-schemas to identify the required and optional vocabularies available for use in schemas described by that meta-schema. Learn more: https://www.learnjsonschema.com/2020-12/core/vocabulary/`,
  "https://json-schema.org/keyword/writeOnly": `This keyword indicates that the value is never present when the instance is retrieved from the owning authority. Learn more: https://www.learnjsonschema.com/2020-12/meta-data/writeonly/`,

  // Draft-04
  "https://json-schema.org/keyword/draft-04/id": ``,
  "https://json-schema.org/keyword/draft-04/ref": `This keyword is used to reference a statically identified schema. Learn more: https://www.learnjsonschema.com/2020-12/core/ref/`,
  "https://json-schema.org/keyword/draft-04/additionalItems": `If items is set to an array of schemas, validation succeeds if each element of the instance not covered by it validates against this schema. Learn more: https://www.learnjsonschema.com/2019-09/applicator/additionalitems/`,
  "https://json-schema.org/keyword/draft-04/dependencies": ``,
  "https://json-schema.org/keyword/draft-04/exclusiveMaximum": ``,
  "https://json-schema.org/keyword/draft-04/exclusiveMinimum": ``,
  "https://json-schema.org/keyword/draft-04/items": `If set to a schema, validation succeeds if each element of the instance validates against it, otherwise validation succeeds if each element of the instance validates against the schema at the same position, if any. Learn more: https://www.learnjsonschema.com/2019-09/applicator/items/`,
  "https://json-schema.org/keyword/draft-04/maximum": ``,
  "https://json-schema.org/keyword/draft-04/minimum": ``,

  // Draft-06
  "https://json-schema.org/keyword/draft-06/contains": `Validation succeeds if the instance contains an element that validates against this schema. Learn more: https://www.learnjsonschema.com/2020-12/applicator/contains/`,

  // Draft-7

  // Draft 2019-09
  "https://json-schema.org/keyword/draft-2019-09/recursiveAnchor": `This keyword is used to dynamically identify a base URI at runtime by marking where such a calculation can start, and where it stops. Learn more: https://www.learnjsonschema.com/2019-09/core/recursiveanchor/`,

  // Draft 2020-12
  "https://json-schema.org/keyword/draft-2020-12/dynamicAnchor": `This keyword is used to create plain name fragments that are not tied to any particular structural location for referencing purposes, which are taken into consideration for dynamic referencing. Learn more: https://www.learnjsonschema.com/2020-12/core/dynamicanchor/`,
  "https://json-schema.org/keyword/draft-2020-12/dynamicRef": `This keyword is used to reference an identified schema, deferring the full resolution until runtime, at which point it is resolved each time it is encountered while evaluating an instance. Learn more: https://www.learnjsonschema.com/2020-12/core/dynamicref/`
};
