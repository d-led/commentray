import { normalizeRepoRelativePath } from "../paths.js";
import { runGit } from "./git-spawn.js";
import type { ScmPathRename, ScmProvider } from "./scm-provider.js";

/**
 * Parses `git diff --name-status` output for `R` (rename) lines. Tab-separated
 * `R086\told/path\tnew/path` (score optional).
 */
export function parseGitRenameLines(stdout: string): ScmPathRename[] {
  const out: ScmPathRename[] = [];
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split("\t");
    if (parts.length < 3) continue;
    const status = parts[0] ?? "";
    if (!status.startsWith("R")) continue;
    try {
      out.push({
        from: normalizeRepoRelativePath(parts[1] ?? ""),
        to: normalizeRepoRelativePath(parts[2] ?? ""),
      });
    } catch {
      continue;
    }
  }
  return out;
}

export class GitScmProvider implements ScmProvider {
  async getBlobIdAtHead(repoRoot: string, repoRelativePath: string): Promise<string | null> {
    const posixPath = repoRelativePath.replaceAll("\\", "/").replace(/^\/+/, "");
    const spec = `HEAD:${posixPath}`;
    const { code, stdout, stderr } = await runGit(repoRoot, ["rev-parse", spec]);
    if (code !== 0) {
      if (
        /fatal: Not a valid object name/.test(stderr) ||
        /fatal: Path .* does not exist/.test(stderr)
      ) {
        return null;
      }
      throw new Error(`git rev-parse failed (${code}): ${stderr.trim()}`);
    }
    return stdout.trim() || null;
  }

  async isAncestor(repoRoot: string, possibleAncestor: string, commit: string): Promise<boolean> {
    const { code, stderr } = await runGit(repoRoot, [
      "merge-base",
      "--is-ancestor",
      possibleAncestor,
      commit,
    ]);
    if (code === 0) return true;
    if (code === 1) return false;
    throw new Error(`git merge-base failed (${code}): ${stderr.trim()}`);
  }

  async listPathRenamesBetweenTreeishes(
    repoRoot: string,
    fromTreeish: string,
    toTreeish: string,
  ): Promise<ScmPathRename[]> {
    const { code, stdout, stderr } = await runGit(repoRoot, [
      "diff",
      "--name-status",
      "-M30%",
      fromTreeish,
      toTreeish,
    ]);
    if (code !== 0) {
      throw new Error(`git diff --name-status failed (${code}): ${stderr.trim() || stdout.trim()}`);
    }
    return parseGitRenameLines(stdout);
  }
}
