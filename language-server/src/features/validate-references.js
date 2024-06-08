import { getKeywordName } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../schema-node.js";
import { subscribe } from "../pubsub.js";


export default {
  onInitialize() {
    return {};
  },

  onInitialized() {
    subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
      for (const schemaResource of schemaDocument.schemaResources) {
        for (const node of references(schemaResource)) {
          const reference = SchemaNode.value(node);
          const referencedSchema = SchemaNode.get(reference, schemaResource);
          if (!referencedSchema) {
            diagnostics.push({ instance: node, message: "Referenced schema doesn't exist" });
          }
        }
      }
    });
  }
};

const references = function* (schemaResource) {
  const refToken = getKeywordName(schemaResource.dialectUri, "https://json-schema.org/keyword/ref");
  const legacyRefToken = getKeywordName(schemaResource.dialectUri, "https://json-schema.org/keyword/draft-04/ref");

  for (const node of SchemaNode.allNodes(schemaResource)) {
    if (node.parent && SchemaNode.typeOf(node.parent) === "property") {
      const keyword = SchemaNode.value(node.parent.children[0]);
      if (keyword === refToken || keyword === legacyRefToken) {
        yield node;
      }
    }
  }
};
