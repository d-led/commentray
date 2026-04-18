import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "@commentray/core";

import { runInitFull } from "./init.js";

describe("runInitFull", () => {
  it("creates storage, index, and config on a fresh directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "commentray-init-"));
    try {
      const code = await runInitFull(dir);
      expect(code).toBe(0);
      const indexRaw = await readFile(
        path.join(dir, ".commentray", "metadata", "index.json"),
        "utf8",
      );
      const index = JSON.parse(indexRaw) as { schemaVersion: number };
      expect(index.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      await readFile(path.join(dir, ".commentray.toml"), "utf8");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is idempotent on a second run", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "commentray-init-2-"));
    try {
      expect(await runInitFull(dir)).toBe(0);
      expect(await runInitFull(dir)).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("migrates an existing legacy index on disk", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "commentray-init-mig-"));
    try {
      await mkdir(path.join(dir, ".commentray", "metadata"), { recursive: true });
      await mkdir(path.join(dir, ".commentray", "source"), { recursive: true });
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
      await writeFile(
        path.join(dir, ".commentray", "metadata", "index.json"),
        JSON.stringify(legacy, null, 2),
        "utf8",
      );
      expect(await runInitFull(dir)).toBe(0);
      const round = JSON.parse(
        await readFile(path.join(dir, ".commentray", "metadata", "index.json"), "utf8"),
      ) as { schemaVersion: number; byCommentrayPath?: Record<string, unknown> };
      expect(round.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(round.byCommentrayPath).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns non-zero when index.json is invalid JSON", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "commentray-init-bad-"));
    try {
      await mkdir(path.join(dir, ".commentray", "metadata"), { recursive: true });
      await mkdir(path.join(dir, ".commentray", "source"), { recursive: true });
      await writeFile(
        path.join(dir, ".commentray", "metadata", "index.json"),
        "{not json\n",
        "utf8",
      );
      expect(await runInitFull(dir)).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
