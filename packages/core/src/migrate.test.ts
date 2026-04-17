import { describe, expect, it } from "vitest";
import { migrateIndex } from "./migrate.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";

describe("migrateIndex", () => {
  it("fills schemaVersion for legacy objects", () => {
    const { index, changed } = migrateIndex({ bySourceFile: {}, schemaVersion: 0 });
    expect(changed).toBe(true);
    expect(index.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("is a no-op when already current", () => {
    const input = { schemaVersion: CURRENT_SCHEMA_VERSION, bySourceFile: {} };
    const { index, changed } = migrateIndex(input);
    expect(changed).toBe(false);
    expect(index).toEqual(input);
  });
});
