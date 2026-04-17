import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./markdown-pipeline.js";
import { renderSideBySideHtml } from "./side-by-side.js";

describe("renderMarkdownToHtml", () => {
  it("renders basic markdown", async () => {
    const html = await renderMarkdownToHtml("# Title\n\nHello **world**.");
    expect(html).toContain("<h1");
    expect(html).toContain("world");
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
});
