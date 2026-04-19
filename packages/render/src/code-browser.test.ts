import { Buffer } from "node:buffer";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { describe, expect, it } from "vitest";

import { renderCodeBrowserHtml } from "./code-browser.js";

describe("Code browser page — layout shell and search", () => {
  it("should attach raw code and Markdown payloads to #shell for the client bundle", async () => {
    const html = await renderCodeBrowserHtml({
      code: "x",
      language: "txt",
      commentrayMarkdown: "body",
    });
    const m = /<div class="shell" id="shell"[^>]*>/.exec(html);
    expect(m).not.toBeNull();
    if (m === null) {
      throw new Error("expected shell opening tag");
    }
    expect(m[0]).toContain("data-raw-code-b64=");
    expect(m[0]).toContain("data-raw-md-b64=");
    expect(m[0]).not.toContain("data-search-scope=");
  });

  it("should narrow search to commentray paths when staticSearchScope requests it", async () => {
    const html = await renderCodeBrowserHtml({
      code: "const secret = 1;",
      language: "ts",
      commentrayMarkdown: "## Notes\n",
      filePath: "src/a.ts",
      commentrayPathForSearch: ".commentray/source/src/a.ts.md",
      staticSearchScope: "commentray-and-paths",
    });
    expect(html).toContain('data-search-scope="commentray-and-paths"');
    expect(html).toContain('data-search-file-path="src/a.ts"');
    expect(html).toContain('data-search-commentray-path=".commentray/source/src/a.ts.md"');
    expect(html).toContain("nav-rail__search-hint");
    expect(html).toContain("commentray-nav-search.json");
  });

  it("should ship gutter, wrap toggle, search field, highlighted source, and rendered Markdown", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "const x = 1;",
      language: "ts",
      commentrayMarkdown: "## Notes\n\nHello.",
    });
    expect(html).toContain('id="gutter"');
    expect(html).toContain('id="wrap-lines"');
    expect(html).toContain('id="search-q"');
    expect(html).toContain("nav-rail__search-hint");
    expect(html).toContain('id="code-line-0"');
    expect(html).toContain("Wrap code lines");
    expect(html).toMatch(/hljs|language-ts/);
    expect(html).toContain("Notes");
  });

  it("should include a generator meta tag when a generator label is provided", async () => {
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
});

describe("Code browser page — toolbar chrome", () => {
  it("should show optional related GitHub file links when configured", async () => {
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

  it("should expose GitHub blob links and the documented-files hub with nav JSON hooks", async () => {
    const pairsB64 = Buffer.from(
      JSON.stringify([
        {
          sourcePath: "README.md",
          commentrayPath: ".commentray/source/README.md.md",
          sourceOnGithub: "https://github.com/acme/demo/blob/main/README.md",
          commentrayOnGithub:
            "https://github.com/acme/demo/blob/main/.commentray/source/README.md.md",
        },
      ]),
      "utf8",
    ).toString("base64");
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      filePath: "README.md",
      sourceOnGithubUrl: "https://github.com/acme/demo/blob/main/README.md",
      commentrayOnGithubUrl:
        "https://github.com/acme/demo/blob/main/.commentray/source/README.md.md",
      documentedNavJsonUrl: "./commentray-nav-search.json",
      documentedPairsEmbeddedB64: pairsB64,
    });
    expect(html).toContain('id="toolbar-source-github"');
    expect(html).toContain('id="toolbar-commentray-github"');
    expect(html).toContain('class="nav-rail__pair-gh"');
    expect(html).toContain('href="https://github.com/acme/demo/blob/main/README.md"');
    expect(html).toContain('id="documented-files-hub"');
    expect(html).toContain('data-nav-json-url="./commentray-nav-search.json"');
    expect(html).toContain('data-nav-search-json-url="./commentray-nav-search.json"');
    expect(html).toContain('data-documented-pairs-b64="');
  });

  it("should hydrate the documented-files tree from embedded pairs alone", async () => {
    const pairsB64 = Buffer.from(
      JSON.stringify([
        {
          sourcePath: "src/a.ts",
          commentrayPath: ".commentray/source/src/a.ts.md",
          sourceOnGithub: "https://github.com/acme/w/blob/main/src/a.ts",
          commentrayOnGithub: "https://github.com/acme/w/blob/main/.commentray/source/src/a.ts.md",
        },
      ]),
      "utf8",
    ).toString("base64");
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      documentedPairsEmbeddedB64: pairsB64,
    });
    expect(html).toContain('id="documented-files-hub"');
    expect(html).toContain('data-nav-json-url=""');
    expect(html).toContain('data-documented-pairs-b64="');
  });
});

