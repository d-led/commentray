import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "@iarna/toml";

import { normalizeRepoRelativePath } from "./paths.js";

export type CommentrayToml = {
  storage?: { dir?: string };
  scm?: { provider?: string };
  render?: { mermaid?: boolean; syntaxTheme?: string };
  anchors?: { defaultStrategy?: string[] };
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
  };
};

export type ResolvedStaticSite = {
  title: string;
  introMarkdown: string;
  githubUrl: string | null;
  sourceFile: string;
  commentrayMarkdownFile: string;
};

export type ResolvedCommentrayConfig = {
  storageDir: string;
  scmProvider: "git";
  render: { mermaid: boolean; syntaxTheme: string };
  anchors: { defaultStrategy: string[] };
  staticSite: ResolvedStaticSite;
};

const defaultStaticSite: ResolvedStaticSite = {
  title: "Commentray",
  introMarkdown: "",
  githubUrl: null,
  sourceFile: "README.md",
  commentrayMarkdownFile: "",
};

const defaultConfig: ResolvedCommentrayConfig = {
  storageDir: ".commentray",
  scmProvider: "git",
  render: { mermaid: true, syntaxTheme: "github-dark" },
  anchors: { defaultStrategy: ["symbol", "lines"] },
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

function resolveStaticSite(parsed: CommentrayToml): ResolvedStaticSite {
  const ss = parsed.static_site;
  const mdFile =
    ss?.commentray_markdown?.trim() ??
    ss?.commentary_markdown?.trim() ??
    defaultStaticSite.commentrayMarkdownFile;
  return {
    title: nonEmptyTrimmed(ss?.title) ?? defaultStaticSite.title,
    introMarkdown: ss?.intro ?? defaultStaticSite.introMarkdown,
    githubUrl: nonEmptyTrimmed(ss?.github_url),
    sourceFile: nonEmptyTrimmed(ss?.source_file) ?? defaultStaticSite.sourceFile,
    commentrayMarkdownFile: mdFile,
  };
}

function assertSafeConfigPaths(parsed: CommentrayToml): void {
  assertSafeRepoRelativePath("storage.dir", parsed.storage?.dir);
  const ss = parsed.static_site;
  assertSafeRepoRelativePath("static_site.source_file", ss?.source_file);
  assertSafeRepoRelativePath("static_site.commentray_markdown", ss?.commentray_markdown);
  assertSafeRepoRelativePath("static_site.commentary_markdown", ss?.commentary_markdown);
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
    },
    anchors: {
      defaultStrategy: parsed.anchors?.defaultStrategy ?? defaultConfig.anchors.defaultStrategy,
    },
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
