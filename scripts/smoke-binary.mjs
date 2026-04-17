#!/usr/bin/env node
/**
 * Smoke test the built standalone Commentary binary for this platform.
 * Exits non-zero with a clear message on the first failure.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "packages", "cli", "dist", "bin");

function binaryName() {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const ext = process.platform === "win32" ? ".exe" : "";
  return `commentary-${platform}-${process.arch}${ext}`;
}

function expectSuccess(label, args, { expectOutput } = {}) {
  const result = spawnSync(binPath, args, { encoding: "utf8" });
  const out = (result.stdout ?? "") + (result.stderr ?? "");
  if (result.status !== 0) {
    const detail =
      result.status === null
        ? `no exit code (signal=${result.signal ?? "?"})${result.error ? ` ${result.error.message}` : ""}`
        : `exit ${result.status}`;
    console.error(`[fail] ${label}: ${detail}`);
    console.error(out);
    process.exit(1);
  }
  if (expectOutput && !out.includes(expectOutput)) {
    console.error(`[fail] ${label}: expected output to include ${JSON.stringify(expectOutput)}`);
    console.error(out);
    process.exit(1);
  }
  console.log(`[ok]   ${label}`);
}

const binPath = join(OUT_DIR, binaryName());
if (!existsSync(binPath)) {
  console.error(`No binary at ${binPath}. Run \`node scripts/build-binary.mjs\` first.`);
  process.exit(1);
}

expectSuccess("--version prints 0.0.1", ["--version"], { expectOutput: "0.0.1" });
expectSuccess("--help lists init", ["--help"], { expectOutput: "init" });
expectSuccess("init --help shows scm subcommand", ["init", "--help"], { expectOutput: "scm" });
expectSuccess("paths prints .commentary/source path", ["paths", "src/foo.ts"], {
  expectOutput: ".commentary/source/src/foo.ts.md",
});

console.log("binary smoke tests passed");
