import {
  findCommentrayBlockMarkerHits,
  recoverSourceMarkersFromSnippet,
  snippetFromRange,
} from "./blocks.js";
import { parseCommentrayRegionBoundary } from "./source-markers.js";
import type { CommentrayIndex } from "./model.js";

export function healSourceFile(args: {
  sourceText: string;
  languageId: string;
  companionMarkdown: string;
  index: CommentrayIndex;
  commentrayPath: string;
}): {
  sourceText: string;
  index: CommentrayIndex;
  healedCount: number;
} {
  const markdownHits = findCommentrayBlockMarkerHits(args.companionMarkdown);
  const entry = args.index.byCommentrayPath[args.commentrayPath];
  if (!entry) {
    return { sourceText: args.sourceText, index: args.index, healedCount: 0 };
  }

  let currentSourceText = args.sourceText;
  let healedCount = 0;
  const updatedBlocks = [...entry.blocks];

  for (const hit of markdownHits) {
    const blockIndex = updatedBlocks.findIndex((b) => b.id === hit.id);
    if (blockIndex === -1) continue;
    const block = updatedBlocks[blockIndex];
    if (!block) continue;

    if (!hasRegionInSource(currentSourceText, block.id)) {
      const recovery = recoverSourceMarkersFromSnippet({
        sourceText: currentSourceText,
        languageId: args.languageId,
        block,
      });

      if (recovery.healed && recovery.range) {
        currentSourceText = recovery.sourceText;
        healedCount++;

        // Update block snippet in index based on healed source location
        const newSnippet = snippetFromRange(currentSourceText, recovery.range);
        updatedBlocks[blockIndex] = {
          ...block,
          snippet: newSnippet,
        };
      }
    }
  }

  if (healedCount === 0) {
    return { sourceText: args.sourceText, index: args.index, healedCount: 0 };
  }

  const nextByCommentrayPath = {
    ...args.index.byCommentrayPath,
    [args.commentrayPath]: {
      ...entry,
      blocks: updatedBlocks,
    },
  };

  return {
    sourceText: currentSourceText,
    index: {
      ...args.index,
      byCommentrayPath: nextByCommentrayPath,
    },
    healedCount,
  };
}

function hasRegionInSource(sourceText: string, markerId: string): boolean {
  const normalized = markerId.toLowerCase();
  const lines = sourceText.split("\n");
  for (const line of lines) {
    const hit = parseCommentrayRegionBoundary(line);
    if (hit && hit.id.toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}