describe("Code browser page — source line chrome", () => {
  it("should print one-based, non-selectable line numbers for every source line", async () => {
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

  it("should wrap highlighted rows in a stack whose gutter width matches the highest line number", async () => {
    const code = Array.from({ length: 100 }, (_, i) => `// ${i}`).join("\n");
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code,
      language: "ts",
      commentrayMarkdown: "body",
    });
    expect(html).toContain('class="code-line-stack"');
    expect(html).toContain("--code-ln-min-ch:3");
  });
});

describe("Code browser page — file path display", () => {
  it("should show the repo-relative source path in the nav rail context", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "packages/render/src/code-browser.ts",
      code: "export {};",
      language: "ts",
      commentrayMarkdown: "body",
    });
    expect(html).toContain("nav-rail__context");
    expect(html).toContain("packages/render/src/code-browser.ts");
  });

  it("should fall back to basename-only labelling when paths are shallow", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "README.md",
      code: "# hi\n",
      language: "md",
      commentrayMarkdown: "body",
    });
    expect(html).toContain("nav-rail__pair-path");
    expect(html).toContain("README.md");
  });

  it("should escape file path labels so angle brackets cannot inject markup", async () => {
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

describe("Code browser page — toolbar link policy", () => {
  it("should emit Octocat and Commentray links only for safe http(s) URLs", async () => {
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
    expect(html).toMatch(/toolbar-attribution__version[^>]*>v\d+\.\d+\.\d+/);
  });

  it("should include a footer with ISO and local wall-clock text for HTML generation", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      builtAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    expect(html).toContain('class="app__footer"');
    expect(html).toContain("HTML generated");
    expect(html).toContain('datetime="2026-05-01T12:00:00.000Z"');
  });

  it("should omit executable toolbar links when URLs are not http(s)", async () => {
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

describe("Code browser page — companion Markdown rendering", () => {
  it("should render headings, emphasis, and links without corrupting fenced code", async () => {
    const md = [
      "# Title",
      "",
      "Paragraph with **bold** and [link](https://example.com).",
      "",
      "```js",
      "const fenced = 1",
      "```",
    ].join("\n");
    const html = await renderCodeBrowserHtml({
      code: "x",
      language: "txt",
      commentrayMarkdown: md,
    });
    expect(html).toMatch(/<h1[^>]*>\s*Title/);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('id="commentray-md-line-0"');
    expect(html).not.toContain("const fenced = 1<span ");
  });
});

describe("Code browser page — block markers and scroll sync payload", () => {
  it("should insert block separator anchors after each commentray:block marker", async () => {
    const html = await renderCodeBrowserHtml({
      code: "x",
      language: "txt",
      commentrayMarkdown: "<!-- commentray:block id=myblock -->\n\n## Title\n",
    });
    expect(html).toContain('class="commentray-block-anchor"');
    expect(html).toContain('id="commentray-block-myblock"');
  });

  it("should embed base64 block scroll links on #shell when dual panes align with the index", async () => {
    const crPath = ".commentray/source/pkg/x.txt.md";
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [crPath]: {
          sourcePath: "pkg/x.txt",
          commentrayPath: crPath,
          blocks: [{ id: "b1", anchor: "lines:1-2" }],
        },
      },
    };
    const md = "<!-- commentray:block id=b1 -->\n\n## Hi\n";
    const html = await renderCodeBrowserHtml({
      code: "a\nb",
      language: "txt",
      commentrayMarkdown: md,
      codeBrowserLayout: "dual",
      blockStretchRows: {
        index,
        sourceRelative: "pkg/x.txt",
        commentrayPathRel: crPath,
      },
    });
    expect(html).toContain('data-commentray-line="0"');
    expect(html).toContain('data-source-start="1"');
    const m = /data-scroll-block-links-b64="([^"]*)"/.exec(html);
    expect(m).not.toBeNull();
    if (m === null || m[1] === undefined) {
      throw new Error("expected data-scroll-block-links-b64 attribute with a value");
    }
    const links = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")) as unknown[];
    expect(links).toEqual([{ id: "b1", commentrayLine: 0, sourceStart: 1, sourceEnd: 2 }]);
  });

  it("should choose stretch layout with one shared scroll when the block table can be built", async () => {
    const crPath = ".commentray/source/pkg/readme.md.md";
    const index = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      byCommentrayPath: {
        [crPath]: {
          sourcePath: "pkg/readme.md",
          commentrayPath: crPath,
          blocks: [{ id: "b1", anchor: "lines:1-2" }],
        },
      },
    };
    const md = "<!-- commentray:block id=b1 -->\n\n## Sync\n";
    const html = await renderCodeBrowserHtml({
      code: "one\ntwo",
      language: "txt",
      commentrayMarkdown: md,
      blockStretchRows: {
        index,
        sourceRelative: "pkg/readme.md",
        commentrayPathRel: crPath,
      },
    });
    expect(html).toContain('data-layout="stretch"');
    expect(html).toContain('class="stretch-code-stack"');
    expect(html).not.toContain("rowspan");
    expect(html).not.toContain('id="doc-pane"');
  });
});
