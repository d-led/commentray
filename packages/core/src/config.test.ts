import { describe, expect, it } from "vitest";
import { mergeCommentaryConfig } from "./config.js";

describe("mergeCommentaryConfig", () => {
  it("applies defaults for empty input", () => {
    const cfg = mergeCommentaryConfig(null);
    expect(cfg.storageDir).toBe(".commentary");
    expect(cfg.scmProvider).toBe("git");
    expect(cfg.render.mermaid).toBe(true);
  });

  it("rejects unsupported scm providers", () => {
    expect(() => mergeCommentaryConfig({ scm: { provider: "p4" } })).toThrow(/Unsupported/);
  });

  it("merges static_site from TOML", () => {
    const cfg = mergeCommentaryConfig({
      static_site: {
        title: "Docs",
        intro: "## Hello",
        github_url: "https://github.com/a/b",
        source_file: "src/index.ts",
        commentary_markdown: "docs/x.md",
      },
    });
    expect(cfg.staticSite.title).toBe("Docs");
    expect(cfg.staticSite.introMarkdown).toBe("## Hello");
    expect(cfg.staticSite.githubUrl).toBe("https://github.com/a/b");
    expect(cfg.staticSite.sourceFile).toBe("src/index.ts");
    expect(cfg.staticSite.commentaryMarkdownFile).toBe("docs/x.md");
  });
});
