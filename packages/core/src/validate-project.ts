import fs from "node:fs/promises";
import path from "node:path";
import { type ResolvedCommentaryConfig, loadCommentaryConfig } from "./config.js";
import { assertValidIndex } from "./metadata.js";
import { defaultMetadataIndexPath } from "./paths.js";
import type { CommentaryIndex } from "./model.js";

export type ValidationIssue = { level: "error" | "warn"; message: string };

export type ValidationResult = {
  issues: ValidationIssue[];
};

export async function validateProject(repoRoot: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let config: ResolvedCommentaryConfig;
  try {
    config = await loadCommentaryConfig(repoRoot);
  } catch (err) {
    issues.push({
      level: "error",
      message: `Failed to load .commentary.toml: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { issues };
  }

  const storageAbs = path.join(repoRoot, config.storageDir);
  for (const sub of ["source", "metadata"]) {
    const p = path.join(storageAbs, sub);
    try {
      await fs.stat(p);
    } catch {
      issues.push({
        level: "warn",
        message: `Missing directory: ${path.join(config.storageDir, sub)}`,
      });
    }
  }

  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    assertValidIndex(JSON.parse(raw) as unknown);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      issues.push({ level: "warn", message: `No metadata index at ${defaultMetadataIndexPath()}` });
    } else {
      issues.push({
        level: "error",
        message: `Invalid metadata index: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { issues };
}

export async function readIndex(repoRoot: string): Promise<CommentaryIndex | null> {
  const indexPath = path.join(repoRoot, defaultMetadataIndexPath());
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    return assertValidIndex(JSON.parse(raw) as unknown);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}
