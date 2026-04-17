import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
