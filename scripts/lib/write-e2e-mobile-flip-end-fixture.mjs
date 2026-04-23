#!/usr/bin/env node
/**
 * Writes `_site/__e2e__/mobile-flip-end/index.html`: long dual-pane pair for mobile flip
 * scroll sync at document end (Cypress).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { renderCodeBrowserHtml } from "@commentray/render";

const LINE_COUNT = 100;
const crPath = ".commentray/source/e2e/mobile-flip-end.ts.md";

/**
 * @param {string} repoRoot
 */
export async function writeE2eMobileFlipEndFixture(repoRoot) {
  const b1End = 28;
  const b2End = 72;
  const index = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    byCommentrayPath: {
      [crPath]: {
        sourcePath: "e2e/mobile-flip-end.ts",
        commentrayPath: crPath,
        blocks: [
          { id: "b1", anchor: `lines:1-${b1End}` },
          { id: "b2", anchor: `lines:${b1End + 1}-${b2End}` },
          { id: "b3", anchor: `lines:${b2End + 1}-${LINE_COUNT}` },
        ],
      },
    },
  };
  const code = Array.from(
    { length: LINE_COUNT },
    (_, i) => `const v${String(i + 1)} = ${String(i + 1)};`,
  ).join("\n");
  const filler = Array.from(
    { length: 40 },
    (_, i) =>
      `Middle commentary paragraph ${String(i + 1)} with enough words to lengthen the doc pane.`,
  ).join("\n\n");
  const md =
    "<!-- commentray:block id=b1 -->\n\n## Opening\n\nShort commentary for the first source span.\n\n" +
    "<!-- commentray:block id=b2 -->\n\n## Middle\n\n" +
    filler +
    "\n\n<!-- commentray:block id=b3 -->\n\n## Tail\n\nE2E_MOBILE_FLIP_TAIL_LBL\n";

  const html = await renderCodeBrowserHtml({
    title: "E2E mobile flip end",
    filePath: "e2e/mobile-flip-end.ts",
    code,
    language: "ts",
    commentrayMarkdown: md,
    codeBrowserLayout: "dual",
    blockStretchRows: {
      index,
      sourceRelative: "e2e/mobile-flip-end.ts",
      commentrayPathRel: crPath,
    },
  });

  const outDir = path.join(repoRoot, "_site");
  const target = path.join(outDir, "__e2e__", "mobile-flip-end", "index.html");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, "utf8");
  console.log(`Wrote ${target}`);
}
