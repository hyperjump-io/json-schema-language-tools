import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PublishDiagnosticsNotification } from "vscode-languageserver";
import { TestClient } from "../test/test-client.ts";

const employeeSchema = `{
  "$id": "https://test.com/schemas/employee",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "role": { "type": "string" }
  }
}`;

const policySchema = `{
  "$id": "https://test.com/schemas/policy",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$vocabulary": {
    "https://json-schema.org/draft/2020-12/vocab/core": true,
    "https://json-schema.org/draft/2020-12/vocab/applicator": true,
    "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
    "https://json-schema.org/draft/2020-12/vocab/validation": true,
    "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
    "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
    "https://json-schema.org/draft/2020-12/vocab/content": true
  },
  "allOf": [
    { "$ref": "https://json-schema.org/draft/2020-12/schema" }
  ],
  "properties": {
    "security_level": { "type": "string", "enum": ["low", "high"] }
  },
  "required": ["security_level"]
}`;

const projectSchema = `{
  "$id": "https://test.com/schemas/project",
  "$schema": "https://test.com/schemas/policy",
  "security_level": "high",
  "type": "object",
  "properties": {
    "project_name": { "type": "string" },
    "lead": { "$ref": "https://test.com/schemas/employee" }
  }
}`;

const reportSchema = `{
  "$id": "https://test.com/schemas/report",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "properties": {
    "main_project": { "$ref": "https://test.com/schemas/project" }
  }
}`;

