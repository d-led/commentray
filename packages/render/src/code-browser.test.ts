import { Buffer } from "node:buffer";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { describe, expect, it } from "vitest";

import { renderCodeBrowserHtml } from "./code-browser.js";

describe("renderCodeBrowserHtml — layout shell and search", () => {
  it("puts search payload base64 on #shell so the client can read it (not only on #code-pane)", async () => {
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

  it("emits scoped search attributes when staticSearchScope is commentray-and-paths", async () => {
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
    expect(html).toContain("nav-rail__search-hint");
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
});

describe("renderCodeBrowserHtml — toolbar chrome in layout", () => {
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

  it("renders optional GitHub blob links, documented-files toggle, and panel", async () => {
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
    expect(html).toContain('class="toolbar-doc-hub"');
    expect(html).toContain("Source on GitHub");
    expect(html).toContain("Commentray on GitHub");
    expect(html).toContain('href="https://github.com/acme/demo/blob/main/README.md"');
    expect(html).toContain('id="documented-files-hub"');
    expect(html).toContain('data-nav-json-url="./commentray-nav-search.json"');
    expect(html).toContain('data-nav-search-json-url="./commentray-nav-search.json"');
    expect(html).toContain('data-documented-pairs-b64="');
  });

  it("shows the documented-files tree when only embedded pairs are set (no nav JSON URL)", async () => {
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

describe("renderCodeBrowserHtml — source line chrome", () => {
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
  it("shows the repo-relative source path in the left nav rail context", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "packages/render/src/code-browser.ts",
      code: "export {};",
      language: "ts",
      commentrayMarkdown: "body",
    });
    expect(html).toContain("nav-rail__context");
    expect(html).toContain("packages/render/src/code-browser.ts");
  });

  it("shows a basename-only path in the nav rail context block", async () => {
    const html = await renderCodeBrowserHtml({
      filePath: "README.md",
      code: "# hi\n",
      language: "md",
      commentrayMarkdown: "body",
    });
    expect(html).toContain("nav-rail__context-path");
    expect(html).toContain("README.md");
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

describe("renderCodeBrowserHtml — block markers and scroll link payload", () => {
  it("injects separator anchors after each commentray:block marker line", async () => {
    const html = await renderCodeBrowserHtml({
      code: "x",
      language: "txt",
      commentrayMarkdown: "<!-- commentray:block id=myblock -->\n\n## Title\n",
    });
    expect(html).toContain('class="commentray-block-anchor"');
    expect(html).toContain('id="commentray-block-myblock"');
  });

  it("embeds base64 block scroll links on the shell when dual layout aligns with the index", async () => {
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

  it("uses stretch layout for one shared scroll when the blame-style table builds", async () => {
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
