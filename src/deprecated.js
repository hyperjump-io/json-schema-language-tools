import * as AnnotatedInstance from "@hyperjump/json-schema/annotated-instance/experimental";
import { getNode } from "./util.js";


export const deprecatedNodes = function* (instance, tree) {
  const deprecations = AnnotatedInstance.annotatedWith(instance, "deprecated");
  for (const deprecated of deprecations) {
    if (AnnotatedInstance.annotation(deprecated, "deprecated").some((deprecated) => deprecated)) {
      const message = AnnotatedInstance.annotation(deprecated, "x-deprecationMessage").join("\n") || "deprecated";
      yield [getNode(tree, deprecated.pointer)?.parent?.children?.[0], message];
    }
  }
};
