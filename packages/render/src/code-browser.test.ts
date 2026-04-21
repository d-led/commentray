import { Buffer } from "node:buffer";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { describe, expect, it } from "vitest";

import { COMMENTRAY_COLOR_THEME_STORAGE_KEY } from "./code-browser-color-theme.js";
import { renderCodeBrowserHtml } from "./code-browser.js";

function textContentWithoutTags(html: string): string {
  let cur = html;
  for (;;) {
    const next = cur.replaceAll(/<[^>]+>/g, "");
    if (next === cur) return cur;
    cur = next;
  }
}

/** First `role="banner"` header — where primary chrome (search, wrap, theme) lives. */
function bannerRegionHtml(html: string): string {
  const m = /<header[^>]*role="banner"[^>]*>[\s\S]*?<\/header>/i.exec(html);
  return m?.[0] ?? "";
}

describe("Code browser page — layout shell and search", () => {
  it("should embed raw payloads on the shell element for the client bundle", async () => {
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
    expect(html).toContain('placeholder="Filename, path, or keywords…"');
    expect(html).toContain("commentray-nav-search.json");
    expect(html).toContain('data-search-scope="commentray-and-paths"');
    expect(html).toContain('data-search-file-path="src/a.ts"');
    expect(html).toContain('data-search-commentray-path=".commentray/source/src/a.ts.md"');
  });

  it("should expose appearance controls and a head script so the first paint matches saved theme", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "y",
    });
    const banner = bannerRegionHtml(html);
    expect(banner).toMatch(/aria-haspopup="menu"/);
    expect(banner).toMatch(/role="menu"/);
    expect(banner).toMatch(/role="menuitemradio"[^>]*>System</);
    expect(banner).toMatch(/role="menuitemradio"[^>]*>Light</);
    expect(banner).toMatch(/role="menuitemradio"[^>]*>Dark</);
    expect(html).toMatch(/<html[^>]*data-commentray-theme="system"/i);
    expect(html).toContain(COMMENTRAY_COLOR_THEME_STORAGE_KEY);
  });
});

describe("Code browser page — document shell and chrome", () => {
  it("should link github for light and the configured dark theme for dark when syntax theme is github-dark", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "const x = 1;",
      language: "ts",
      commentrayMarkdown: "## Notes\n",
      hljsTheme: "github-dark",
    });
    expect(html).toMatch(/github\.min\.css" media="\(prefers-color-scheme: light\)"/);
    expect(html).toMatch(/github-dark\.min\.css" media="\(prefers-color-scheme: dark\)"/);
  });

  it("given a TypeScript source and Markdown pair, should publish a navigable reading shell with search, split panes, wrap, and theme", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "const x = 1;",
      language: "ts",
      commentrayMarkdown: "## Notes\n\nHello.",
    });
    const banner = bannerRegionHtml(html);
    const plain = textContentWithoutTags(html);

    expect(banner).toContain('aria-label="View options"');
    expect(banner).toMatch(/<h1[^>]*>\s*Demo\s*</i);
    expect(banner).toMatch(/aria-haspopup="menu"/);

    expect(html).toContain('aria-label="Resize panes"');
    expect(html).toContain('role="region" aria-label="Search"');
    expect(html).toContain('for="search-q"');
    expect(banner).toContain("Wrap code lines");

    expect(plain).toContain("const x = 1;");
    expect(plain).toContain("Notes");
    expect(html).toMatch(/hljs|language-ts/);

    expect(html).toMatch(
      /<meta\s+name="description"\s+content="Demo — Side-by-side source and commentray documentation."\s*\/>/,
    );
    expect(html).toMatch(/<main\b[^>]*id="main-content"/);
    expect(html).toMatch(/<a[^>]+href="#main-content"[^>]*>\s*Skip to main content\s*</i);
  });

  it("should use a custom meta description when provided", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      metaDescription: "Custom summary for listings.",
    });
    expect(html).toContain('<meta name="description" content="Custom summary for listings." />');
  });

  it("should render commentray inline markdown after block markers (anchors must not break mdast)", async () => {
    const md =
      "# Title\n\n<!-- commentray:block id=blk -->\n\n_Italic lede_ and **bold** after the marker.\n";
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "//",
      language: "ts",
      commentrayMarkdown: md,
    });
    expect(html).toContain("<em>Italic lede</em>");
    expect(html).toContain("<strong>bold</strong>");
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
    expect(html).toContain('aria-label="Open other repository files on GitHub"');
    expect(html).toContain("Also on GitHub");
    expect(html).toContain('href="https://github.com/acme/demo/blob/main/CONTRIBUTING.md"');
  });

  it("should expose GitHub blob links and the Comment-rayed files hub with nav JSON hooks", async () => {
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
    expect(html).toContain('aria-label="Current documentation pair"');
    expect(html).toContain("README.md");
    expect(html).toContain(".commentray/source/README.md.md");
    expect(html).toContain(
      'data-commentray-pair-browse-href="https://github.com/acme/demo/blob/main/.commentray/source/README.md.md"',
    );
    expect(html).toContain("Comment-rayed files");
    expect(html).toContain('placeholder="Filename, path, or keywords…"');
    expect(html).toContain('placeholder="Filter by path…"');
    expect(html).toContain('role="tree"');
    expect(html).toContain('data-nav-json-url="./commentray-nav-search.json"');
    expect(html).toContain('data-nav-search-json-url="./commentray-nav-search.json"');
    expect(html).toContain('data-documented-pairs-b64="');
  });

  it("should hydrate the Comment-rayed files tree from embedded pairs alone", async () => {
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
    expect(html).toContain("Comment-rayed files");
    expect(html).toContain('placeholder="Filter by path…"');
    expect(html).toContain('data-nav-json-url=""');
    expect(html).toContain('data-documented-pairs-b64="');
  });
});

