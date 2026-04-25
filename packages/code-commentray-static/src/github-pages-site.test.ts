import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ensureAnglesSentinelFile } from "@commentray/core";

import { buildGithubPagesStaticSite } from "./github-pages-site.js";

async function writeMinimalPagesFixture(
  repo: string,
  opts: { title: string; githubUrl?: string; githubBlobBranch?: string },
): Promise<void> {
  const staticSite: string[] = [
    "[static_site]",
    `title = "${opts.title}"`,
    'source_file = "src/x.ts"',
    'commentray_markdown = ".commentray/source/src/x.ts.md"',
  ];
  if (opts.githubUrl !== undefined) {
    staticSite.push(`github_url = "${opts.githubUrl}"`);
  }
  if (opts.githubBlobBranch !== undefined) {
    staticSite.push(`github_blob_branch = "${opts.githubBlobBranch}"`);
  }
  await writeFile(
    path.join(repo, ".commentray.toml"),
    [...staticSite, "", "[render]", "mermaid = false", ""].join("\n"),
    "utf8",
  );
  await mkdir(path.join(repo, "src"), { recursive: true });
  await writeFile(path.join(repo, "src", "x.ts"), "export const x = 1;\n", "utf8");
  await mkdir(path.join(repo, ".commentray", "source", "src"), { recursive: true });
  await writeFile(path.join(repo, ".commentray", "source", "src", "x.ts.md"), "# Doc\n", "utf8");
}

async function runWritesSiteAndNavFromFlatCompanions(): Promise<string> {
  const r = await mkdtemp(path.join(tmpdir(), "cr-pages-"));
  await writeMinimalPagesFixture(r, {
    title: "Demo",
    githubUrl: "https://github.com/acme/demo",
  });

  const { outHtml, navSearchPath } = await buildGithubPagesStaticSite({ repoRoot: r });

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
  const browseFiles = await readdir(path.join(r, "_site", "browse"));
  expect(browseFiles.some((f) => f.endsWith(".html"))).toBe(true);
  const humaneAliasHtml = await readFile(
    path.join(r, "_site", "browse", "src", "x.ts", "index.html"),
    "utf8",
  );
  expect(humaneAliasHtml).toContain("Redirecting");
  expect(humaneAliasHtml).toContain(".html");
  expect(html).toContain('aria-label="Documentation home"');
  expect(html).toContain('href="./"');
  const browseName = browseFiles.find((f) => f.endsWith(".html"));
  expect(browseName).toBeTruthy();
  if (browseName === undefined) {
    throw new Error("expected a .html file under _site/browse");
  }
  const browseHtml = await readFile(path.join(r, "_site", "browse", browseName), "utf8");
  expect(browseHtml).toContain('href="../index.html"');
  expect(browseHtml).toContain('aria-label="Documentation home"');
  expect(browseHtml).toMatch(
    /id="shell"[^>]*data-commentray-pair-browse-href="\.\/browse\/[^"]+\.html"/,
  );
  return r;
}

