import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION, ensureAnglesSentinelFile, writeIndex } from "@commentray/core";
import { browsePageSlugFromPair } from "@commentray/render";

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

/** Shared `[angles]` + `[[angles.definitions]]` + `[render]` tail for README.md hub fixtures. */
const README_ANGLES_TOML_TAIL = [
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
] as const;

async function writeReadmeMultiAngleHubToml(repo: string, title: string): Promise<void> {
  await writeFile(
    path.join(repo, ".commentray.toml"),
    [
      "[static_site]",
      `title = "${title}"`,
      'source_file = "README.md"',
      'commentray_markdown = ".commentray/source/README.md/main.md"',
      ...README_ANGLES_TOML_TAIL,
    ].join("\n"),
    "utf8",
  );
}

async function writeReadmeAnglesCompanionStubs(repo: string): Promise<void> {
  await writeFile(path.join(repo, "README.md"), "# App\n", "utf8");
  await mkdir(path.join(repo, ".commentray", "source", "README.md"), { recursive: true });
  await writeFile(
    path.join(repo, ".commentray", "source", "README.md", "main.md"),
    "# Main angle\n",
    "utf8",
  );
  await writeFile(
    path.join(repo, ".commentray", "source", "README.md", "architecture.md"),
    "# Architecture angle\n",
    "utf8",
  );
}

async function seedReadmeAnglesPagesFixture(repo: string, title: string): Promise<void> {
  await ensureAnglesSentinelFile(repo, ".commentray");
  await writeReadmeMultiAngleHubToml(repo, title);
  await writeReadmeAnglesCompanionStubs(repo);
}

const README_MAIN_ANGLE_MD = ".commentray/source/README.md/main.md";
const EXTRA_TS_MAIN_MD = ".commentray/source/extra.ts/main.md";

/** README multi-angle hub + `extra.ts` indexed pair (shared by browse scroll-link tests). */
async function seedAnglesHubWithIndexedExtraPair(input: {
  tmpPrefix: string;
  hubTitle: string;
  /** Second source + companion on disk only — not added to `index.json`. */
  withDiskOnlyOrphan: boolean;
}): Promise<{
  repo: string;
  extraCr: string;
  orphanCr: string | undefined;
}> {
  const repo = await mkdtemp(path.join(tmpdir(), input.tmpPrefix));
  await seedReadmeAnglesPagesFixture(repo, input.hubTitle);
  await writeFile(path.join(repo, "extra.ts"), "a\nb\n", "utf8");
  await mkdir(path.join(repo, ".commentray", "source", "extra.ts"), { recursive: true });
  await writeFile(
    path.join(repo, EXTRA_TS_MAIN_MD),
    "<!-- commentray:block id=b1 -->\n\n## Extra doc\n",
    "utf8",
  );

  let orphanCr: string | undefined;
  if (input.withDiskOnlyOrphan) {
    await writeFile(path.join(repo, "orphan.ts"), "x\n", "utf8");
    await mkdir(path.join(repo, ".commentray", "source", "orphan.ts"), { recursive: true });
    orphanCr = ".commentray/source/orphan.ts/main.md";
    await writeFile(
      path.join(repo, orphanCr),
      "<!-- commentray:block id=o1 -->\n\n## Orphan doc\n",
      "utf8",
    );
  }

  await writeIndex(repo, {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [README_MAIN_ANGLE_MD]: {
        sourcePath: "README.md",
        commentrayPath: README_MAIN_ANGLE_MD,
        blocks: [],
      },
      [EXTRA_TS_MAIN_MD]: {
        sourcePath: "extra.ts",
        commentrayPath: EXTRA_TS_MAIN_MD,
        blocks: [{ id: "b1", anchor: "lines:1-2" }],
      },
    },
  });

  return { repo, extraCr: EXTRA_TS_MAIN_MD, orphanCr };
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
  const serveJson = JSON.parse(await readFile(path.join(r, "_site", "serve.json"), "utf8")) as {
    renderSingle?: boolean;
  };
  expect(serveJson.renderSingle).toBe(true);
  const slugFile = browseFiles.find((f) => f.endsWith(".html"));
  if (slugFile === undefined) {
    throw new Error("expected a .html file under _site/browse");
  }
  const slugStem = path.basename(slugFile, ".html");
  const humaneAliasHtml = await readFile(
    path.join(r, "_site", "browse", "src", "x.ts", "index.html"),
    "utf8",
  );
  expect(humaneAliasHtml).toContain("Redirecting");
  expect(humaneAliasHtml).toContain(`content="0;url=../${slugStem}.html"`);
  expect(new URL(`../${slugStem}.html`, "http://localhost:4173/browse/src/x.ts").pathname).toBe(
    `/browse/${slugStem}.html`,
  );
  expect(html).toContain('aria-label="Documentation home"');
  expect(html).toContain('href="./"');
  const browseHtml = await readFile(path.join(r, "_site", "browse", slugFile), "utf8");
  expect(browseHtml).toContain('href="../index.html"');
  expect(browseHtml).toContain('aria-label="Documentation home"');
  expect(browseHtml).toMatch(
    /id="shell"[^>]*data-commentray-pair-browse-href="\.\/browse\/[^"]+\.html"/,
  );
  return r;
}

