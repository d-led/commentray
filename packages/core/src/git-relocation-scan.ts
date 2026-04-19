import fs from "node:fs/promises";
import path from "node:path";

import { normalizeRepoRelativePath } from "./paths.js";
import { runGit } from "./scm/git-spawn.js";

/** Tracked paths we may read for marker/snippet relocation hints (bounded scan). */
const RELOCATION_SCAN_SUFFIXES = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".cts",
  ".cxx",
  ".fs",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".mjs",
  ".mts",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
  ".zig",
]);

function isRelocationScanCandidate(repoRelative: string): boolean {
  const lower = repoRelative.toLowerCase();
  if (lower.includes("/node_modules/")) return false;
  const ext = path.posix.extname(lower);
  return RELOCATION_SCAN_SUFFIXES.has(ext);
}

async function readUtf8SourceUnderMaxBytes(
  repoRoot: string,
  norm: string,
  maxBytes: number,
): Promise<string | null> {
  const abs = path.join(repoRoot, ...norm.split("/"));
  let st;
  try {
    st = await fs.stat(abs);
  } catch {
    return null;
  }
  if (!st.isFile() || st.size > maxBytes) return null;
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return null;
  }
  if (buf.includes(0)) return null;
  return buf.toString("utf8").replaceAll("\r\n", "\n");
}

/**
 * Reads UTF-8 text from Git-tracked source-like files that are **not** already in
 * `indexedPathsNorm`, for relocation heuristics only. Bounded by file count and per-file size.
 */
export async function loadGitTrackedSourceTextsOutsideIndex(
  repoRoot: string,
  indexedPathsNorm: ReadonlySet<string>,
  options?: { maxFiles?: number; maxBytesPerFile?: number },
): Promise<Map<string, string>> {
  const maxFiles = options?.maxFiles ?? 400;
  const maxBytes = options?.maxBytesPerFile ?? 200_000;
  const { code, stdout, stderr } = await runGit(repoRoot, ["ls-files", "-z", "--cached"]);
  if (code !== 0) {
    throw new Error(`git ls-files failed (${code}): ${stderr.trim() || stdout.trim()}`);
  }
  const raw = stdout.split("\0").filter(Boolean);
  const sorted = [...raw].sort((a, b) => a.localeCompare(b));
  const out = new Map<string, string>();
  let n = 0;
  for (const rel of sorted) {
    if (n >= maxFiles) break;
    const norm = normalizeRepoRelativePath(rel.replaceAll("\\", "/"));
    if (indexedPathsNorm.has(norm)) continue;
    if (!isRelocationScanCandidate(norm)) continue;
    const text = await readUtf8SourceUnderMaxBytes(repoRoot, norm, maxBytes);
    if (text === null) continue;
    out.set(norm, text);
    n++;
  }
  return out;
}
