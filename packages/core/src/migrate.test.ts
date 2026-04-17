import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { migrateIndex } from "./migrate.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";
import { readIndex } from "./validate-project.js";

describe("migrateIndex", () => {
  it("fills schemaVersion for legacy objects", () => {
    const { index, changed } = migrateIndex({ bySourceFile: {}, schemaVersion: 0 });
    expect(changed).toBe(true);
    expect(index.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(index.byCommentrayPath).toEqual({});
  });

  it("is a no-op when already current", () => {
    const input = { schemaVersion: CURRENT_SCHEMA_VERSION, byCommentrayPath: {} };
    const { index, changed } = migrateIndex(input);
    expect(changed).toBe(false);
    expect(index).toEqual(input);
  });

  it("renames commentaryPath to commentrayPath and keys by commentrayPath when migrating from v1", () => {
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
    const cp = ".commentray/source/src/a.ts.md";
    expect(index.byCommentrayPath[cp]?.commentrayPath).toBe(cp);
    expect("commentaryPath" in (index.byCommentrayPath[cp] as object)).toBe(false);
  });
});

describe("readIndex auto-migration", () => {
  it("rewrites a v2 index on disk to schema v3", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-idx-"));
    const meta = path.join(dir, ".commentray", "metadata");
    await fs.mkdir(meta, { recursive: true });
    const indexPath = path.join(meta, "index.json");
    const legacy = {
      schemaVersion: 2,
      bySourceFile: {
        "src/a.ts": {
          sourcePath: "src/a.ts",
          commentrayPath: ".commentray/source/src/a.ts.md",
          blocks: [{ id: "b1", anchor: "lines:1-2" }],
        },
      },
    };
    await fs.writeFile(indexPath, JSON.stringify(legacy, null, 2), "utf8");
    const idx = await readIndex(dir);
    expect(idx?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const cp = ".commentray/source/src/a.ts.md";
    expect(idx?.byCommentrayPath[cp]?.blocks[0]?.id).toBe("b1");
    const round = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      byCommentrayPath?: unknown;
    };
    expect(round.byCommentrayPath).toBeDefined();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
