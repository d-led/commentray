import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  commentrayActiveEditorUiFlags,
  commentrayStorageSourcePrefix,
} from "./commentray-active-editor-ui-context.js";

async function withCommentrayAnglesSentinelRepo(
  tmpPrefix: string,
  fn: (repoRoot: string) => Promise<void>,
): Promise<void> {
  const tmpRepo = await mkdtemp(path.join(os.tmpdir(), tmpPrefix));
  try {
    const sentinel = path.join(tmpRepo, ".commentray", "source", ".default");
    await mkdir(path.dirname(sentinel), { recursive: true });
    await writeFile(sentinel, "", "utf8");
    await fn(tmpRepo);
  } finally {
    await rm(tmpRepo, { recursive: true, force: true }).catch(() => {});
  }
}

describe("commentrayStorageSourcePrefix", () => {
  it("given a storage dir with backslashes, when building the prefix, then the prefix uses forward slashes", () => {
    expect(commentrayStorageSourcePrefix(".commentray")).toBe(".commentray/source/");
    expect(commentrayStorageSourcePrefix("docs-cr")).toBe("docs-cr/source/");
  });
});

describe("commentrayActiveEditorUiFlags", () => {
  it("given a primary source path outside storage, when computing flags, then neither companion flag is set", () => {
    const flags = commentrayActiveEditorUiFlags({
      normalizedRepoRelativePath: "packages/core/src/foo.ts",
      storageDir: ".commentray",
      repoRoot: "/tmp/ignored-for-this-case",
    });
    expect(flags).toEqual({
      underCompanionSourceTree: false,
      isResolvableCompanionMarkdown: false,
    });
  });

  it("given a flat companion markdown path and angles off, when computing flags, then both companion flags are set", () => {
    const flags = commentrayActiveEditorUiFlags({
      normalizedRepoRelativePath: ".commentray/source/src/sample.ts.md",
      storageDir: ".commentray",
      repoRoot: "/tmp/ignored",
    });
    expect(flags).toEqual({
      underCompanionSourceTree: true,
      isResolvableCompanionMarkdown: true,
    });
  });

  it("given a path under storage that is not companion markdown, when computing flags, then under-tree is true but markdown is not resolvable", () => {
    const flags = commentrayActiveEditorUiFlags({
      normalizedRepoRelativePath: ".commentray/source/README.txt",
      storageDir: ".commentray",
      repoRoot: "/tmp/ignored",
    });
    expect(flags).toEqual({
      underCompanionSourceTree: true,
      isResolvableCompanionMarkdown: false,
    });
  });

  it("given a custom storage dir, when the path is under that dir’s source tree, then flags use the same prefix rule", () => {
    const flags = commentrayActiveEditorUiFlags({
      normalizedRepoRelativePath: "docs-cr/source/a.ts.md",
      storageDir: "docs-cr",
      repoRoot: "/tmp/ignored",
    });
    expect(flags).toEqual({
      underCompanionSourceTree: true,
      isResolvableCompanionMarkdown: true,
    });
  });

  it("given angles sentinel exists on disk, when the path is a per-angle companion markdown, then markdown is resolvable", async () => {
    await withCommentrayAnglesSentinelRepo("cr-ui-angles-", async (tmpRepo) => {
      const flags = commentrayActiveEditorUiFlags({
        normalizedRepoRelativePath: ".commentray/source/pkg/mod.ts/main.md",
        storageDir: ".commentray",
        repoRoot: tmpRepo,
      });
      expect(flags).toEqual({
        underCompanionSourceTree: true,
        isResolvableCompanionMarkdown: true,
      });
    });
  });

  it("given angles sentinel exists, when the companion uses another angle id, then markdown is still resolvable", async () => {
    await withCommentrayAnglesSentinelRepo("cr-ui-angles-readme-", async (tmpRepo) => {
      const flags = commentrayActiveEditorUiFlags({
        normalizedRepoRelativePath: ".commentray/source/README.md/architecture.md",
        storageDir: ".commentray",
        repoRoot: tmpRepo,
      });
      expect(flags).toEqual({
        underCompanionSourceTree: true,
        isResolvableCompanionMarkdown: true,
      });
    });
  });

  it("given angles sentinel is missing, when the path looks like nested folders plus markdown, then flat slice rule applies", () => {
    const flags = commentrayActiveEditorUiFlags({
      normalizedRepoRelativePath: ".commentray/source/pkg/mod.ts/main.md",
      storageDir: ".commentray",
      repoRoot: "/tmp/no-sentinel",
    });
    expect(flags.underCompanionSourceTree).toBe(true);
    expect(flags.isResolvableCompanionMarkdown).toBe(true);
  });
});
