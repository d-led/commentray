import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse as parseToml } from "@iarna/toml";

import { describe, expect, it } from "vitest";

import { type CommentrayToml, mergeCommentrayConfig } from "./config.js";
import { ensureAnglesSentinelFile, upsertAngleDefinitionInCommentrayToml } from "./angles-toml.js";
import { commentrayAnglesSentinelPath } from "./paths.js";

describe("Angles sentinel file creation", () => {
  it("creates the sentinel once under the configured storage dir", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-sent-"));
    const storage = "var/cr";
    await ensureAnglesSentinelFile(dir, storage);
    const rel = commentrayAnglesSentinelPath(storage);
    const abs = path.join(dir, ...rel.split("/"));
    const st = await fs.stat(abs);
    expect(st.isFile()).toBe(true);
    await ensureAnglesSentinelFile(dir, storage);
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe("Upserting angle definitions in .commentray.toml", () => {
  it("creates a new .commentray.toml with storage and the angle when missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-toml-"));
    await upsertAngleDefinitionInCommentrayToml(dir, { id: "architecture", title: "Architecture" });
    const raw = await fs.readFile(path.join(dir, ".commentray.toml"), "utf8");
    const cfg = mergeCommentrayConfig(parseToml(raw) as CommentrayToml);
    expect(cfg.angles.defaultAngleId).toBe("architecture");
    expect(cfg.angles.definitions).toEqual([{ id: "architecture", title: "Architecture" }]);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("throws when the angle id is already listed", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-toml-dup-"));
    await upsertAngleDefinitionInCommentrayToml(dir, { id: "main" });
    await expect(upsertAngleDefinitionInCommentrayToml(dir, { id: "main" })).rejects.toThrow(
      /already listed/,
    );
    await fs.rm(dir, { recursive: true, force: true });
  });
});
