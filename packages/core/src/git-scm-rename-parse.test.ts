import { describe, expect, it } from "vitest";
import { parseGitRenameLines } from "./scm/git-scm-provider.js";

describe("parseGitRenameLines", () => {
  it("parses tab-separated R lines from git diff --name-status", () => {
    const stdout = "M\tREADME.md\nR086\tsrc/old.ts\tsrc/new.ts\n";
    expect(parseGitRenameLines(stdout)).toEqual([{ from: "src/old.ts", to: "src/new.ts" }]);
  });

  it("ignores non-rename lines", () => {
    expect(parseGitRenameLines("A\tfoo\nD\tbar\n")).toEqual([]);
  });
});
