import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "@iarna/toml";

export type CommentaryToml = {
  storage?: { dir?: string };
  scm?: { provider?: string };
  render?: { mermaid?: boolean; syntaxTheme?: string };
  anchors?: { defaultStrategy?: string[] };
};

export type ResolvedCommentaryConfig = {
  storageDir: string;
  scmProvider: "git";
  render: { mermaid: boolean; syntaxTheme: string };
  anchors: { defaultStrategy: string[] };
};

const defaultConfig: ResolvedCommentaryConfig = {
  storageDir: ".commentary",
  scmProvider: "git",
  render: { mermaid: true, syntaxTheme: "github-dark" },
  anchors: { defaultStrategy: ["symbol", "lines"] },
};

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
