import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "@iarna/toml";

export type CommentaryToml = {
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
    /** Markdown shown above the optional commentary file and GitHub link. */
    intro?: string;
    github_url?: string;
    /** Repo-relative path to the source file shown in the code pane (default README.md). */
    source_file?: string;
    /** Repo-relative path to additional commentary Markdown (optional). */
    commentary_markdown?: string;
  };
};

export type ResolvedStaticSite = {
  title: string;
  introMarkdown: string;
  githubUrl: string | null;
  sourceFile: string;
  commentaryMarkdownFile: string;
};

export type ResolvedCommentaryConfig = {
  storageDir: string;
  scmProvider: "git";
  render: { mermaid: boolean; syntaxTheme: string };
  anchors: { defaultStrategy: string[] };
  staticSite: ResolvedStaticSite;
};

const defaultStaticSite: ResolvedStaticSite = {
  title: "Commentary",
  introMarkdown: "",
  githubUrl: null,
  sourceFile: "README.md",
  commentaryMarkdownFile: "",
};

const defaultConfig: ResolvedCommentaryConfig = {
  storageDir: ".commentary",
  scmProvider: "git",
  render: { mermaid: true, syntaxTheme: "github-dark" },
  anchors: { defaultStrategy: ["symbol", "lines"] },
  staticSite: { ...defaultStaticSite },
};

function nonEmptyTrimmed(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function resolveStaticSite(parsed: CommentaryToml): ResolvedStaticSite {
  const ss = parsed.static_site;
  return {
    title: nonEmptyTrimmed(ss?.title) ?? defaultStaticSite.title,
    introMarkdown: ss?.intro ?? defaultStaticSite.introMarkdown,
    githubUrl: nonEmptyTrimmed(ss?.github_url),
    sourceFile: nonEmptyTrimmed(ss?.source_file) ?? defaultStaticSite.sourceFile,
    commentaryMarkdownFile:
      ss?.commentary_markdown?.trim() ?? defaultStaticSite.commentaryMarkdownFile,
  };
}

export function mergeCommentaryConfig(parsed: CommentaryToml | null): ResolvedCommentaryConfig {
  if (!parsed) return { ...defaultConfig };
  const scm = parsed.scm?.provider ?? defaultConfig.scmProvider;
  if (scm !== "git") {
    throw new Error(`Unsupported scm.provider: ${String(scm)} (only "git" is implemented)`);
  }
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

export async function loadCommentaryConfig(repoRoot: string): Promise<ResolvedCommentaryConfig> {
  const configPath = path.join(repoRoot, ".commentary.toml");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    if (!raw.trim()) return { ...defaultConfig };
    const parsed = parseToml(raw) as CommentaryToml;
    return mergeCommentaryConfig(parsed);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { ...defaultConfig };
    throw err;
  }
}
