import { describe, expect, it } from "vitest";

import {
  COMMENTRAY_HOOK_BEGIN,
  mergeCommentrayPreCommitHook,
  normalizeHookNewlines,
} from "./git-hooks.js";

describe("Merging the Commentray pre-commit hook script", () => {
  it("creates a shell hook when the file is empty", () => {
    const out = mergeCommentrayPreCommitHook("");
    expect(out).toContain("#!/bin/sh");
    expect(out).toContain(COMMENTRAY_HOOK_BEGIN);
    expect(out).toContain("commentray_bin=");
  });

  it("appends a block to an existing hook without markers", () => {
    const prior = "#!/bin/sh\necho hi\n";
    const out = mergeCommentrayPreCommitHook(prior);
    expect(out.startsWith("#!/bin/sh")).toBe(true);
    expect(out).toContain("echo hi");
    expect(out.indexOf(COMMENTRAY_HOOK_BEGIN)).toBeGreaterThan(out.indexOf("echo hi"));
  });

  it("replaces an existing managed block on re-run", () => {
    const first = mergeCommentrayPreCommitHook("");
    const second = mergeCommentrayPreCommitHook(
      first.replace("commentray_bin=", "commentray_bin=SHOULD_BE_GONE"),
    );
    expect(second).toContain("commentray_bin=");
    expect(second).not.toContain("SHOULD_BE_GONE");
  });

  it("preserves user content after the managed block", () => {
    const base = mergeCommentrayPreCommitHook("#!/bin/sh\necho before\n");
    const withTail = `${base}echo after\n`;
    const replaced = mergeCommentrayPreCommitHook(withTail);
    expect(replaced).toContain("echo after");
  });

  it("removes legacy commentary-cli-hook block when inserting the new one", () => {
    const legacy =
      "#!/bin/sh\n# <<<< commentary-cli-hook v1 BEGIN >>>>\nold\n# <<<< commentary-cli-hook v1 END >>>>\n";
    const out = mergeCommentrayPreCommitHook(legacy);
    expect(out).not.toContain("commentary-cli-hook");
    expect(out).toContain(COMMENTRAY_HOOK_BEGIN);
    expect(out).toContain("commentray_bin=");
  });
});

describe("Normalising hook script line endings", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeHookNewlines("a\r\nb")).toBe("a\nb");
  });
});
