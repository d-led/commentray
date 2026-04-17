import { describe, expect, it } from "vitest";

import {
  COMMENTARY_HOOK_BEGIN,
  mergeCommentaryPreCommitHook,
  normalizeHookNewlines,
} from "./git-hooks.js";

describe("mergeCommentaryPreCommitHook", () => {
  it("creates a shell hook when the file is empty", () => {
    const out = mergeCommentaryPreCommitHook("");
    expect(out).toContain("#!/bin/sh");
    expect(out).toContain(COMMENTARY_HOOK_BEGIN);
    expect(out).toContain("commentary_bin=");
  });

  it("appends a block to an existing hook without markers", () => {
    const prior = "#!/bin/sh\necho hi\n";
    const out = mergeCommentaryPreCommitHook(prior);
    expect(out.startsWith("#!/bin/sh")).toBe(true);
    expect(out).toContain("echo hi");
    expect(out.indexOf(COMMENTARY_HOOK_BEGIN)).toBeGreaterThan(out.indexOf("echo hi"));
  });

  it("replaces an existing managed block on re-run", () => {
    const first = mergeCommentaryPreCommitHook("");
    const second = mergeCommentaryPreCommitHook(
      first.replace("commentary_bin=", "commentary_bin=SHOULD_BE_GONE"),
    );
    expect(second).toContain("commentary_bin=");
    expect(second).not.toContain("SHOULD_BE_GONE");
  });

  it("preserves user content after the managed block", () => {
    const base = mergeCommentaryPreCommitHook("#!/bin/sh\necho before\n");
    const withTail = `${base}echo after\n`;
    const replaced = mergeCommentaryPreCommitHook(withTail);
    expect(replaced).toContain("echo after");
  });
});

describe("normalizeHookNewlines", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeHookNewlines("a\r\nb")).toBe("a\nb");
  });
});
