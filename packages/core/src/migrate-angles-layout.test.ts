import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { commentrayAnglesSentinelPath, commentrayMarkdownPathForAngle } from "./paths.js";
import {
  discoverFlatCompanionMarkdownFiles,
  flatRelToSourcePath,
  planAnglesMigrationFromCompanions,
  rewriteIndexKeysForAnglesMigration,
} from "./migrate-angles-layout.js";
import type { CommentrayIndex } from "./model.js";

describe("flatRelToSourcePath", () => {
  it("strips the trailing companion .md suffix", () => {
    expect(flatRelToSourcePath("README.md.md")).toBe("README.md");
    expect(flatRelToSourcePath("packages/cli/src/init.ts.md")).toBe("packages/cli/src/init.ts");
  });
});

describe("planAnglesMigrationFromCompanions", () => {
  it("maps each flat companion to an angle path under the source folder", () => {
    const plan = planAnglesMigrationFromCompanions(
      [
        {
          flatCommentrayPath: ".commentray/source/README.md.md",
          sourcePath: "README.md",
        },
      ],
      "main",
      ".commentray",
    );
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0]?.toRepoRel).toBe(
      commentrayMarkdownPathForAngle("README.md", "main", ".commentray"),
    );
    expect(plan.flatToAnglePath.get(".commentray/source/README.md.md")).toBe(
      plan.moves[0]?.toRepoRel,
    );
  });
});

describe("rewriteIndexKeysForAnglesMigration", () => {
  it("rewrites byCommentrayPath keys and entry.commentrayPath", () => {
    const index: CommentrayIndex = {
      schemaVersion: 3,
      byCommentrayPath: {
        ".commentray/source/README.md.md": {
          sourcePath: "README.md",
          commentrayPath: ".commentray/source/README.md.md",
          blocks: [],
        },
      },
    };
    const map = new Map([
      [
        ".commentray/source/README.md.md",
        commentrayMarkdownPathForAngle("README.md", "main", ".commentray"),
      ],
    ]);
    const next = rewriteIndexKeysForAnglesMigration(index, map);
    const k = commentrayMarkdownPathForAngle("README.md", "main", ".commentray");
    expect(Object.keys(next.byCommentrayPath)).toEqual([k]);
    expect(next.byCommentrayPath[k]?.commentrayPath).toBe(k);
  });
});

describe("discoverFlatCompanionMarkdownFiles", () => {
  it("given a repo with only flat companions, lists every *.md under source", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-migrate-discover-"));
    const storage = ".commentray";
    const sourceDir = path.join(dir, storage, "source");
    await mkdir(path.join(sourceDir, "docs", "spec"), { recursive: true });
    await writeFile(path.join(sourceDir, "README.md.md"), "# x\n", "utf8");
    await writeFile(path.join(sourceDir, "docs", "spec", "blocks.md.md"), "# y\n", "utf8");
    const found = await discoverFlatCompanionMarkdownFiles(dir, storage);
    expect(found.map((f) => f.sourcePath).sort()).toEqual(
      ["README.md", "docs/spec/blocks.md"].sort(),
    );
    await rm(dir, { recursive: true, force: true });
  });

  it("given the angles sentinel exists, returns an empty list", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-migrate-sentinel-"));
    const storage = ".commentray";
    const sentinel = path.join(dir, ...commentrayAnglesSentinelPath(storage).split("/"));
    await mkdir(path.dirname(sentinel), { recursive: true });
    await writeFile(sentinel, "", "utf8");
    await writeFile(path.join(dir, storage, "source", "README.md.md"), "# x\n", "utf8");
    expect(await discoverFlatCompanionMarkdownFiles(dir, storage)).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });
});
