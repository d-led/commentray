import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { migrateIndex } from "./migrate.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";
import { readIndex, refreshIndexMigrationsOnDisk } from "./validate-project.js";

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

describe("refreshIndexMigrationsOnDisk", () => {
  it("persists snippet normalization for legacy fingerprint blocks", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-refresh-"));
    const meta = path.join(dir, ".commentray", "metadata");
    await fs.mkdir(meta, { recursive: true });
    const indexPath = path.join(meta, "index.json");
    const cp = ".commentray/source/x.ts.md";
    const onDisk = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cp]: {
          sourcePath: "x.ts",
          commentrayPath: cp,
          blocks: [
            {
              id: "b1",
              anchor: "lines:1-2",
              fingerprint: { startLine: "a", endLine: "b", lineCount: 2 },
            },
          ],
        },
      },
    };
    await fs.writeFile(indexPath, JSON.stringify(onDisk, null, 2), "utf8");
    const { changed, index } = await refreshIndexMigrationsOnDisk(dir);
    expect(changed).toBe(true);
    const b0 = index.byCommentrayPath[cp]?.blocks[0] as { snippet?: string; fingerprint?: unknown };
    expect(b0.snippet).toBeDefined();
    expect(b0.fingerprint).toBeUndefined();
    const round = JSON.parse(await fs.readFile(indexPath, "utf8")) as typeof onDisk;
    expect(round.byCommentrayPath[cp]?.blocks[0]).toEqual(
      expect.objectContaining({ snippet: expect.any(String) }),
    );
    expect("fingerprint" in (round.byCommentrayPath[cp]?.blocks[0] as object)).toBe(false);
    const { changed: again } = await refreshIndexMigrationsOnDisk(dir);
    expect(again).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
