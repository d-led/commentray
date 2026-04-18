import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { describe, expect, it } from "vitest";

import { buildCommentrayNavSearchDocument } from "./build-commentray-nav-search.js";

async function setupRepoWithIndexedPair(opts: {
  sourcePath: string;
  commentrayPath: string;
  commentrayBody: string;
}): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cr-nav-"));
  await mkdir(path.join(dir, path.dirname(opts.commentrayPath)), { recursive: true });
  await writeFile(path.join(dir, opts.commentrayPath), opts.commentrayBody, "utf8");
  await mkdir(path.join(dir, ".commentray/metadata"), { recursive: true });
  await writeFile(
    path.join(dir, ".commentray/metadata/index.json"),
    JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [opts.commentrayPath]: {
          sourcePath: opts.sourcePath,
          commentrayPath: opts.commentrayPath,
          blocks: [],
        },
      },
    }),
    "utf8",
  );
  return dir;
}

describe("buildCommentrayNavSearchDocument", () => {
  it("indexes paths and commentray lines from metadata, not primary source", async () => {
    const cr = ".commentray/source/src/a.ts.md";
    const dir = await setupRepoWithIndexedPair({
      sourcePath: "src/a.ts",
      commentrayPath: cr,
      commentrayBody: "# Title\n\nHello.\n",
    });

    const doc = await buildCommentrayNavSearchDocument(dir);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.documentedPairs).toBeUndefined();
    expect(doc.rows.some((r) => r.kind === "sourcePath" && r.sourcePath === "src/a.ts")).toBe(true);
    expect(doc.rows.some((r) => r.kind === "commentrayPath" && r.commentrayPath === cr)).toBe(true);
    const lines = doc.rows.filter((r) => r.kind === "commentrayLine");
    expect(lines.map((r) => r.text)).toEqual(["# Title", "", "Hello.", ""]);
    expect(lines[0]?.line).toBe(0);
  });

  it("adds documentedPairs with GitHub blob URLs when githubBlobBase is set", async () => {
    const cr = ".commentray/source/src/a.ts.md";
    const dir = await setupRepoWithIndexedPair({
      sourcePath: "src/a.ts",
      commentrayPath: cr,
      commentrayBody: "# Title\n",
    });

    const doc = await buildCommentrayNavSearchDocument(dir, undefined, {
      owner: "acme",
      repo: "demo",
      branch: "main",
    });
    expect(doc.documentedPairs).toEqual([
      {
        sourcePath: "src/a.ts",
        commentrayPath: cr,
        sourceOnGithub: "https://github.com/acme/demo/blob/main/src/a.ts",
        commentrayOnGithub: "https://github.com/acme/demo/blob/main/.commentray/source/src/a.ts.md",
      },
    ]);
  });

  it("uses fallback when index is absent and still omits source file contents", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-nav-"));
    const mdAbs = path.join(dir, "notes.md");
    await writeFile(mdAbs, "One\nTwo\n", "utf8");

    const doc = await buildCommentrayNavSearchDocument(dir, {
      sourcePath: "lib/x.ts",
      commentrayPath: ".commentray/source/lib/x.ts.md",
      markdownAbs: mdAbs,
    });

    expect(doc.rows.filter((r) => r.kind === "sourcePath")).toHaveLength(1);
    expect(doc.rows.filter((r) => r.kind === "commentrayLine").map((r) => r.text)).toEqual([
      "One",
      "Two",
      "",
    ]);
    expect(doc.documentedPairs).toBeUndefined();
  });

  it("adds documentedPairs for fallback-only when githubBlobBase is set", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-nav-"));
    const mdAbs = path.join(dir, "notes.md");
    await writeFile(mdAbs, "One\n", "utf8");

    const doc = await buildCommentrayNavSearchDocument(
      dir,
      {
        sourcePath: "lib/x.ts",
        commentrayPath: ".commentray/source/lib/x.ts.md",
        markdownAbs: mdAbs,
      },
      { owner: "acme", repo: "demo", branch: "develop" },
    );

    expect(doc.documentedPairs).toEqual([
      {
        sourcePath: "lib/x.ts",
        commentrayPath: ".commentray/source/lib/x.ts.md",
        sourceOnGithub: "https://github.com/acme/demo/blob/develop/lib/x.ts",
        commentrayOnGithub:
          "https://github.com/acme/demo/blob/develop/.commentray/source/lib/x.ts.md",
      },
    ]);
  });
});
