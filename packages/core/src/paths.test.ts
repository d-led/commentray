import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  commentrayAnglesLayoutEnabled,
  commentrayAnglesSentinelPath,
  commentrayMarkdownPath,
  commentrayMarkdownPathForAngle,
  normalizeRepoRelativePath,
  resolvePathUnderRepoRoot,
} from "./paths.js";

describe("normalizeRepoRelativePath", () => {
  it("normalizes Windows separators to POSIX", () => {
    expect(normalizeRepoRelativePath("src\\a.ts")).toBe("src/a.ts");
  });

  it("rejects traversal segments regardless of position", () => {
    expect(() => normalizeRepoRelativePath("../escape")).toThrow(/escapes/);
    expect(() => normalizeRepoRelativePath("src/../etc")).toThrow(/escapes/);
    expect(() => normalizeRepoRelativePath("..")).toThrow(/escapes/);
  });

  it("rejects absolute paths with a Windows drive letter", () => {
    expect(() => normalizeRepoRelativePath("C:\\Windows\\System32")).toThrow(/absolute/);
  });

  it("strips a leading absolute-root slash (defense in depth)", () => {
    expect(normalizeRepoRelativePath("/src/a.ts")).toBe("src/a.ts");
  });

  it("allows filenames that merely contain dots", () => {
    expect(normalizeRepoRelativePath("src/..name.ts")).toBe("src/..name.ts");
    expect(normalizeRepoRelativePath("src/foo..bar.ts")).toBe("src/foo..bar.ts");
  });

  it("collapses redundant current-directory segments", () => {
    expect(normalizeRepoRelativePath("./src/./a.ts")).toBe("src/a.ts");
  });
});

describe("resolvePathUnderRepoRoot", () => {
  const root = path.join(os.tmpdir(), `commentray-root-${process.pid}`);

  it("resolves a safe repo-relative path under the root", () => {
    const got = resolvePathUnderRepoRoot(root, "src/a.ts");
    expect(got).toBe(path.resolve(root, "src", "a.ts"));
  });

  it("rejects traversal even when segments look plausible", () => {
    expect(() => resolvePathUnderRepoRoot(root, "src/../../etc/passwd")).toThrow(/escapes/);
  });
});

describe("commentrayMarkdownPath", () => {
  it("appends .md under .commentray/source", () => {
    expect(commentrayMarkdownPath("src/a.ts")).toBe(".commentray/source/src/a.ts.md");
  });

  it("honours a custom storage dir", () => {
    expect(commentrayMarkdownPath("src/a.ts", "var/commentray")).toBe(
      "var/commentray/source/src/a.ts.md",
    );
  });
});

describe("Angles paths", () => {
  it("places the sentinel under storage/source/.default", () => {
    expect(commentrayAnglesSentinelPath()).toBe(".commentray/source/.default");
    expect(commentrayAnglesSentinelPath("var/commentray")).toBe("var/commentray/source/.default");
  });

  it("maps source + angle id to a file under source/<P>/<id>.md", () => {
    expect(commentrayMarkdownPathForAngle("README.md", "architecture")).toBe(
      ".commentray/source/README.md/architecture.md",
    );
  });

  it("rejects invalid angle ids", () => {
    expect(() => commentrayMarkdownPathForAngle("README.md", "../evil")).toThrow(
      /Invalid angle id/,
    );
  });

  it("commentrayAnglesLayoutEnabled reflects presence of the sentinel file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commentray-ang-"));
    const storage = path.join(dir, ".commentray");
    fs.mkdirSync(path.join(storage, "source"), { recursive: true });
    expect(commentrayAnglesLayoutEnabled(dir)).toBe(false);
    fs.writeFileSync(path.join(storage, "source", ".default"), "", "utf8");
    expect(commentrayAnglesLayoutEnabled(dir)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
