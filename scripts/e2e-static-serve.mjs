#!/usr/bin/env node
/**
 * Serves `_site` on port 4173 with a stable repo-root path (see `package.json` `e2e:server`).
 * `serve` is invoked with an absolute `_site` so `npm run` / start-server-and-test never pick up
 * the wrong directory when the working directory is not the repository root.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(repoRoot, "_site");
const serveBin = path.join(repoRoot, "node_modules", ".bin", "serve");

const child = spawn(serveBin, [siteDir, "-l", "4173"], {
  stdio: "inherit",
  cwd: repoRoot,
  shell: false,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
