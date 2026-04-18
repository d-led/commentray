#!/usr/bin/env node
/**
 * Build `_site/index.html` for GitHub Pages from `.commentray.toml` `[static_site]`.
 * Implementation: {@link import("@commentray/code-commentray-static/github-pages-site")}.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildGithubPagesStaticSite } from "@commentray/code-commentray-static/github-pages-site";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const { outHtml, navSearchPath } = await buildGithubPagesStaticSite({ repoRoot });
  console.log(`Wrote ${outHtml}`);
  console.log(`Wrote ${navSearchPath}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
