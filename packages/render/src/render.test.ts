import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./markdown-pipeline.js";
import { renderSideBySideHtml } from "./side-by-side.js";

describe("renderMarkdownToHtml", () => {
  it("renders basic markdown", async () => {
    const html = await renderMarkdownToHtml("# Title\n\nHello **world**.");
    expect(html).toContain("<h1");
    expect(html).toContain("world");
  });

  it("rewrites matching GitHub blob URLs to paths relative to the HTML output file", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cr-gh-"));
    const repoRoot = path.join(tmp, "repo");
    await mkdir(path.join(repoRoot, "docs", "spec"), { recursive: true });
    await writeFile(path.join(repoRoot, "docs", "spec", "storage.md"), "# hi\n", "utf8");
    const outHtml = path.join(repoRoot, "_site", "index.html");
    await mkdir(path.dirname(outHtml), { recursive: true });

    const md =
      "[Storage](https://github.com/acme/demo/blob/main/docs/spec/storage.md) " +
      "and [other](https://github.com/other/repo/blob/main/x.md).";
    const html = await renderMarkdownToHtml(md, {
      githubBlobLinkRewrite: {
        owner: "acme",
        repo: "demo",
        htmlOutputFileAbs: outHtml,
        repoRootAbs: repoRoot,
      },
    });
    expect(html).toContain('href="../docs/spec/storage.md"');
    expect(html).toContain("github.com/other/repo");
  });

  it("does not rewrite when the GitHub link targets another owner or repo", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cr-gh2-"));
    const repoRoot = path.join(tmp, "r");
    await mkdir(repoRoot, { recursive: true });
    const outHtml = path.join(repoRoot, "out.html");
    const md = "[x](https://github.com/wrong/repo/blob/main/README.md)";
    const html = await renderMarkdownToHtml(md, {
      githubBlobLinkRewrite: {
        owner: "acme",
        repo: "demo",
        htmlOutputFileAbs: outHtml,
        repoRootAbs: repoRoot,
      },
    });
    expect(html).toContain("github.com/wrong/repo");
  });
});

describe("renderSideBySideHtml", () => {
  it("produces a two-column document", async () => {
    const html = await renderSideBySideHtml({
      title: "Demo",
      code: "const x = 1;",
      language: "ts",
      commentrayMarkdown: "## Notes\n\nSee `x`.",
      includeMermaidRuntime: false,
    });
    expect(html).toContain("grid-template-columns");
    expect(html).toMatch(/const.*x.*1/);
    expect(html).toContain("Notes");
  });

  it("forwards githubBlobLinkRewrite into the commentray pane", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cr-sbs-"));
    const repoRoot = path.join(tmp, "repo");
    await mkdir(path.join(repoRoot, "a"), { recursive: true });
    await writeFile(path.join(repoRoot, "a", "b.md"), "x", "utf8");
    const outHtml = path.join(repoRoot, "dist", "x.html");
    await mkdir(path.dirname(outHtml), { recursive: true });

    const html = await renderSideBySideHtml({
      title: "Demo",
      code: "x",
      language: "txt",
      commentrayMarkdown: "[b](https://github.com/o/r/blob/main/a/b.md)",
      includeMermaidRuntime: false,
      githubBlobLinkRewrite: {
        owner: "o",
        repo: "r",
        htmlOutputFileAbs: outHtml,
        repoRootAbs: repoRoot,
      },
    });
    expect(html).toContain('href="../a/b.md"');
  });
});
