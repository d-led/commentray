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
  expect(browseHtml).toMatch(/id="toolbar-commentray-github"[^>]*href="\.\/browse\/[^"]+\.html"/);
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
  const browseFiles = (await readdir(browseDir)).filter((f) => f.endsWith(".html"));
  expect(browseFiles.length).toBeGreaterThanOrEqual(2);
  for (const name of browseFiles) {
    const browseHtml = await readFile(path.join(browseDir, name), "utf8");
    expect(browseHtml).toContain('aria-label="Commentray angle"');
    expect(browseHtml).toContain('id="commentray-multi-angle-b64"');
  }
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
  expect(html).toContain(
    'id="toolbar-source-github" href="https://github.com/d-led/commentray/blob/main/src/x.ts"',
  );
  expect(html).not.toContain("/browse/browse/");
  const nav = JSON.parse(await readFile(navSearchPath, "utf8")) as {
    documentedPairs?: { commentrayOnGithub?: string }[];
  };
  expect(nav.documentedPairs?.[0]?.commentrayOnGithub).toBe(
    "https://github.com/d-led/commentray/blob/main/.commentray/source/src/x.ts.md",
  );
  const browseFiles = await readdir(path.join(r, "_site", "browse"));
  const browseName = browseFiles.find((f) => f.endsWith(".html"));
  expect(browseName).toBeTruthy();
  if (browseName === undefined) throw new Error("expected browse html");
  const browseHtml = await readFile(path.join(r, "_site", "browse", browseName), "utf8");
  expect(browseHtml).toContain(
    'id="toolbar-source-github" href="https://github.com/d-led/commentray/blob/main/src/x.ts"',
  );
  expect(browseHtml).not.toContain("/browse/browse/");
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
});