async function runAngleSelectorOnBrowsePermalinks(): Promise<string> {
  const r = await mkdtemp(path.join(tmpdir(), "cr-pages-ang-"));
  const storage = ".commentray";
  await ensureAnglesSentinelFile(r, storage);
  await writeFile(
    path.join(r, ".commentray.toml"),
    [
      "[static_site]",
      'title = "Angles"',
      'source_file = "README.md"',
      'commentray_markdown = ".commentray/source/README.md/main.md"',
      "",
      "[angles]",
      'default_angle = "main"',
      "",
      "[[angles.definitions]]",
      'id = "main"',
      'title = "Main"',
      "",
      "[[angles.definitions]]",
      'id = "architecture"',
      'title = "Architecture"',
      "",
      "[render]",
      "mermaid = false",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(r, "README.md"), "# App\n", "utf8");
  await mkdir(path.join(r, ".commentray", "source", "README.md"), { recursive: true });
  await writeFile(
    path.join(r, ".commentray", "source", "README.md", "main.md"),
    "# Main angle\n",
    "utf8",
  );
  await writeFile(
    path.join(r, ".commentray", "source", "README.md", "architecture.md"),
    "# Architecture angle\n",
    "utf8",
  );

  await buildGithubPagesStaticSite({ repoRoot: r });

  const browseDir = path.join(r, "_site", "browse");
  const browseFiles = (await readdir(browseDir)).filter((f) => /^[A-Za-z0-9_-]+\.html$/.test(f));
  expect(browseFiles.length).toBeGreaterThanOrEqual(2);
  for (const name of browseFiles) {
    const browseHtml = await readFile(path.join(browseDir, name), "utf8");
    expect(browseHtml).toContain('aria-label="Commentray angle"');
    expect(browseHtml).toContain('id="commentray-multi-angle-b64"');
  }
  const sourceAliasHtml = await readFile(
    path.join(r, "_site", "browse", "README.md", "index.html"),
    "utf8",
  );
  expect(sourceAliasHtml).toContain("Redirecting");
  expect(sourceAliasHtml).toMatch(/\.\.\/[^/]+\.html/);
  const angleAliasMainHtml = await readFile(
    path.join(r, "_site", "browse", "README.md@main.html"),
    "utf8",
  );
  expect(angleAliasMainHtml).toContain("Redirecting");
  const angleAliasArchitectureHtml = await readFile(
    path.join(r, "_site", "browse", "README.md@architecture.html"),
    "utf8",
  );
  expect(angleAliasArchitectureHtml).toContain("Redirecting");
  return r;
}

async function runGithubToolbarUsesBlobUrlsForRealisticHost(): Promise<string> {
  const r = await mkdtemp(path.join(tmpdir(), "cr-pages-realgh-"));
  await writeMinimalPagesFixture(r, {
    title: "Blob shape",
    githubUrl: "https://github.com/d-led/commentray",
    githubBlobBranch: "main",
  });

  const { outHtml, navSearchPath } = await buildGithubPagesStaticSite({ repoRoot: r });
  const html = await readFile(outHtml, "utf8");
  /** Hub `index.html` prefers same-site pair browse; GitHub blobs live in `commentray-nav-search.json`. */
  expect(html).toMatch(/data-commentray-pair-browse-href="\.\/browse\/[^"]+\.html"/);
  expect(html).not.toContain("/browse/browse/");
  const nav = JSON.parse(await readFile(navSearchPath, "utf8")) as {
    documentedPairs?: { sourceOnGithub?: string; commentrayOnGithub?: string }[];
  };
  expect(nav.documentedPairs?.[0]?.sourceOnGithub).toBe(
    "https://github.com/d-led/commentray/blob/main/src/x.ts",
  );
  expect(nav.documentedPairs?.[0]?.commentrayOnGithub).toBe(
    "https://github.com/d-led/commentray/blob/main/.commentray/source/src/x.ts.md",
  );
  const browseFiles = await readdir(path.join(r, "_site", "browse"));
  const browseName = browseFiles.find((f) => f.endsWith(".html"));
  expect(browseName).toBeTruthy();
  if (browseName === undefined) throw new Error("expected browse html");
  const browseHtml = await readFile(path.join(r, "_site", "browse", browseName), "utf8");
  expect(browseHtml).toMatch(/data-commentray-pair-browse-href="\.\/browse\/[^"]+\.html"/);
  expect(browseHtml).not.toContain("/browse/browse/");
  const humaneAliasHtml = await readFile(
    path.join(r, "_site", "browse", "src", "x.ts", "index.html"),
    "utf8",
  );
  expect(humaneAliasHtml).toContain(".html");
  return r;
}

async function runBrowseWithoutGithubUrl(): Promise<string> {
  const r = await mkdtemp(path.join(tmpdir(), "cr-pages-"));
  await writeMinimalPagesFixture(r, { title: "Local" });

  const { outHtml, navSearchPath } = await buildGithubPagesStaticSite({ repoRoot: r });

  const html = await readFile(outHtml, "utf8");
  expect(html).not.toMatch(/aria-label="Source file on GitHub"/);
  expect(html).toContain('aria-label="Documentation home"');
  expect(html).toContain('href="./"');
  expect(html).toContain('data-nav-search-json-url="./commentray-nav-search.json"');
  const nav = JSON.parse(await readFile(navSearchPath, "utf8")) as {
    documentedPairs?: { staticBrowseUrl?: string; sourceOnGithub?: string }[];
  };
  expect(nav.documentedPairs?.[0]?.staticBrowseUrl).toMatch(/^\.\/browse\/.+\.html$/);
  expect(nav.documentedPairs?.[0]?.sourceOnGithub).toBeUndefined();
  const browseFiles = await readdir(path.join(r, "_site", "browse"));
  expect(browseFiles.some((f) => f.endsWith(".html"))).toBe(true);
  return r;
}

describe("GitHub Pages static site output", () => {
  let repo: string;

  afterEach(async () => {
    if (repo) await rm(repo, { recursive: true, force: true });
  });

  it("writes _site/index.html and nav search from [static_site] flat companions", async () => {
    repo = await runWritesSiteAndNavFromFlatCompanions();
  });

  it("includes the angle selector on browse permalinks when multi-angle is enabled", async () => {
    repo = await runAngleSelectorOnBrowsePermalinks();
  });

  it("writes browse pages and hub nav without static_site.github_url (same-site navigation only)", async () => {
    repo = await runBrowseWithoutGithubUrl();
  });

  it("writes GitHub blob toolbar URLs for d-led/commentray + main when configured", async () => {
    repo = await runGithubToolbarUsesBlobUrlsForRealisticHost();
  });

  it("mirrors companion storage images under _site/commentray-static-assets for Pages-style hosts", async () => {
    repo = await mkdtemp(path.join(tmpdir(), "cr-pages-img-"));
    await writeMinimalPagesFixture(repo, { title: "Img" });
    await mkdir(path.join(repo, ".commentray", "source", "src", "assets"), { recursive: true });
    await writeFile(
      path.join(repo, ".commentray", "source", "src", "assets", "x.svg"),
      "<svg/>",
      "utf8",
    );
    await writeFile(
      path.join(repo, ".commentray", "source", "src", "x.ts.md"),
      "# Doc\n\n![](assets/x.svg)\n",
      "utf8",
    );
    await buildGithubPagesStaticSite({ repoRoot: repo });
    const mirrored = path.join(
      repo,
      "_site",
      "commentray-static-assets",
      "source",
      "src",
      "assets",
      "x.svg",
    );
    expect(await readFile(mirrored, "utf8")).toContain("<svg");
    const indexHtml = await readFile(path.join(repo, "_site", "index.html"), "utf8");
    expect(indexHtml).toMatch(/commentray-static-assets\/source\/src\/assets\/x\.svg/);
  });

  it("rewrites rendered source-markdown local links to GitHub blob URLs when enabled", async () => {
    repo = await mkdtemp(path.join(tmpdir(), "cr-pages-src-links-"));
    await writeFile(
      path.join(repo, ".commentray.toml"),
      [
        "[static_site]",
        'title = "Src links"',
        'github_url = "https://github.com/acme/demo"',
        'source_file = "README.md"',
        'commentray_markdown = ".commentray/source/README.md.md"',
        "",
        "[render]",
        "mermaid = false",
        "relative_github_blob_links = true",
        "",
      ].join("\n"),
      "utf8",
    );
    await mkdir(path.join(repo, "docs", "user"), { recursive: true });
    await writeFile(path.join(repo, "README.md"), "[Install](docs/user/install.md)\n", "utf8");
    await writeFile(path.join(repo, "docs", "user", "install.md"), "# Install\n", "utf8");
    await mkdir(path.join(repo, ".commentray", "source"), { recursive: true });
    await writeFile(path.join(repo, ".commentray", "source", "README.md.md"), "# Doc\n", "utf8");
    await buildGithubPagesStaticSite({ repoRoot: repo });
    const html = await readFile(path.join(repo, "_site", "index.html"), "utf8");
    expect(html).toContain('href="https://github.com/acme/demo/blob/main/docs/user/install.md"');
    expect(html).not.toContain('href="docs/user/install.md"');
  });
});
