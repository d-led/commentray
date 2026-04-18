import { describe, expect, it } from "vitest";

import { describeIndexSchemaRemediation } from "./index-schema-messages.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";

describe("describeIndexSchemaRemediation", () => {
  it("names the bundled schema version and concrete recovery options", () => {
    const msg = describeIndexSchemaRemediation(999);
    expect(msg).toContain(String(CURRENT_SCHEMA_VERSION));
    expect(msg).toContain("999");
    expect(msg).toContain("install-extension.sh");
    expect(msg).toContain("index.schema-");
    expect(msg).toContain("backup");
  });
});
