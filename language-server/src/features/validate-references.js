import { getSchema } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../schema-node.js";
import { subscribe, unsubscribe } from "../pubsub.js";
import { keywordNameFor } from "../util.js";

/**
 * @import { Feature } from "../build-server.js"
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
 */


/** @type string */
let subscriptionToken;

/** @type Feature */
export default {
  async load() {
    subscriptionToken = subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
      for (const schemaResource of schemaDocument.schemaResources) {
        for (const node of references(schemaResource)) {
          const reference = SchemaNode.value(node);
          let referencedSchema;
          try {
            referencedSchema = SchemaNode.get(reference, schemaResource) ?? await getSchema(reference);
          } catch (error) {
            // Ignore for now
          }

          if (!referencedSchema) {
            diagnostics.push({ instance: node, message: "Referenced schema doesn't exist" });
          }
        }
      }
    });
  },

  onInitialize() {
    return {};
  },

  async onInitialized() {
  },

  async onShutdown() {
    unsubscribe("diagnostics", subscriptionToken);
  }
};

/** @type (schemaResource: SchemaNodeType) => Generator<SchemaNodeType> */
export const references = function* (schemaResource) {
  const refToken = keywordNameFor("https://json-schema.org/keyword/ref", schemaResource.dialectUri ?? "");
  const legacyRefToken = keywordNameFor("https://json-schema.org/keyword/draft-04/ref", schemaResource.dialectUri ?? "");

  for (const node of SchemaNode.allNodes(schemaResource)) {
    if (node.parent && SchemaNode.typeOf(node.parent) === "property") {
      const keyword = SchemaNode.value(node.parent.children[0]);
      if (keyword === refToken || keyword === legacyRefToken) {
        yield node;
      }
    }
  }
};
