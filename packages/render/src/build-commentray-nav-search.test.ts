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

describe("Cross-file search manifest — index and fallback", () => {
  it("should index paths and companion lines from metadata without ingesting primary source text", async () => {
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

  it("should attach documentedPairs with GitHub blob URLs when a blob base is configured", async () => {
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

  it("should build from a lone companion when metadata is missing and still skip source bodies", async () => {
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

  it("should still emit documentedPairs for fallback-only pairs when GitHub metadata is present", async () => {
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

describe("Cross-file search manifest — disk merge", () => {
  it("should merge disk-only companions with index-backed pairs for search rows and documentedPairs", async () => {
    const cr = ".commentray/source/src/a.ts.md";
    const dir = await setupRepoWithIndexedPair({
      sourcePath: "src/a.ts",
      commentrayPath: cr,
      commentrayBody: "# A\n",
    });
    await writeFile(
      path.join(dir, ".commentray/source/README.md.md"),
      "# Readme companion\n",
      "utf8",
    );

    const doc = await buildCommentrayNavSearchDocument(dir, undefined, {
      owner: "acme",
      repo: "demo",
      branch: "main",
    });

    expect(doc.documentedPairs).toEqual(
      expect.arrayContaining([
        {
          sourcePath: "README.md",
          commentrayPath: ".commentray/source/README.md.md",
          sourceOnGithub: "https://github.com/acme/demo/blob/main/README.md",
          commentrayOnGithub:
            "https://github.com/acme/demo/blob/main/.commentray/source/README.md.md",
        },
        {
          sourcePath: "src/a.ts",
          commentrayPath: cr,
          sourceOnGithub: "https://github.com/acme/demo/blob/main/src/a.ts",
          commentrayOnGithub:
            "https://github.com/acme/demo/blob/main/.commentray/source/src/a.ts.md",
        },
      ]),
    );
    expect(doc.documentedPairs).toHaveLength(2);
    expect(doc.rows.some((r) => r.kind === "sourcePath" && r.sourcePath === "README.md")).toBe(
      true,
    );
    const readmeLines = doc.rows.filter(
      (r) => r.kind === "commentrayLine" && r.commentrayPath === ".commentray/source/README.md.md",
    );
    expect(readmeLines.map((r) => r.text)).toEqual(["# Readme companion", ""]);
  });
});
