import { describe, expect, it } from "vitest";

import { renderCommentrayPreviewHtml } from "./commentray-preview-html.js";

describe("renderCommentrayPreviewHtml", () => {
  it("should inject per-line anchors for scroll-sync with rendered companion Markdown", async () => {
    const html = await renderCommentrayPreviewHtml({
      markdown: "# Hi\n\nLine two",
    });
    expect(html).toContain('id="commentray-md-line-0"');
    expect(html).toContain('id="commentray-md-line-2"');
  });

  it("should use the same GFM pipeline as static rendering (strikethrough)", async () => {
    const html = await renderCommentrayPreviewHtml({
      markdown: "~~gone~~",
    });
    expect(html.toLowerCase()).toMatch(/<del|<s[>\s]/);
  });
});
