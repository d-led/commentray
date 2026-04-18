import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "@iarna/toml";

import { assertValidAngleId } from "./angles.js";
import { githubRepoBlobFileUrl, parseGithubRepoWebUrl } from "./github-url.js";
import { normalizeRepoRelativePath } from "./paths.js";

export type CommentrayToml = {
  storage?: { dir?: string };
  scm?: { provider?: string };
  render?: {
    mermaid?: boolean;
    syntaxTheme?: string;
    /**
     * When true, `https://github.com/<owner>/<repo>/blob|tree/<branch>/…` links in commentray
     * Markdown are rewritten to paths relative to the generated HTML file (see
     * `static_site.github_url` for owner/repo). Requires a parseable repository URL.
     */
    relative_github_blob_links?: boolean;
  };
  anchors?: { defaultStrategy?: string[] };
  /**
   * Named **Angles** — multiple commentrays per source file (see `docs/spec/storage.md`).
   * Keys use snake_case in TOML (`[angles]`).
   */
  angles?: {
    /** Which Angle is selected by default in tooling and the static viewer (must match a `definitions` id when that list is non-empty). */
    default_angle?: string;
    /** Optional list of known Angles with display titles for UI (static browser, editor). */
    definitions?: { id: string; title?: string }[];
  };
  /**
   * Optional settings for publishing a single-file static “code browser” (GitHub Pages, etc.).
   * Keys use snake_case in TOML (`[static_site]`).
   */
  static_site?: {
    title?: string;
    /** Markdown shown above the optional commentray file and GitHub link. */
    intro?: string;
    github_url?: string;
    /** Repo-relative path to the source file shown in the code pane (default README.md). */
    source_file?: string;
    /** Repo-relative path to additional commentray Markdown (optional). */
    commentray_markdown?: string;
    /** @deprecated Renamed to `commentray_markdown`. */
    commentary_markdown?: string;
    /** Branch name embedded in GitHub blob URLs for `related_github_files` (default `main`). */
    github_blob_branch?: string;
    /**
     * Optional toolbar links on the static code browser: open other repo files on GitHub
     * (single-page Pages deploys cannot serve arbitrary paths next to `index.html`).
     */
    related_github_files?: { label?: string; path: string }[];
  };
};

export type ResolvedGithubNavLink = { label: string; href: string };

export type ResolvedStaticSite = {
  title: string;
  introMarkdown: string;
  githubUrl: string | null;
  /** Branch used when building `relatedGithubNav` blob URLs. */
  githubBlobBranch: string;
  sourceFile: string;
  commentrayMarkdownFile: string;
  /** Toolbar “Also on GitHub …” links for the static code browser. */
  relatedGithubNav: ResolvedGithubNavLink[];
};

export type ResolvedAngleDefinition = { id: string; title: string };

export type ResolvedAngles = {
  /** When `definitions` is non-empty, this must match one of them (enforced at merge). */
  defaultAngleId: string | null;
  definitions: ResolvedAngleDefinition[];
};

export type ResolvedCommentrayConfig = {
  storageDir: string;
  scmProvider: "git";
  render: { mermaid: boolean; syntaxTheme: string; relativeGithubBlobLinks: boolean };
  anchors: { defaultStrategy: string[] };
  angles: ResolvedAngles;
  staticSite: ResolvedStaticSite;
};

const defaultStaticSite: ResolvedStaticSite = {
  title: "Commentray",
  introMarkdown: "",
  githubUrl: null,
  githubBlobBranch: "main",
  sourceFile: "README.md",
  commentrayMarkdownFile: "",
  relatedGithubNav: [],
};

const defaultAngles: ResolvedAngles = { defaultAngleId: null, definitions: [] };

const defaultConfig: ResolvedCommentrayConfig = {
  storageDir: ".commentray",
  scmProvider: "git",
  render: { mermaid: true, syntaxTheme: "github-dark", relativeGithubBlobLinks: false },
  anchors: { defaultStrategy: ["symbol", "lines"] },
  angles: { ...defaultAngles },
  staticSite: { ...defaultStaticSite },
};

