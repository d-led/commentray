import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";

import {
  blockStretchRowsForDocumentedPair,
  loadMultiAngleBrowsingIfEnabled,
} from "./github-pages-site-prep.js";

describe("blockStretchRowsForDocumentedPair", () => {
  const cr = ".commentray/source/extra.ts/main.md";
  const index = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [cr]: {
        sourcePath: "extra.ts",
        commentrayPath: cr,
        blocks: [{ id: "b1", anchor: "lines:1-2" }],
      },
    },
  };

  it("returns undefined when the index is missing", () => {
    expect(blockStretchRowsForDocumentedPair(null, "extra.ts", cr)).toBeUndefined();
  });

  it("returns undefined when the source path does not match the index entry", () => {
    expect(blockStretchRowsForDocumentedPair(index, "other.ts", cr)).toBeUndefined();
  });

  it("returns wiring for a matching pair with blocks", () => {
    expect(blockStretchRowsForDocumentedPair(index, "extra.ts", cr)).toEqual({
      index,
      sourceRelative: "extra.ts",
      commentrayPathRel: cr,
    });
  });

  it("returns undefined when the commentray path is not a key in the index", () => {
    expect(
      blockStretchRowsForDocumentedPair(index, "extra.ts", ".commentray/source/extra.ts/other.md"),
    ).toBeUndefined();
  });

  it("returns undefined when the index entry has no blocks", () => {
    const emptyBlocks = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [cr]: {
          sourcePath: "extra.ts",
          commentrayPath: cr,
          blocks: [],
        },
      },
    };
    expect(blockStretchRowsForDocumentedPair(emptyBlocks, "extra.ts", cr)).toBeUndefined();
  });
});

describe("loadMultiAngleBrowsingIfEnabled", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await import("node:fs/promises").then(({ rm }) =>
          rm(dir, { recursive: true, force: true }),
        );
      }),
    );
  });

  it("keeps block stretch wiring for angles that rely on marker fallback instead of their own index slice", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "commentray-prep-"));
    tempDirs.push(repoRoot);

    const angleDir = path.join(repoRoot, ".commentray/source/README.md");
    await mkdir(angleDir, { recursive: true });
    await writeFile(path.join(repoRoot, ".commentray/source/.default"), "", "utf8");
    await writeFile(
      path.join(angleDir, "main.md"),
      "<!-- commentray:block id=readme-lede -->\n",
      "utf8",
    );
    await writeFile(
      path.join(angleDir, "architecture.md"),
      "<!-- commentray:block id=readme-lede -->\n",
      "utf8",
    );

    const cfg = {
      storageDir: ".commentray",
      angles: {
        definitions: [
          { id: "main", title: "Main" },
          { id: "architecture", title: "Architecture" },
        ],
      },
    };
    const ss = {
      sourceFile: "README.md",
      introMarkdown: "",
      githubUrl: "https://github.com/d-led/commentray",
      githubBlobBranch: "main",
    };
    const projectIndex = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        ".commentray/source/README.md/main.md": {
          sourcePath: "README.md",
          commentrayPath: ".commentray/source/README.md/main.md",
          blocks: [{ id: "readme-lede", anchor: "marker:readme-lede", markerId: "readme-lede" }],
        },
      },
    };

    const multi = await loadMultiAngleBrowsingIfEnabled(
      repoRoot,
      cfg as never,
      ss as never,
      projectIndex,
      { owner: "d-led", repo: "commentray", branch: "main" },
    );

    expect(multi?.angles).toHaveLength(2);
    const architecture = multi?.angles.find((angle) => angle.id === "architecture");
    expect(architecture?.blockStretchRows).toEqual({
      index: projectIndex,
      sourceRelative: "README.md",
      commentrayPathRel: ".commentray/source/README.md/architecture.md",
    });
  });
});
