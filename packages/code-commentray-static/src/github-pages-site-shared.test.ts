import { afterEach, describe, expect, it } from "vitest";

import { composeCommentrayMarkdown, emptyCommentrayMarkdown } from "./github-pages-site-shared.js";

const EMPTY_STATE_MARKDOWN_ENV = "COMMENTRAY_EMPTY_STATE_MARKDOWN";

afterEach(() => {
  process.env[EMPTY_STATE_MARKDOWN_ENV] = undefined;
});

describe("empty commentray markdown fallback", () => {
  it("returns the default message when no serve CTA is configured", () => {
    expect(emptyCommentrayMarkdown()).toBe("_No commentray content configured._\n");
  });

  it("appends serve CTA markdown when COMMENTRAY_EMPTY_STATE_MARKDOWN is set", () => {
    process.env[EMPTY_STATE_MARKDOWN_ENV] =
      "- [Initialize](http://127.0.0.1:4173/__commentray/serve/init)";
    expect(emptyCommentrayMarkdown()).toContain("No commentray content configured");
    expect(emptyCommentrayMarkdown()).toContain("/__commentray/serve/init");
  });

  it("composeCommentrayMarkdown uses the same fallback for empty intro + file markdown", () => {
    process.env[EMPTY_STATE_MARKDOWN_ENV] =
      "- [Generate](http://127.0.0.1:4173/__commentray/serve/generate-entry)";
    expect(composeCommentrayMarkdown("", "")).toContain("/__commentray/serve/generate-entry");
  });
});
