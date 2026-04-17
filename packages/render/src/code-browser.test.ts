import { describe, expect, it } from "vitest";
import { renderCodeBrowserHtml } from "./code-browser.js";

describe("renderCodeBrowserHtml", () => {
  it("includes resizable gutter, wrap toggle, and rendered regions", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "const x = 1;",
      language: "ts",
      commentrayMarkdown: "## Notes\n\nHello.",
    });
    expect(html).toContain('id="gutter"');
    expect(html).toContain('id="wrap-lines"');
    expect(html).toContain('id="search-q"');
    expect(html).toContain("Whole source (ordered tokens + fuzzy lines)");
    expect(html).toContain('id="code-line-0"');
    expect(html).toContain("Wrap code lines");
    expect(html).toMatch(/hljs|language-ts/);
    expect(html).toContain("Notes");
  });

  it("renders a 1-based, non-selectable line number for every source line", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "one\ntwo\nthree",
      language: "txt",
      commentrayMarkdown: "body",
    });
    expect(html).toContain('<span class="ln" aria-hidden="true">1</span>');
    expect(html).toContain('<span class="ln" aria-hidden="true">2</span>');
    expect(html).toContain('<span class="ln" aria-hidden="true">3</span>');
    expect(html).toMatch(/\.code-line \.ln[\s\S]*?user-select: none/);
  });

  it("shows the repo-relative file path in the toolbar with the basename emphasized", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "packages/render/src/code-browser.ts",
      code: "export {};",
      language: "ts",
      commentrayMarkdown: "body",
    });
    expect(html).toContain('<span class="file-path__dir">packages/render/src/</span>');
    expect(html).toContain('<span class="file-path__base">code-browser.ts</span>');
    expect(html).toContain('title="packages/render/src/code-browser.ts"');
  });

  it("treats a basename-only path as living at the repository root", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "README.md",
      code: "# hi\n",
      language: "md",
      commentrayMarkdown: "body",
    });
    expect(html).toContain("file-path__dir--root");
    expect(html).toContain('<span class="file-path__base">README.md</span>');
  });

  it("escapes HTML in file paths to prevent injection", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "<script>x</script>/evil.ts",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
    });
    expect(html).not.toContain("<script>x</script>/evil.ts");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;/");
  });
});
