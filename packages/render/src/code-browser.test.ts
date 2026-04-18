import { describe, expect, it } from "vitest";
import { renderCodeBrowserHtml } from "./code-browser.js";

describe("renderCodeBrowserHtml — layout and regions", () => {
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

  it("includes a generator meta tag when generatorLabel is set", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      generatorLabel: "Commentray @commentray/render@9.9.9-test",
    });
    expect(html).toContain(
      '<meta name="generator" content="Commentray @commentray/render@9.9.9-test" />',
    );
  });

  it("renders optional related GitHub file links in the toolbar", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      relatedGithubNav: [
        { label: "CONTRIBUTING", href: "https://github.com/acme/demo/blob/main/CONTRIBUTING.md" },
      ],
    });
    expect(html).toContain('class="toolbar-related"');
    expect(html).toContain("Also on GitHub");
    expect(html).toContain('href="https://github.com/acme/demo/blob/main/CONTRIBUTING.md"');
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
});

describe("renderCodeBrowserHtml — file path display", () => {
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

describe("renderCodeBrowserHtml — toolbar link policy", () => {
  it("adds an Octocat toolbar link and Commentray attribution for safe http(s) URLs", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      githubRepoUrl: "https://github.com/example/demo",
      toolHomeUrl: "https://github.com/d-led/commentray",
    });
    expect(html).toContain('class="toolbar-github"');
    expect(html).toContain('href="https://github.com/example/demo"');
    expect(html).toContain('class="toolbar-attribution"');
    expect(html).toContain('href="https://github.com/d-led/commentray"');
    expect(html).toContain("Rendered with");
  });

  it("does not emit toolbar links for javascript: or other non-http(s) URLs", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      githubRepoUrl: "javascript:alert(1)",
      toolHomeUrl: "data:text/html,hi",
    });
    // CSS still defines `.toolbar-github` / `.toolbar-attribution`; assert markup only.
    expect(html).not.toContain('<a class="toolbar-github"');
    expect(html).not.toContain('<span class="toolbar-attribution"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="data:');
  });
});
