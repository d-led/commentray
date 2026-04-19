import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildGithubPagesStaticSite } from "./github-pages-site.js";

describe("GitHub Pages static site output", () => {
  let repo: string;

  afterEach(async () => {
    if (repo) await rm(repo, { recursive: true, force: true });
  });

  it("writes _site/index.html and nav search from [static_site] flat companions", async () => {
    repo = await mkdtemp(path.join(tmpdir(), "cr-pages-"));
    await writeFile(
      path.join(repo, ".commentray.toml"),
      [
        "[static_site]",
        'title = "Demo"',
        'source_file = "src/x.ts"',
        'commentray_markdown = ".commentray/source/src/x.ts.md"',
        'github_url = "https://github.com/acme/demo"',
        "",
        "[render]",
        "mermaid = false",
        "",
      ].join("\n"),
      "utf8",
    );
    await mkdir(path.join(repo, "src"), { recursive: true });
    await writeFile(path.join(repo, "src", "x.ts"), "export const x = 1;\n", "utf8");
    await mkdir(path.join(repo, ".commentray", "source", "src"), { recursive: true });
    await writeFile(path.join(repo, ".commentray", "source", "src", "x.ts.md"), "# Doc\n", "utf8");

    const { outHtml, navSearchPath } = await buildGithubPagesStaticSite({ repoRoot: repo });

    const html = await readFile(outHtml, "utf8");
    expect(html).toMatch(/hljs language-ts/);
    expect(html).toContain("x =");
    expect(html).toContain("Doc");
    const nav = JSON.parse(await readFile(navSearchPath, "utf8")) as {
      rows?: unknown[];
      documentedPairs?: { staticBrowseUrl?: string }[];
    };
    expect(Array.isArray(nav.rows)).toBe(true);
    expect(nav.documentedPairs?.[0]?.staticBrowseUrl).toMatch(/^\.\/browse\/.+\.html$/);
    const browseFiles = await readdir(path.join(repo, "_site", "browse"));
    expect(browseFiles.some((f) => f.endsWith(".html"))).toBe(true);
  });

  it("writes browse pages and hub nav without static_site.github_url (same-site navigation only)", async () => {
    repo = await mkdtemp(path.join(tmpdir(), "cr-pages-"));
    await writeFile(
      path.join(repo, ".commentray.toml"),
      [
        "[static_site]",
        'title = "Local"',
        'source_file = "src/x.ts"',
        'commentray_markdown = ".commentray/source/src/x.ts.md"',
        "",
        "[render]",
        "mermaid = false",
        "",
      ].join("\n"),
      "utf8",
    );
    await mkdir(path.join(repo, "src"), { recursive: true });
    await writeFile(path.join(repo, "src", "x.ts"), "export const x = 1;\n", "utf8");
    await mkdir(path.join(repo, ".commentray", "source", "src"), { recursive: true });
    await writeFile(path.join(repo, ".commentray", "source", "src", "x.ts.md"), "# Doc\n", "utf8");

    const { outHtml, navSearchPath } = await buildGithubPagesStaticSite({ repoRoot: repo });

    const html = await readFile(outHtml, "utf8");
    expect(html).not.toMatch(/aria-label="Source file on GitHub"/);
    expect(html).toContain('data-nav-search-json-url="./commentray-nav-search.json"');
    const nav = JSON.parse(await readFile(navSearchPath, "utf8")) as {
      documentedPairs?: { staticBrowseUrl?: string; sourceOnGithub?: string }[];
    };
    expect(nav.documentedPairs?.[0]?.staticBrowseUrl).toMatch(/^\.\/browse\/.+\.html$/);
    expect(nav.documentedPairs?.[0]?.sourceOnGithub).toBeUndefined();
    const browseFiles = await readdir(path.join(repo, "_site", "browse"));
    expect(browseFiles.some((f) => f.endsWith(".html"))).toBe(true);
  });
});
