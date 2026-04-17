import { spawn } from "node:child_process";
import type { ScmProvider } from "./scm-provider.js";

function runGit(
  repoRoot: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: repoRoot,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer | string) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d: Buffer | string) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
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
}
