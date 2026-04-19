import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCommentrayConfig } from "./config.js";
import {
  applyPathRenamesToCommentrayIndex,
  inferAngleIdFromCommentrayPath,
} from "./commentray-index-renames.js";
import { CURRENT_SCHEMA_VERSION } from "./model.js";

describe("Inferring angle ids from companion paths", () => {
  it("extracts the angle file stem from an Angles-layout path", () => {
    expect(
      inferAngleIdFromCommentrayPath(
        ".commentray/source/pkg/foo.ts/intro.md",
        "pkg/foo.ts",
        ".commentray",
      ),
    ).toBe("intro");
  });
});

describe("Applying Git path renames to the Commentray index", () => {
  it("updates flat-layout source and commentray paths", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "commentray-rename-flat-"));
    try {
      await mkdir(path.join(repo, ".commentray", "source"), { recursive: true });
      const cfg = mergeCommentrayConfig(null);
      const index = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        byCommentrayPath: {
          ".commentray/source/src/old.ts.md": {
            sourcePath: "src/old.ts",
            commentrayPath: ".commentray/source/src/old.ts.md",
            blocks: [],
          },
        },
      };
      const { index: next, changed } = applyPathRenamesToCommentrayIndex(
        index,
        [{ from: "src/old.ts", to: "src/new.ts" }],
        repo,
        cfg,
      );
      expect(changed).toBe(true);
      const cp = ".commentray/source/src/new.ts.md";
      expect(next.byCommentrayPath[cp]).toEqual({
        sourcePath: "src/new.ts",
        commentrayPath: cp,
        blocks: [],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("updates Angles-layout paths when the source file moves", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "commentray-rename-ang-"));
    try {
      const sd = path.join(repo, ".commentray", "source");
      await mkdir(sd, { recursive: true });
      await writeFile(path.join(sd, ".default"), "sentinel\n", "utf8");
      const cfg = mergeCommentrayConfig(null);
      const oldCp = ".commentray/source/src/a.ts/intro.md";
      const index = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        byCommentrayPath: {
          [oldCp]: {
            sourcePath: "src/a.ts",
            commentrayPath: oldCp,
            blocks: [],
          },
        },
      };
      const { index: next, changed } = applyPathRenamesToCommentrayIndex(
        index,
        [{ from: "src/a.ts", to: "src/b/a.ts" }],
        repo,
        cfg,
      );
      expect(changed).toBe(true);
      const newCp = ".commentray/source/src/b/a.ts/intro.md";
      expect(next.byCommentrayPath[newCp]?.sourcePath).toBe("src/b/a.ts");
      expect(next.byCommentrayPath[newCp]?.commentrayPath).toBe(newCp);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
