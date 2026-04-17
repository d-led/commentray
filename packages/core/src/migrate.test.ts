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

  it("renames commentaryPath to commentrayPath when migrating from v1", () => {
    const { index, changed } = migrateIndex({
      schemaVersion: 1,
      bySourceFile: {
        "src/a.ts": {
          sourcePath: "src/a.ts",
          commentaryPath: ".commentray/source/src/a.ts.md",
          blocks: [],
        },
      },
    });
    expect(changed).toBe(true);
    expect(index.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(index.bySourceFile["src/a.ts"]?.commentrayPath).toBe(".commentray/source/src/a.ts.md");
    expect("commentaryPath" in (index.bySourceFile["src/a.ts"] as object)).toBe(false);
  });
});
