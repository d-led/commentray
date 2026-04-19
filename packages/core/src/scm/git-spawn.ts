import { spawn } from "node:child_process";

/**
 * Runs `git` with `args` in `repoRoot`; collects stdout/stderr as strings.
 * Resolves with exit code (defaults to 1 when null).
 */
export function runGit(
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
