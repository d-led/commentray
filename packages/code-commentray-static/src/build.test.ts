import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildCommentrayStatic } from "./build.js";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Static browse HTML build — shell", () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("should write HTML that embeds highlighted source and the companion pane", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    const builtAt = new Date("2026-01-02T03:04:05.006Z");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      title: "Test",
      builtAt,
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain("greet");
    expect(html).toContain("Resizable divider");
    expect(html).toContain('<meta name="generator" content="Commentray @commentray/render@');
    expect(html).toContain("@commentray/code-commentray-static@");
    expect(html).toContain("builtAt=2026-01-02T03:04:05.006Z");
    expect(html).toContain("HTML generated");
    expect(html).toContain('datetime="2026-01-02T03:04:05.006Z"');
  });

  it("should omit the generator meta tag when generatorLabel is explicitly empty", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      generatorLabel: "",
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).not.toContain('<meta name="generator"');
  });

  it("should show the provided repo-relative path in the nav rail context", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      filePath: "packages/code-commentray-static/fixtures/sample.ts",
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain('aria-label="Current documentation pair"');
    expect(html).toContain("packages/code-commentray-static/fixtures/sample.ts");
  });

  it("should fall back to the source basename in the nav rail when filePath is omitted", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain("sample.ts");
  });
});

describe("Static browse HTML build — URLs and toolbar", () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("should rewrite companion links using commentrayOutputUrls", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const repoRoot = path.join(outDir, "repo");
    await mkdir(path.join(repoRoot, "docs"), { recursive: true });
    await writeFile(path.join(repoRoot, "docs", "guide.md"), "# Guide\n", "utf8");
    const mdPath = path.join(outDir, "body.md");
    await writeFile(
      mdPath,
      "[Guide](https://github.com/acme/demo/blob/main/docs/guide.md)\n",
      "utf8",
    );
    const outHtml = path.join(repoRoot, "_site", "index.html");
    await mkdir(path.dirname(outHtml), { recursive: true });
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: mdPath,
      outHtml,
      commentrayOutputUrls: {
        repoRootAbs: repoRoot,
        htmlOutputFileAbs: outHtml,
        markdownUrlBaseDirAbs: path.dirname(mdPath),
        githubBlobRepo: { owner: "acme", repo: "demo" },
      },
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain('href="../docs/guide.md"');
  });

  it("should surface GitHub repo and tool home URLs in the toolbar chrome", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      githubRepoUrl: "https://github.com/example/repo",
      toolHomeUrl: "https://github.com/d-led/commentray",
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain('aria-label="View repository on GitHub"');
    expect(html).toContain('href="https://github.com/example/repo"');
    expect(html).toContain("Rendered with");
  });
});
