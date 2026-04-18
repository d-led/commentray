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
      commentrayOutputUrls: {
        repoRootAbs: repoRoot,
        htmlOutputFileAbs: outHtml,
        markdownUrlBaseDirAbs: repoRoot,
        githubBlobRepo: { owner: "acme", repo: "demo" },
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
      commentrayOutputUrls: {
        repoRootAbs: repoRoot,
        htmlOutputFileAbs: outHtml,
        markdownUrlBaseDirAbs: repoRoot,
        githubBlobRepo: { owner: "acme", repo: "demo" },
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

  it("loads highlight.js theme CSS so fenced code is not unstyled", async () => {
    const html = await renderSideBySideHtml({
      title: "Demo",
      code: "x",
      language: "txt",
      commentrayMarkdown: "y",
      includeMermaidRuntime: false,
    });
    expect(html).toContain(
      "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github.min.css",
    );
    expect(html).toContain(
      "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css",
    );
  });

  it("honours hljsTheme for the dark stylesheet when the theme name includes dark", async () => {
    const html = await renderSideBySideHtml({
      title: "Demo",
      code: "x",
      language: "txt",
      commentrayMarkdown: "y",
      hljsTheme: "github-dark",
      includeMermaidRuntime: false,
    });
    expect(html).toContain(
      "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css",
    );
  });

  it("forwards commentrayOutputUrls into the commentray pane", async () => {
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
      commentrayOutputUrls: {
        repoRootAbs: repoRoot,
        htmlOutputFileAbs: outHtml,
        markdownUrlBaseDirAbs: repoRoot,
        githubBlobRepo: { owner: "o", repo: "r" },
      },
    });
    expect(html).toContain('href="../a/b.md"');
  });
});

describe("renderMarkdownToHtml — static asset URLs", () => {
  it("resolves companion-relative and repo-root images for static HTML", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cr-img-"));
    const repoRoot = path.join(tmp, "repo");
    const companionDir = path.join(repoRoot, ".commentray", "source");
    await mkdir(companionDir, { recursive: true });
    await writeFile(path.join(companionDir, "diagram.svg"), "<svg/>", "utf8");
    await mkdir(path.join(repoRoot, "docs"), { recursive: true });
    await writeFile(path.join(repoRoot, "docs", "logo.svg"), "<svg/>", "utf8");
    const outHtml = path.join(repoRoot, "_site", "index.html");
    await mkdir(path.dirname(outHtml), { recursive: true });

    const md = "![local](./diagram.svg) ![root](/docs/logo.svg)";
    const html = await renderMarkdownToHtml(md, {
      commentrayOutputUrls: {
        repoRootAbs: repoRoot,
        htmlOutputFileAbs: outHtml,
        markdownUrlBaseDirAbs: companionDir,
      },
    });
    expect(html).toContain('src="../.commentray/source/diagram.svg"');
    expect(html).toContain('src="../docs/logo.svg"');
  });

  it("resolves a path relative to the companion directory (no leading ./)", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cr-img2-"));
    const repoRoot = path.join(tmp, "repo");
    const companionDir = path.join(repoRoot, ".commentray", "source");
    await mkdir(path.join(companionDir, "figures"), { recursive: true });
    await writeFile(path.join(companionDir, "figures", "a.svg"), "<svg/>", "utf8");
    const outHtml = path.join(repoRoot, "out", "index.html");
    await mkdir(path.dirname(outHtml), { recursive: true });

    const html = await renderMarkdownToHtml("![](figures/a.svg)", {
      commentrayOutputUrls: {
        repoRootAbs: repoRoot,
        htmlOutputFileAbs: outHtml,
        markdownUrlBaseDirAbs: companionDir,
      },
    });
    expect(html).toContain('src="../.commentray/source/figures/a.svg"');
  });
});