function nonEmptyTrimmed(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/**
 * Reject `.commentray.toml` path values that would escape the repository
 * root. Trusting raw config strings would let a malicious `.commentray.toml`
 * redirect Commentray's `mkdir`/read operations outside the repo on an
 * otherwise unsuspecting developer machine.
 */
function assertSafeRepoRelativePath(label: string, value: string | undefined): void {
  if (value === undefined || value === "") return;
  try {
    normalizeRepoRelativePath(value);
  } catch {
    throw new Error(
      `.commentray.toml ${label} must be a repository-relative path without ".." segments (got: ${value})`,
    );
  }
}

/**
 * Commentray's storage directory must never live inside `.git/`. Git treats
 * `.git/` as opaque metadata; colocating our storage there would both
 * confuse Git (adding untracked-but-inside-.git files) and risk being wiped
 * by routine Git operations (e.g. `git gc`, `git clean -fdx`, re-clone).
 */
function assertStorageDirNotInsideGit(value: string | undefined): void {
  if (value === undefined || value === "") return;
  const normalized = normalizeRepoRelativePath(value);
  const firstSegment = normalized.split("/")[0] ?? "";
  if (firstSegment.toLowerCase() === ".git") {
    throw new Error(
      `.commentray.toml storage.dir must not live inside .git/ (got: ${value}). ` +
        `Git treats .git/ as opaque metadata and routine operations can wipe it.`,
    );
  }
}

function mergeAngleDefinitions(
  raw: { id: string; title?: string }[] | undefined,
): ResolvedAngleDefinition[] {
  if (!raw?.length) return [];
  const out: ResolvedAngleDefinition[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const id = assertValidAngleId(row.id);
    if (seen.has(id)) {
      throw new Error(`Duplicate angles.definitions id: ${id}`);
    }
    seen.add(id);
    const title = row.title?.trim() || id;
    out.push({ id, title });
  }
  return out;
}

function resolveAngles(parsed: CommentrayToml): ResolvedAngles {
  const a = parsed.angles;
  if (!a) {
    return { ...defaultAngles };
  }
  const definitions = mergeAngleDefinitions(a.definitions);
  const defaultRaw = a.default_angle?.trim();
  const defaultAngleId = defaultRaw ? assertValidAngleId(defaultRaw) : null;

  if (
    definitions.length > 0 &&
    defaultAngleId &&
    !definitions.some((d) => d.id === defaultAngleId)
  ) {
    throw new Error(
      `angles.default_angle "${defaultAngleId}" must match one of angles.definitions (got: ${definitions.map((d) => d.id).join(", ")})`,
    );
  }

  return { defaultAngleId, definitions };
}

function mergeRelatedGithubNav(
  githubUrl: string | null,
  branch: string,
  raw: { label?: string; path: string }[] | undefined,
): ResolvedGithubNavLink[] {
  const gh = githubUrl ? parseGithubRepoWebUrl(githubUrl) : null;
  if (!gh || !raw?.length) return [];
  const b = branch.trim() || defaultStaticSite.githubBlobBranch;
  const out: ResolvedGithubNavLink[] = [];
  for (const row of raw) {
    if (!row?.path?.trim()) continue;
    const p = normalizeRepoRelativePath(row.path.trim());
    const label = row.label?.trim() || path.posix.basename(p);
    out.push({
      label,
      href: githubRepoBlobFileUrl(gh.owner, gh.repo, b, p),
    });
  }
  return out;
}

function resolvedStaticSiteMarkdownFile(ss: CommentrayToml["static_site"] | undefined): string {
  return (
    ss?.commentray_markdown?.trim() ??
    ss?.commentary_markdown?.trim() ??
    defaultStaticSite.commentrayMarkdownFile
  );
}

function resolveStaticSite(parsed: CommentrayToml): ResolvedStaticSite {
  const ss = parsed.static_site;
  const githubUrl = nonEmptyTrimmed(ss?.github_url);
  const githubBlobBranch =
    nonEmptyTrimmed(ss?.github_blob_branch) ?? defaultStaticSite.githubBlobBranch;
  return {
    title: nonEmptyTrimmed(ss?.title) ?? defaultStaticSite.title,
    introMarkdown: ss?.intro ?? defaultStaticSite.introMarkdown,
    githubUrl,
    githubBlobBranch,
    sourceFile: nonEmptyTrimmed(ss?.source_file) ?? defaultStaticSite.sourceFile,
    commentrayMarkdownFile: resolvedStaticSiteMarkdownFile(ss),
    relatedGithubNav: mergeRelatedGithubNav(githubUrl, githubBlobBranch, ss?.related_github_files),
  };
}

function assertSafeConfigPaths(parsed: CommentrayToml): void {
  assertSafeRepoRelativePath("storage.dir", parsed.storage?.dir);
  assertStorageDirNotInsideGit(parsed.storage?.dir);
  const ss = parsed.static_site;
  assertSafeRepoRelativePath("static_site.source_file", ss?.source_file);
  assertSafeRepoRelativePath("static_site.commentray_markdown", ss?.commentray_markdown);
  assertSafeRepoRelativePath("static_site.commentary_markdown", ss?.commentary_markdown);
  for (let i = 0; i < (ss?.related_github_files?.length ?? 0); i++) {
    assertSafeRepoRelativePath(
      `static_site.related_github_files[${i}].path`,
      ss?.related_github_files?.[i]?.path,
    );
  }
}

export function mergeCommentrayConfig(parsed: CommentrayToml | null): ResolvedCommentrayConfig {
  if (!parsed) return { ...defaultConfig };
  const scm = parsed.scm?.provider ?? defaultConfig.scmProvider;
  if (scm !== "git") {
    throw new Error(`Unsupported scm.provider: ${String(scm)} (only "git" is implemented)`);
  }
  assertSafeConfigPaths(parsed);
  return {
    storageDir: parsed.storage?.dir ?? defaultConfig.storageDir,
    scmProvider: "git",
    render: {
      mermaid: parsed.render?.mermaid ?? defaultConfig.render.mermaid,
      syntaxTheme: parsed.render?.syntaxTheme ?? defaultConfig.render.syntaxTheme,
      relativeGithubBlobLinks:
        parsed.render?.relative_github_blob_links ?? defaultConfig.render.relativeGithubBlobLinks,
    },
    anchors: {
      defaultStrategy: parsed.anchors?.defaultStrategy ?? defaultConfig.anchors.defaultStrategy,
    },
    angles: resolveAngles(parsed),
    staticSite: resolveStaticSite(parsed),
  };
}

export async function loadCommentrayConfig(repoRoot: string): Promise<ResolvedCommentrayConfig> {
  const configPath = path.join(repoRoot, ".commentray.toml");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    if (!raw.trim()) return { ...defaultConfig };
    const parsed = parseToml(raw) as CommentrayToml;
    return mergeCommentrayConfig(parsed);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { ...defaultConfig };
    throw err;
  }
}
