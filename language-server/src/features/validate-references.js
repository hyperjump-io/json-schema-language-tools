import { getSchema } from "@hyperjump/json-schema/experimental";
import * as SchemaNode from "../schema-node.js";
import { subscribe, unsubscribe } from "../pubsub.js";
import { keywordNameFor } from "../util.js";

/**
 * @import { SchemaNode as SchemaNodeType } from "../schema-node.js"
 * @import { Server } from "../build-server.js"
 * @import { SchemaRegistry } from "../schema-registry.js"
 */


export class ValidateReferencesFeature {
  #subscriptionToken;

  /**
   * @param {Server} server
   * @param {SchemaRegistry} schemas
   */
  constructor(server, schemas) {
    server.onShutdown(async () => {
      unsubscribe("diagnostics", this.#subscriptionToken);
    });

    // TODO: eliminate pubsub
    this.#subscriptionToken = subscribe("diagnostics", async (_message, { schemaDocument, diagnostics }) => {
      for (const schemaResource of schemaDocument.schemaResources) {
        for (const node of this.references(schemaResource)) {
          const reference = SchemaNode.value(node);
          let referencedSchema;
          try {
            referencedSchema = await SchemaNode.get(reference, schemaResource, schemas) ?? await getSchema(reference);
          } catch (error) {
            // Ignore for now
          }

          if (!referencedSchema) {
            diagnostics.push({ instance: node, message: "Referenced schema doesn't exist" });
          }
        }
      }
    });
  }

  /** @type (schemaResource: SchemaNodeType) => Generator<SchemaNodeType> */
  * references(schemaResource) {
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
  }
}