async function runAngleSelectorOnBrowsePermalinks(): Promise<string> {
  const r = await mkdtemp(path.join(tmpdir(), "cr-pages-ang-"));
  await seedReadmeAnglesPagesFixture(r, "Angles");

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
  const readmeRefreshTarget = sourceAliasHtml.match(/content="0;url=([^"]+)"/)?.[1];
  if (readmeRefreshTarget === undefined || readmeRefreshTarget.length === 0) {
    throw new Error("expected humane README alias redirect target in meta refresh");
  }
  expect(new URL(readmeRefreshTarget, "http://localhost:4173/browse/README.md").pathname).toMatch(
    /^\/browse\/[A-Za-z0-9_-]+\.html$/,
  );
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

/** Hub uses two README angles; a second source has only one angle file so browse is not multi-angle. */
async function runBrowseSingleAnglePairEmbedsScrollBlockLinks(): Promise<string> {
  const { repo: r, extraCr } = await seedAnglesHubWithIndexedExtraPair({
    tmpPrefix: "cr-pages-bss-",
    hubTitle: "Angles + extra",
    withDiskOnlyOrphan: false,
  });

  await buildGithubPagesStaticSite({ repoRoot: r });

  const nav = JSON.parse(
    await readFile(path.join(r, "_site", "commentray-nav-search.json"), "utf8"),
  ) as {
    documentedPairs?: { sourcePath: string; staticBrowseUrl?: string }[];
  };
  const extraPair = nav.documentedPairs?.find((p) => p.sourcePath === "extra.ts");
  expect(extraPair?.staticBrowseUrl).toMatch(/^\.\/browse\/.+\.html$/);
  const canonicalSlug = browsePageSlugFromPair({
    sourcePath: "extra.ts",
    commentrayPath: extraCr,
  });
  const browseHtml = await readFile(
    path.join(r, "_site", "browse", `${canonicalSlug}.html`),
    "utf8",
  );
  const b64 = /data-scroll-block-links-b64="([^"]*)"/.exec(browseHtml)?.[1];
  if (!b64)
    throw new Error("expected non-empty data-scroll-block-links-b64 on extra.ts browse page");
  const links = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as unknown[];
  expect(Array.isArray(links)).toBe(true);
  expect(links.length).toBeGreaterThan(0);
  return r;
}

/**
 * Documents the split between **nav / browse** (disk + index merge) and **block scroll + rays**
 * (index `blocks` only). Without this, a repo can list many pairs while only hub defaults get
 * obvious block sync — easy to mistake for a renderer regression.
 */