describe("Code browser page — source line chrome", () => {
  it("should print one-based line numbers beside each source line (non-selectable gutter)", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "one\ntwo\nthree",
      language: "txt",
      commentrayMarkdown: "body",
    });
    expect(html).toContain(">1</span>");
    expect(html).toContain(">2</span>");
    expect(html).toContain(">3</span>");
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
    expect(html).toMatch(/>100<\/span>/);
    expect(html).toMatch(/--code-ln-min-ch:\s*3/);
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
    expect(html).toContain('aria-label="Current documentation pair"');
    expect(html).toContain("packages/render/src/code-browser.ts");
  });

  it("should fall back to basename-only labelling when paths are shallow", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "README.md",
      code: "# hi\n",
      language: "md",
      commentrayMarkdown: "body",
    });
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
    expect(html).toContain('aria-label="View repository on GitHub"');
    expect(html).toContain('href="https://github.com/example/demo"');
    expect(html).toContain('href="https://github.com/d-led/commentray"');
    expect(html).toMatch(/<footer[\s\S]*Rendered with[\s\S]*v\d+\.\d+\.\d+[\s\S]*<\/footer>/);
  });

  it("should prefer same-site documentation home over GitHub when siteHubUrl is set", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      siteHubUrl: "./",
      githubRepoUrl: "https://github.com/example/demo",
      toolHomeUrl: "https://github.com/d-led/commentray",
    });
    expect(html).toContain('aria-label="Documentation home"');
    expect(html).toContain('href="./"');
    expect(html).not.toContain('aria-label="View repository on GitHub"');
    expect(html).toContain('href="https://github.com/d-led/commentray"');
  });

  it("should include a footer with ISO and local wall-clock when no tool home URL is set", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      builtAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    expect(html).toContain("HTML generated");
    expect(html).toContain('datetime="2026-05-01T12:00:00.000Z"');
  });

  it("should put Commentray attribution in the footer with version and the same build timestamp", async () => {
    const html = await renderCodeBrowserHtml({
      title: "Demo",
      code: "x",
      language: "ts",
      commentrayMarkdown: "body",
      toolHomeUrl: "https://github.com/d-led/commentray",
      builtAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    expect(html).toMatch(/<footer[\s\S]*Rendered with[\s\S]*v\d+\.\d+\.\d+<\/span>\s*:\s*<time/);
    expect(html).toContain('datetime="2026-05-01T12:00:00.000Z"');
    expect(html).not.toContain("HTML generated");
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
    expect(html).not.toContain('aria-label="View repository on GitHub"');
    expect(html).not.toContain("Rendered with");
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

describe("Code browser page — multi-angle browsing", () => {
  it("should emit an angle selector and a base64 multi-angle payload when two angles are configured", async () => {
    const html = await renderCodeBrowserHtml({
      code: "// x",
      language: "ts",
      commentrayMarkdown: "## Default pane\n",
      multiAngleBrowsing: {
        defaultAngleId: "main",
        angles: [
          {
            id: "main",
            title: "Main",
            markdown: "## Main angle\n\nBody **one**.",
            commentrayPathRel: ".commentray/source/README.md/main.md",
            commentrayOnGithubUrl:
              "https://github.com/acme/r/blob/main/.commentray/source/README.md/main.md",
          },
          {
            id: "architecture",
            title: "Architecture",
            markdown: "## Architecture angle\n\nBody **two**.",
            commentrayPathRel: ".commentray/source/README.md/architecture.md",
            commentrayOnGithubUrl:
              "https://github.com/acme/r/blob/main/.commentray/source/README.md/architecture.md",
          },
        ],
      },
    });
    expect(html).toContain('aria-label="Commentray angle"');
    expect(html).toContain('value="main"');
    expect(html).toContain('value="architecture"');
    expect(html).toContain('id="commentray-multi-angle-b64"');
    expect(html).toContain("Main angle");
    expect(html).toContain("<strong>one</strong>");
  });
});

describe("Code browser page — block markers and scroll sync payload", () => {
  it("should insert block separator anchors after each commentray:block marker", async () => {
    const html = await renderCodeBrowserHtml({
      code: "x",
      language: "txt",
      commentrayMarkdown: "<!-- commentray:block id=myblock -->\n\n## Title\n",
    });
    expect(html).toContain("<h2");
    expect(html).toContain("Title");
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
    expect(html).toContain("Sync");
    expect(html).not.toContain('id="doc-pane"');
  });
});