describe("Incremental Workspace Validation", () => {
  let client: TestClient;
  let employeeUri: string;
  let policyUri: string;
  let projectUri: string;
  let reportUri: string;
  const schemaUris: string[] = [];

  beforeAll(async () => {
    client = new TestClient();
    await client.start();

    client.onNotification(PublishDiagnosticsNotification.type, (params) => {
      schemaUris.push(params.uri);
    });

    employeeUri = await client.writeDocument("./employee.schema.json", employeeSchema);
    policyUri = await client.writeDocument("./policy.schema.json", policySchema);
    projectUri = await client.writeDocument("./project.schema.json", projectSchema);
    reportUri = await client.writeDocument("./report.schema.json", reportSchema);
  });

  beforeEach(() => {
    schemaUris.length = 0;
  });

  afterAll(async () => {
    await client.stop();
  });

  test("editing a schema with no dependents should revalidate only itself", async () => {
    await client.writeDocument("./report.schema.json", reportSchema);

    expect(schemaUris).to.include(reportUri);
    expect(schemaUris.length).to.equal(1);
  });

  test("editing a schema with direct dependents should only revalidate itself and its direct dependents", async () => {
    await client.writeDocument("./project.schema.json", projectSchema);

    expect(schemaUris).to.include(projectUri);
    expect(schemaUris).to.include(reportUri);
    expect(schemaUris.length).to.equal(2);
  });

  test("editing a schema with indirect dependents should only revalidate itself and the whole dependent chain", async () => {
    await client.writeDocument("./employee.schema.json", employeeSchema);

    expect(schemaUris).to.include(employeeUri);
    expect(schemaUris).to.include(projectUri);
    expect(schemaUris).to.include(reportUri);
    expect(schemaUris).to.not.include(policyUri);
    expect(schemaUris.length).to.equal(3);
  });

  test("editing a meta schema should revalidate itself and schemas using it as a dialect", async () => {
    const metaSchema = `{ 
      "$id": "https://test.com/schemas/meta-test",
      "$schema": "https://json-schema.org/draft/2020-12/schema"
    }`;
    const dependentSchema = `{ 
      "$id": "https://test.com/schemas/meta-dependent",
      "$schema": "https://test.com/schemas/meta-test" 
    }`;
    const metaUri = await client.writeDocument("./meta-test.schema.json", metaSchema);
    const dependentUri = await client.writeDocument("./meta-dependent.schema.json", dependentSchema);

    schemaUris.length = 0;

    await client.writeDocument("./meta-test.schema.json", metaSchema);

    expect(schemaUris).to.include(metaUri);
    expect(schemaUris).to.include(dependentUri);
    expect(schemaUris.length).to.equal(2);
  });

  test("editing a schema with circular dependencies should not cause infinite loops", async () => {
    const circularASchema = `{
      "$id": "https://test.com/schemas/circularA",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$ref": "https://test.com/schemas/circularB"
    }`;
    const circularBSchema = `{
      "$id": "https://test.com/schemas/circularB",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$ref": "https://test.com/schemas/circularA"
    }`;
    const circularAUri = await client.writeDocument("./circularA.schema.json", circularASchema);
    const circularBUri = await client.writeDocument("./circularB.schema.json", circularBSchema);

    schemaUris.length = 0;

    await client.writeDocument("./circularA.schema.json", circularASchema);

    expect(schemaUris).to.include(circularAUri);
    expect(schemaUris).to.include(circularBUri);
    expect(schemaUris.length).to.equal(2);

    schemaUris.length = 0;

    await client.writeDocument("./circularB.schema.json", circularBSchema);

    expect(schemaUris).to.include(circularAUri);
    expect(schemaUris).to.include(circularBUri);
    expect(schemaUris.length).to.equal(2);
  });

  test("deleting a schema should revalidate the dependent chain and clear itself", async () => {
    await client.deleteDocument(employeeUri);

    expect(schemaUris).to.include(employeeUri);
    expect(schemaUris).to.include(projectUri);
    expect(schemaUris).to.include(reportUri);
    expect(schemaUris.length).to.equal(3);
  });

  test("removing a reference should not trigger revalidation of the dependent chain", async () => {
    const projectSchemaNoRef = `{
      "$id": "https://test.com/schemas/project",
      "$schema": "https://test.com/schemas/policy",
      "security_level": "high",
      "properties": { "project_name": { "type": "string" } }
    }`;
    await client.writeDocument("./project.schema.json", projectSchemaNoRef);

    schemaUris.length = 0;

    await client.writeDocument("./employee.schema.json", employeeSchema);

    expect(schemaUris).to.include(employeeUri);
    expect(schemaUris.length).to.equal(1);
  });

  test("adding a reference should trigger revalidation of the dependent chain", async () => {
    await client.writeDocument("./project.schema.json", projectSchema);

    schemaUris.length = 0;

    await client.writeDocument("./employee.schema.json", employeeSchema);

    expect(schemaUris).to.include(employeeUri);
    expect(schemaUris).to.include(projectUri);
    expect(schemaUris).to.include(reportUri);
    expect(schemaUris.length).to.equal(3);
  });

  test("resolution of missing schemas should trigger revalidation when the schema becomes available", async () => {
    const aSchema = `{ 
      "$id": "https://test.com/schemas/a",
      "$schema": "https://json-schema.org/draft/2020-12/schema"
    }`;
    const bSchema = `{ 
      "$id": "https://test.com/schemas/b",
      "$schema": "https://test.com/schemas/a" 
    }`;
    const bUri = await client.writeDocument("./b.schema.json", bSchema);

    schemaUris.length = 0;

    const aUri = await client.writeDocument("./a.schema.json", aSchema);

    expect(schemaUris).to.include(bUri);
    expect(schemaUris).to.include(aUri);
    expect(schemaUris.length).to.equal(2);
  });

  test("changing $id should trigger revalidation of its dependents", async () => {
    const aSchema = `{ 
      "$id": "https://test.com/schemas/a-v1",
      "$schema": "https://json-schema.org/draft/2020-12/schema" 
    }`;
    const bSchema = `{ 
      "$id": "https://test.com/schemas/b",
      "$schema": "https://test.com/schemas/a-v1" 
    }`;
    const aUri = await client.writeDocument("./a.schema.json", aSchema);
    const bUri = await client.writeDocument("./b.schema.json", bSchema);

    schemaUris.length = 0;

    await client.writeDocument("./a.schema.json", aSchema.replace("/a-v1", "/a-v2"));

    expect(schemaUris).to.include(aUri);
    expect(schemaUris).to.include(bUri);
    expect(schemaUris.length).to.equal(2);
  });

  test("editing a schema with fragment references should revalidate its dependents", async () => {
    const aSchema = `{ 
      "$id": "https://test.com/schemas/a",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$defs": { "foo": { "type": "string" } }
    }`;
    const bSchema = `{ 
      "$id": "https://test.com/schemas/b",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$ref": "https://test.com/schemas/a#/$defs/foo" 
    }`;
    const aUri = await client.writeDocument("./a.schema.json", aSchema);
    const bUri = await client.writeDocument("./b.schema.json", bSchema);

    schemaUris.length = 0;

    await client.writeDocument("./a.schema.json", aSchema);

    expect(schemaUris).to.include(aUri);
    expect(schemaUris).to.include(bUri);
    expect(schemaUris.length).to.equal(2);
  });

  test("multiple schemas with the same $id should revalidate their dependents when either is edited", async () => {
    const aSchema = `{ 
      "$id": "https://test.com/schemas/shared",
      "$schema": "https://json-schema.org/draft/2020-12/schema"
    }`;
    const bSchema = `{ 
      "$id": "https://test.com/schemas/b",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "$ref": "https://test.com/schemas/shared" 
    }`;
    const cSchema = `{ 
      "$id": "https://test.com/schemas/shared",
      "$schema": "https://json-schema.org/draft/2020-12/schema"
    }`;
    const aUri = await client.writeDocument("./a.schema.json", aSchema);
    const bUri = await client.writeDocument("./b.schema.json", bSchema);
    const cUri = await client.writeDocument("./c.schema.json", cSchema);

    schemaUris.length = 0;

    await client.writeDocument("./a.schema.json", aSchema);
    expect(schemaUris).to.include(aUri);
    expect(schemaUris).to.include(bUri);
    expect(schemaUris.length).toBe(2);

    schemaUris.length = 0;

    await client.writeDocument("./c.schema.json", cSchema);
    expect(schemaUris).to.include(cUri);
    expect(schemaUris).to.include(bUri);
    expect(schemaUris.length).to.equal(2);
  });
});