async function runBrowseIndexedPairGetsScrollLinksDiskOnlyPairGetsEmptyPayload(): Promise<string> {
  const {
    repo: r,
    extraCr,
    orphanCr,
  } = await seedAnglesHubWithIndexedExtraPair({
    tmpPrefix: "cr-pages-idx-disk-",
    hubTitle: "Indexed vs disk-only",
    withDiskOnlyOrphan: true,
  });
  if (orphanCr === undefined) throw new Error("expected disk-only orphan path");

  await buildGithubPagesStaticSite({ repoRoot: r });

  const nav = JSON.parse(
    await readFile(path.join(r, "_site", "commentray-nav-search.json"), "utf8"),
  ) as { documentedPairs?: { sourcePath: string }[] };
  const sources = new Set((nav.documentedPairs ?? []).map((p) => p.sourcePath));
  expect(sources.has("extra.ts")).toBe(true);
  // Disk-only pair: still listed for browse/search, but not in index.json.
  expect(sources.has("orphan.ts")).toBe(true);

  const extraSlug = browsePageSlugFromPair({
    sourcePath: "extra.ts",
    commentrayPath: extraCr,
  });
  const extraHtml = await readFile(path.join(r, "_site", "browse", `${extraSlug}.html`), "utf8");
  const extraAttr = /data-scroll-block-links-b64="([^"]*)"/.exec(extraHtml);
  expect(extraAttr).not.toBeNull();
  if (extraAttr?.[1] === undefined) throw new Error("expected capture");
  expect(extraAttr[1].length).toBeGreaterThan(0);
  const extraLinks = JSON.parse(Buffer.from(extraAttr[1], "base64").toString("utf8")) as unknown[];
  expect(extraLinks.length).toBeGreaterThan(0);

  const orphanSlug = browsePageSlugFromPair({ sourcePath: "orphan.ts", commentrayPath: orphanCr });
  const orphanHtml = await readFile(path.join(r, "_site", "browse", `${orphanSlug}.html`), "utf8");
  const orphanAttr = /data-scroll-block-links-b64="([^"]*)"/.exec(orphanHtml);
  expect(orphanAttr).not.toBeNull();
  if (orphanAttr?.[1] === undefined) throw new Error("expected capture");
  // No index entry → no block links for gutter rays / block-aware scroll in the shell.
  expect(orphanAttr[1]).toBe("");

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

  it("stamps pagesBuildCommitSha into the hub and browse footers when the builder passes it", async () => {
    repo = await mkdtemp(path.join(tmpdir(), "cr-pages-foot-sha-"));
    await writeMinimalPagesFixture(repo, {
      title: "Sha footer",
      githubUrl: "https://github.com/acme/demo",
    });
    const sha = "0123456789abcdef0123456789abcdef01234567";
    await buildGithubPagesStaticSite({ repoRoot: repo, pagesBuildCommitSha: sha });
    const hub = await readFile(path.join(repo, "_site", "index.html"), "utf8");
    expect(hub).toContain(`>${sha}</code>`);
    const browseFiles = await readdir(path.join(repo, "_site", "browse"));
    const browseName = browseFiles.find((f) => f.endsWith(".html"));
    if (browseName === undefined) throw new Error("expected browse html");
    const browseHtml = await readFile(path.join(repo, "_site", "browse", browseName), "utf8");
    expect(browseHtml).toContain(`>${sha}</code>`);
  });

  it("includes the angle selector on browse permalinks when multi-angle is enabled", async () => {
    repo = await runAngleSelectorOnBrowsePermalinks();
  });

  it("embeds block scroll links on browse for a single-angle pair when the hub uses angles", async () => {
    repo = await runBrowseSingleAnglePairEmbedsScrollBlockLinks();
  });

  it("embeds non-empty scroll-link payload only for index-backed pairs; disk-only pairs get an empty attribute", async () => {
    repo = await runBrowseIndexedPairGetsScrollLinksDiskOnlyPairGetsEmptyPayload();
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
