import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "@commentray/core";

import { runMigrateAnglesFromCwd } from "./migrate-angles-cmd.js";

describe("runMigrateAnglesFromCwd", () => {
  it("given a flat companion and index entry, moves files and rewrites index keys", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "commentray-migrate-ang-"));
    try {
      await mkdir(path.join(dir, ".commentray", "source"), { recursive: true });
      await mkdir(path.join(dir, ".commentray", "metadata"), { recursive: true });
      await writeFile(path.join(dir, ".commentray", "source", "README.md.md"), "# c\n", "utf8");
      await writeFile(
        path.join(dir, ".commentray", "metadata", "index.json"),
        JSON.stringify(
          {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            byCommentrayPath: {
              ".commentray/source/README.md.md": {
                sourcePath: "README.md",
                commentrayPath: ".commentray/source/README.md.md",
                blocks: [],
              },
            },
          },
          null,
          2,
        ),
        "utf8",
      );
      await writeFile(
        path.join(dir, ".commentray.toml"),
        `[storage]
dir = ".commentray"

[static_site]
source_file = "README.md"
commentray_markdown = ".commentray/source/README.md.md"
`,
        "utf8",
      );

      expect(
        await runMigrateAnglesFromCwd({ angleId: "main", dryRun: false, repoRootOverride: dir }),
      ).toBe(0);
      const moved = await readFile(
        path.join(dir, ".commentray", "source", "README.md", "main.md"),
        "utf8",
      );
      expect(moved).toContain("# c");
      const idx = JSON.parse(
        await readFile(path.join(dir, ".commentray", "metadata", "index.json"), "utf8"),
      ) as {
        byCommentrayPath: Record<string, { commentrayPath: string }>;
      };
      const keys = Object.keys(idx.byCommentrayPath);
      expect(keys).toEqual([".commentray/source/README.md/main.md"]);
      expect(idx.byCommentrayPath[keys[0] ?? ""]?.commentrayPath).toBe(keys[0]);
      const toml = await readFile(path.join(dir, ".commentray.toml"), "utf8");
      expect(toml).toContain("default_angle");
      expect(toml).toContain(".commentray/source/README.md/main.md");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("given dry run, does not write sentinel or move files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "commentray-migrate-ang-dr-"));
    try {
      await mkdir(path.join(dir, ".commentray", "source"), { recursive: true });
      await writeFile(path.join(dir, ".commentray", "source", "a.ts.md"), "x\n", "utf8");
      expect(
        await runMigrateAnglesFromCwd({ angleId: "main", dryRun: true, repoRootOverride: dir }),
      ).toBe(0);
      const flatStill = await readFile(path.join(dir, ".commentray", "source", "a.ts.md"), "utf8");
      expect(flatStill).toBe("x\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
