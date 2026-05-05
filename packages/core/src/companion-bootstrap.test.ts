import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ensureCompanionForSource } from "./companion-bootstrap.js";

describe("ensureCompanionForSource", () => {
  it("creates companion markdown and index entry when missing", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "commentray-core-companion-"));
    try {
      await writeFile(path.join(repo, ".commentray.toml"), "", "utf8");
      const out = await ensureCompanionForSource(repo, "README.md");

      expect(out.createdMarkdown).toBe(true);
      expect(out.createdIndexEntry).toBe(true);
      expect(out.commentrayPath).toBe(".commentray/source/README.md.md");

      const md = await readFile(path.join(repo, out.commentrayPath), "utf8");
      expect(md).toContain("# README.md");

      const indexRaw = await readFile(
        path.join(repo, ".commentray", "metadata", "index.json"),
        "utf8",
      );
      const index = JSON.parse(indexRaw) as {
        byCommentrayPath: Record<string, { sourcePath: string; blocks: unknown[] }>;
      };
      expect(index.byCommentrayPath[out.commentrayPath]).toEqual({
        sourcePath: "README.md",
        commentrayPath: out.commentrayPath,
        blocks: [],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("is idempotent when companion and index entry already exist", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "commentray-core-companion-idem-"));
    try {
      await writeFile(path.join(repo, ".commentray.toml"), "", "utf8");
      await ensureCompanionForSource(repo, "README.md");

      const out = await ensureCompanionForSource(repo, "README.md");
      expect(out.createdMarkdown).toBe(false);
      expect(out.createdIndexEntry).toBe(false);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("respects explicit commentray path override and still upserts index", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "commentray-core-companion-explicit-"));
    try {
      await writeFile(path.join(repo, ".commentray.toml"), "", "utf8");
      const out = await ensureCompanionForSource(repo, "README.md", {
        commentrayPath: "commentray.md",
      });

      expect(out.commentrayPath).toBe("commentray.md");
      const md = await readFile(path.join(repo, "commentray.md"), "utf8");
      expect(md).toContain("# README.md");

      const indexRaw = await readFile(
        path.join(repo, ".commentray", "metadata", "index.json"),
        "utf8",
      );
      const index = JSON.parse(indexRaw) as {
        byCommentrayPath: Record<string, { sourcePath: string; commentrayPath: string }>;
      };
      expect(index.byCommentrayPath["commentray.md"]).toEqual({
        sourcePath: "README.md",
        commentrayPath: "commentray.md",
        blocks: [],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
