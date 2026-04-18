import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CURRENT_SCHEMA_VERSION } from "@commentray/core";
import { describe, expect, it } from "vitest";

import { buildCommentrayNavSearchDocument } from "./build-commentray-nav-search.js";

describe("buildCommentrayNavSearchDocument", () => {
  it("indexes paths and commentray lines from metadata, not primary source", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-nav-"));
    const cr = ".commentray/source/src/a.ts.md";
    await mkdir(path.join(dir, path.dirname(cr)), { recursive: true });
    await writeFile(path.join(dir, cr), "# Title\n\nHello.\n", "utf8");
    await mkdir(path.join(dir, ".commentray/metadata"), { recursive: true });
    await writeFile(
      path.join(dir, ".commentray/metadata/index.json"),
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        byCommentrayPath: {
          [cr]: { sourcePath: "src/a.ts", commentrayPath: cr, blocks: [] },
        },
      }),
      "utf8",
    );

    const doc = await buildCommentrayNavSearchDocument(dir);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.rows.some((r) => r.kind === "sourcePath" && r.sourcePath === "src/a.ts")).toBe(true);
    expect(doc.rows.some((r) => r.kind === "commentrayPath" && r.commentrayPath === cr)).toBe(true);
    const lines = doc.rows.filter((r) => r.kind === "commentrayLine");
    expect(lines.map((r) => r.text)).toEqual(["# Title", "", "Hello.", ""]);
    expect(lines[0]?.line).toBe(0);
  });

  it("uses fallback when index is absent and still omits source file contents", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-nav-"));
    const mdAbs = path.join(dir, "notes.md");
    await writeFile(mdAbs, "One\nTwo\n", "utf8");

    const doc = await buildCommentrayNavSearchDocument(dir, {
      sourcePath: "lib/x.ts",
      commentrayPath: ".commentray/source/lib/x.ts.md",
      markdownAbs: mdAbs,
    });

    expect(doc.rows.filter((r) => r.kind === "sourcePath")).toHaveLength(1);
    expect(doc.rows.filter((r) => r.kind === "commentrayLine").map((r) => r.text)).toEqual([
      "One",
      "Two",
      "",
    ]);
  });
});
