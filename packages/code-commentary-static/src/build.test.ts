import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildCodeCommentaryStatic } from "./build.js";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("buildCodeCommentaryStatic", () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("writes HTML that includes code and commentary", async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "ccs-"));
    const outHtml = path.join(outDir, "index.html");
    await buildCodeCommentaryStatic({
      sourceFile: path.join(pkgRoot, "fixtures", "sample.ts"),
      markdownFile: path.join(pkgRoot, "fixtures", "sample.md"),
      outHtml,
      title: "Test",
    });
    const html = await readFile(outHtml, "utf8");
    expect(html).toContain("greet");
    expect(html).toContain("Resizable divider");
  });
});
