import { describe, expect, it } from "vitest";
import { mergeCommentrayConfig } from "./config.js";

describe("mergeCommentrayConfig", () => {
  it("applies defaults for empty input", () => {
    const cfg = mergeCommentrayConfig(null);
    expect(cfg.storageDir).toBe(".commentray");
    expect(cfg.scmProvider).toBe("git");
    expect(cfg.render.mermaid).toBe(true);
  });

  it("rejects unsupported scm providers", () => {
    expect(() => mergeCommentrayConfig({ scm: { provider: "p4" } })).toThrow(/Unsupported/);
  });

  it("merges static_site from TOML", () => {
    const cfg = mergeCommentrayConfig({
      static_site: {
        title: "Docs",
        intro: "## Hello",
        github_url: "https://github.com/a/b",
        source_file: "src/index.ts",
        commentray_markdown: "docs/x.md",
      },
    });
    expect(cfg.staticSite.title).toBe("Docs");
    expect(cfg.staticSite.introMarkdown).toBe("## Hello");
    expect(cfg.staticSite.githubUrl).toBe("https://github.com/a/b");
    expect(cfg.staticSite.sourceFile).toBe("src/index.ts");
    expect(cfg.staticSite.commentrayMarkdownFile).toBe("docs/x.md");
  });

  it("accepts deprecated commentary_markdown key", () => {
    const cfg = mergeCommentrayConfig({
      static_site: { commentary_markdown: "legacy.md" },
    });
    expect(cfg.staticSite.commentrayMarkdownFile).toBe("legacy.md");
  });

  it("rejects a storage.dir that escapes the repository root", () => {
    expect(() => mergeCommentrayConfig({ storage: { dir: "../evil" } })).toThrow(
      /storage\.dir.*repository-relative/,
    );
  });

  it("rejects static_site paths that escape the repository root", () => {
    expect(() =>
      mergeCommentrayConfig({ static_site: { source_file: "../../../etc/passwd" } }),
    ).toThrow(/static_site\.source_file/);
    expect(() =>
      mergeCommentrayConfig({ static_site: { commentray_markdown: "../outside.md" } }),
    ).toThrow(/static_site\.commentray_markdown/);
  });

  describe("storage.dir must not live inside .git/", () => {
    it("rejects exactly .git", () => {
      expect(() => mergeCommentrayConfig({ storage: { dir: ".git" } })).toThrow(
        /storage\.dir must not live inside \.git\//,
      );
    });

    it("rejects nested paths under .git", () => {
      expect(() => mergeCommentrayConfig({ storage: { dir: ".git/commentray" } })).toThrow(
        /storage\.dir must not live inside \.git\//,
      );
    });

    it("rejects Windows-style separators under .git", () => {
      expect(() => mergeCommentrayConfig({ storage: { dir: ".git\\state" } })).toThrow(
        /storage\.dir must not live inside \.git\//,
      );
    });

    it("rejects case variants (fs may be case-insensitive)", () => {
      expect(() => mergeCommentrayConfig({ storage: { dir: ".GIT/foo" } })).toThrow(
        /storage\.dir must not live inside \.git\//,
      );
    });

    it("accepts sibling names that merely share a prefix", () => {
      expect(() => mergeCommentrayConfig({ storage: { dir: ".gitignore" } })).not.toThrow();
      expect(() => mergeCommentrayConfig({ storage: { dir: ".git-backup" } })).not.toThrow();
    });

    it("accepts the default .commentray dir", () => {
      expect(() => mergeCommentrayConfig({ storage: { dir: ".commentray" } })).not.toThrow();
    });
  });
});
