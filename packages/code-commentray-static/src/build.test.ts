import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildCommentrayStatic } from "./build.js";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("buildCommentrayStatic", () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("writes HTML that includes code and commentray", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      title: "Test",
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain("greet");
    expect(html).toContain("Resizable divider");
    expect(html).toContain('<meta name="generator" content="Commentray @commentray/render@');
    expect(html).toContain("code-commentray-static@");
  });

  it("omits generator meta when generatorLabel is an empty string", async () => {
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

  it("surfaces the repo-relative file path in the toolbar when provided", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      filePath: "packages/code-commentray-static/fixtures/sample.ts",
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain('<span class="file-path__base">sample.ts</span>');
    expect(html).toContain(
      '<span class="file-path__dir">packages/code-commentray-static/fixtures/</span>',
    );
  });

  it("falls back to the source basename when no filePath is given", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccrs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCommentrayStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain("file-path__dir--root");
    expect(html).toContain('<span class="file-path__base">sample.ts</span>');
  });

  it("forwards commentrayOutputUrls into rendered commentray links", async () => {
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

  it("forwards GitHub + tool URLs into the rendered toolbar chrome", async () => {
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
    expect(html).toContain('class="toolbar-github"');
    expect(html).toContain('href="https://github.com/example/repo"');
    expect(html).toContain('class="toolbar-attribution"');
  });
});
