#!/usr/bin/env node
/**
 * Serves `_site` for Cypress E2E with a stable repo-root path (see `package.json` `e2e:server`).
 * Uses a dedicated port (default **14173**) so local **`commentray serve` on 4173** does not steal
 * the listener: `serve` would otherwise fall back to a random port while Cypress still targets the
 * configured URL. Override with **`COMMENTRAY_E2E_PORT`**.
 *
 * `--no-port-switching` fails fast if the port is taken instead of binding elsewhere.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(repoRoot, "_site");
const serveBin = path.join(repoRoot, "node_modules", ".bin", "serve");
const port = (process.env.COMMENTRAY_E2E_PORT ?? "14173").trim();

const child = spawn(
  serveBin,
  [siteDir, "-l", `tcp://127.0.0.1:${port}`, "--no-port-switching", "-n"],
  {
    stdio: "inherit",
    cwd: repoRoot,
    shell: false,
  },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
