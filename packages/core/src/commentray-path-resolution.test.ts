import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mergeCommentrayConfig } from "./config.js";
import { resolveCommentrayMarkdownPath } from "./commentray-path-resolution.js";

describe("resolveCommentrayMarkdownPath", () => {
  it("uses flat mapping when the Angles sentinel is absent", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-flat-"));
    const cfg = mergeCommentrayConfig(null);
    const r = resolveCommentrayMarkdownPath(dir, "README.md", cfg, null);
    expect(r.anglesLayout).toBe(false);
    expect(r.angleId).toBeNull();
    expect(r.commentrayPath).toBe(".commentray/source/README.md.md");
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("uses per-angle paths when the sentinel exists", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-ang-"));
    const storage = ".commentray";
    const sourceDir = path.join(dir, storage, "source");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, ".default"), "", "utf8");
    const cfg = mergeCommentrayConfig({
      angles: { default_angle: "intro", definitions: [{ id: "intro", title: "Intro" }] },
    });
    const r = resolveCommentrayMarkdownPath(dir, "README.md", cfg, null);
    expect(r.anglesLayout).toBe(true);
    expect(r.angleId).toBe("intro");
    expect(r.commentrayPath).toBe(".commentray/source/README.md/intro.md");
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("honors an explicit angle id", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "commentray-ang2-"));
    const storage = ".commentray";
    const sourceDir = path.join(dir, storage, "source");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, ".default"), "", "utf8");
    const cfg = mergeCommentrayConfig(null);
    const r = resolveCommentrayMarkdownPath(dir, "src/a.ts", cfg, "deep-dive");
    expect(r.angleId).toBe("deep-dive");
    expect(r.commentrayPath).toBe(".commentray/source/src/a.ts/deep-dive.md");
    await fs.rm(dir, { recursive: true, force: true });
  });
});
