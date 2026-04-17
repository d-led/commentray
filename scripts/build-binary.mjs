#!/usr/bin/env node
/**
 * Build a standalone Commentary CLI binary for the current platform using
 * Node.js Single Executable Applications (SEA).
 *
 * Output: packages/cli/dist/bin/commentary-<platform>-<arch>[.exe]
 *
 * Steps:
 *   1. Ensure the CLI bundle exists (`npm run build:bundle -w @commentary/cli`).
 *   2. Generate the SEA blob via `node --experimental-sea-config`.
 *   3. Copy the current `node` binary to the output path.
 *   4. Inject the blob via `postject` (with platform-specific options).
 *   5. Re-sign on macOS (ad-hoc) so the loader accepts the patched binary.
 *
 * Notes:
 *   - We deliberately do NOT sign on Linux or Windows here; releases can be
 *     signed downstream. The binary is otherwise runnable.
 *   - Windows `signtool remove` is only attempted if it is available.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_DIR = join(REPO_ROOT, "packages", "cli");
const DIST = join(CLI_DIR, "dist");
const OUT_DIR = join(DIST, "bin");
const BUNDLE = join(DIST, "cli.bundle.cjs");
const BLOB = join(DIST, "sea-prep.blob");
const SEA_CONFIG = join(CLI_DIR, "sea-config.json");
const FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function run(cmd, args, options = {}) {
  const pretty = `${cmd} ${args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`;
  console.log(`$ ${pretty}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${pretty}`);
  }
}

function tryRun(cmd, args) {
  const pretty = `${cmd} ${args.join(" ")}`;
  console.log(`$ ${pretty} (optional)`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) {
    console.log(`  skipped (${result.error?.code ?? `exit ${result.status}`})`);
    return false;
  }
  return true;
}

function binarySuffix() {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const arch = process.arch;
  const ext = process.platform === "win32" ? ".exe" : "";
  return { name: `commentary-${platform}-${arch}${ext}`, platform, arch, ext };
}

function ensureBundle() {
  if (existsSync(BUNDLE)) return;
  console.log("Bundle missing; running `npm run build:bundle -w @commentary/cli`.");
  run("npm", ["run", "build:bundle", "-w", "@commentary/cli"], {
    cwd: REPO_ROOT,
    shell: process.platform === "win32",
  });
}

function generateBlob() {
  if (existsSync(BLOB)) rmSync(BLOB);
  run(process.execPath, ["--experimental-sea-config", SEA_CONFIG], { cwd: CLI_DIR });
  if (!existsSync(BLOB)) {
    throw new Error(`Expected blob at ${BLOB} but it was not produced.`);
  }
}

function resolveSourceNode() {
  // Allow overriding the source Node binary; some installs (e.g. Homebrew on
  // Apple Silicon) ship a dynamically-linked shim that postject can't patch.
  // Official Node builds from nodejs.org (and `actions/setup-node` in CI) are
  // statically linked and work out of the box.
  const override = process.env.COMMENTARY_SEA_NODE;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`COMMENTARY_SEA_NODE=${override} does not exist.`);
    }
    return override;
  }
  return process.execPath;
}

function copyNodeBinary(source, targetPath) {
  mkdirSync(dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) rmSync(targetPath);
  copyFileSync(source, targetPath);
  if (process.platform !== "win32") {
    spawnSync("chmod", ["+x", targetPath], { stdio: "inherit" });
  }
}

function postjectInject(targetPath) {
  const args = ["postject", targetPath, "NODE_SEA_BLOB", BLOB, "--sentinel-fuse", FUSE];
  if (process.platform === "darwin") {
    args.push("--macho-segment-name", "NODE_SEA");
  }
  run("npx", ["--yes", ...args], { cwd: REPO_ROOT, shell: process.platform === "win32" });
}

function prepareForInjection(targetPath) {
  if (process.platform === "darwin") {
    tryRun("codesign", ["--remove-signature", targetPath]);
  } else if (process.platform === "win32") {
    tryRun("signtool", ["remove", "/s", targetPath]);
  }
}

function finalizeBinary(targetPath) {
  if (process.platform === "darwin") {
    run("codesign", ["--sign", "-", targetPath]);
  }
}

function reportSize(targetPath) {
  const { size } = statSync(targetPath);
  const mb = (size / (1024 * 1024)).toFixed(1);
  console.log(`Built ${targetPath} (${mb} MiB).`);
}

ensureBundle();
generateBlob();

const { name } = binarySuffix();
const targetPath = join(OUT_DIR, name);
const source = resolveSourceNode();
console.log(`Using source Node binary: ${source}`);
copyNodeBinary(source, targetPath);
prepareForInjection(targetPath);
postjectInject(targetPath);
finalizeBinary(targetPath);
reportSize(targetPath);
