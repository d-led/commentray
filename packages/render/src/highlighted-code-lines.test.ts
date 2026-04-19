import { describe, expect, it } from "vitest";

import { renderHighlightedCodeLineRows } from "./highlighted-code-lines.js";

describe("highlighted code line rows", () => {
  it("should keep one row per source line when the file ends with a newline", async () => {
    const html = await renderHighlightedCodeLineRows("a\n", "txt", { omitLineStackWrapper: true });
    expect(html.match(/class="code-line"/g)?.length).toBe(2);
    expect(html).toContain('id="code-line-0"');
    expect(html).toContain('id="code-line-1"');
  });
});
