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
});
