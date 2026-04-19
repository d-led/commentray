import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverCommentrayPairsOnDisk,
  pairFromCommentraySourceRel,
} from "./commentray-disk-pairs.js";

describe("Mapping companion paths to source pairs", () => {
  it("maps flat companions using the trailing .md slice rule", () => {
    expect(pairFromCommentraySourceRel(".commentray", "README.md.md", false)).toEqual({
      sourcePath: "README.md",
      commentrayPath: ".commentray/source/README.md.md",
    });
  });

  it("maps angles companions as parent dir + angle file", () => {
    expect(pairFromCommentraySourceRel(".commentray", "README.md/main.md", true)).toEqual({
      sourcePath: "README.md",
      commentrayPath: ".commentray/source/README.md/main.md",
    });
  });
});

describe("Discovering companion pairs on disk", () => {
  it("discovers every flat companion under source", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cr-disk-flat-"));
    await mkdir(path.join(dir, ".commentray", "source", "src"), { recursive: true });
    await writeFile(path.join(dir, ".commentray", "source", "README.md.md"), "a\n", "utf8");
    await writeFile(path.join(dir, ".commentray", "source", "src", "x.ts.md"), "b\n", "utf8");
    const pairs = await discoverCommentrayPairsOnDisk(dir, ".commentray");
    expect(pairs).toEqual(
      expect.arrayContaining([
        { sourcePath: "README.md", commentrayPath: ".commentray/source/README.md.md" },
        { sourcePath: "src/x.ts", commentrayPath: ".commentray/source/src/x.ts.md" },
      ]),
    );
    expect(pairs).toHaveLength(2);
  });
});
