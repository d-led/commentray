import { parseAnchor } from "./anchors.js";
import { assertValidMarkerId } from "./marker-ids.js";
import type { CommentrayIndex } from "./model.js";
import { parseCommentrayRegionBoundary } from "./source-markers.js";

export type MarkerValidationIssue = { level: "error" | "warn"; message: string };

/**
 * Scans a single source file for Commentray region / marker boundaries and reports:
 * - invalid ids (syntax that matched but fails `assertValidMarkerId` — rare),
 * - duplicate **start** for the same id before its `end`,
 * - orphan **end** lines,
 * - **start** without a matching **end** (unclosed region).
 */
export function validateMarkerBoundariesInSource(
  sourceText: string,
  sourcePath: string,
): MarkerValidationIssue[] {
  const issues: MarkerValidationIssue[] = [];
  const lines = sourceText.replaceAll("\r\n", "\n").split("\n");
  const pendingStartLine = new Map<string, number>();

  for (let line0 = 0; line0 < lines.length; line0++) {
    const hit = parseCommentrayRegionBoundary(lines[line0] ?? "");
    if (!hit) continue;
    try {
      assertValidMarkerId(hit.id);
    } catch (e) {
      issues.push({
        level: "error",
        message: `${sourcePath}:${line0 + 1}: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    const loc = `${sourcePath}:${line0 + 1}`;
    if (hit.kind === "start") {
      const priorStart = pendingStartLine.get(hit.id);
      if (priorStart !== undefined) {
        const prev = priorStart + 1;
        issues.push({
          level: "error",
          message: `${loc}: duplicate commentray start for id "${hit.id}" (also opened at line ${prev}). Close the previous region first, or use a unique id per region.`,
        });
        continue;
      }
      pendingStartLine.set(hit.id, line0);
      continue;
    }
    const start0 = pendingStartLine.get(hit.id);
    if (start0 === undefined) {
      issues.push({
        level: "error",
        message: `${loc}: commentray end for id "${hit.id}" has no matching start in this file.`,
      });
      continue;
    }
    pendingStartLine.delete(hit.id);
  }

  for (const [id, line0] of pendingStartLine) {
    issues.push({
      level: "error",
      message: `${sourcePath}:${line0 + 1}: commentray start for id "${id}" has no matching end in this file.`,
    });
  }

  return issues;
}

function markerIdFromBlock(block: { anchor: string; markerId?: string }): string | null {
  try {
    const a = parseAnchor(block.anchor);
    if (a.kind === "marker") return a.id;
  } catch {
    return null;
  }
  if (typeof block.markerId === "string" && block.markerId.trim() !== "") {
    try {
      return assertValidMarkerId(block.markerId);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Index-level rules for stable cross-references:
 * - **Error** if the same `(sourcePath, marker id)` is claimed by **different** block `id`s
 *   (e.g. two Angle files disagree).
 * - **Warn** if the same marker id string is reused across **different** source files
 *   (repo-wide ambiguity for links and search — allowed, but noisy).
 */
export function validateIndexMarkerSemantics(index: CommentrayIndex): MarkerValidationIssue[] {
  const issues: MarkerValidationIssue[] = [];
  type Loc = { sourcePath: string; commentrayPath: string; blockId: string };
  const bySourceAndMarker = new Map<string, Loc[]>();
  const byMarkerRepoWide = new Map<string, Set<string>>();

  for (const [commentrayPath, entry] of Object.entries(index.byCommentrayPath)) {
    for (const block of entry.blocks) {
      const mid = markerIdFromBlock(block);
      if (mid === null) continue;
      const key = `${entry.sourcePath}\0${mid}`;
      const loc: Loc = {
        sourcePath: entry.sourcePath,
        commentrayPath,
        blockId: block.id,
      };
      const list = bySourceAndMarker.get(key) ?? [];
      list.push(loc);
      bySourceAndMarker.set(key, list);

      const sources = byMarkerRepoWide.get(mid) ?? new Set<string>();
      sources.add(entry.sourcePath);
      byMarkerRepoWide.set(mid, sources);
    }
  }

  for (const [composite, locs] of bySourceAndMarker) {
    if (locs.length < 2) continue;
    const sep = composite.indexOf("\0");
    const sourcePath = composite.slice(0, sep);
    const mid = composite.slice(sep + 1);
    const blockIds = new Set(locs.map((l) => l.blockId));
    if (blockIds.size > 1) {
      const detail = locs.map((l) => `${l.blockId} (${l.commentrayPath})`).join(", ");
      issues.push({
        level: "error",
        message:
          `Marker id "${mid}" for source "${sourcePath}" is indexed with different block ids: ${detail}. ` +
          `One physical region should map to one block id (e.g. align Angle files or deduplicate).`,
      });
    }
  }

  for (const [mid, sources] of byMarkerRepoWide) {
    if (sources.size <= 1) continue;
    const paths = [...sources].sort((a, b) => a.localeCompare(b)).join(", ");
    issues.push({
      level: "warn",
      message:
        `Marker id "${mid}" is reused across different source files (${paths}). ` +
        `That is valid for independent regions, but ambiguous for repo-wide links — consider namespaced ids (e.g. "${mid}--dashboard", "${mid}--api").`,
    });
  }

  return issues;
}
