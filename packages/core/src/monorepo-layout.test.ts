import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { findMonorepoPackagesDir, monorepoLayoutStartDir } from "./monorepo-layout.js";

describe("findMonorepoPackagesDir", () => {
  it("finds packages/ from this test file under packages/core", () => {
    const start = path.dirname(fileURLToPath(import.meta.url));
    const pkgs = findMonorepoPackagesDir(start);
    expect(existsSync(path.join(pkgs, "render", "package.json"))).toBe(true);
    expect(existsSync(path.join(pkgs, "core", "package.json"))).toBe(true);
  });

  it("finds packages/ from a nested dist path", () => {
    const start = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
    const pkgs = findMonorepoPackagesDir(start);
    expect(path.basename(pkgs)).toBe("packages");
  });
});

describe("monorepoLayoutStartDir", () => {
  it("uses import.meta.url when it is a non-empty string", () => {
    const u = import.meta.url;
    const dir = monorepoLayoutStartDir(u);
    expect(dir).toBe(path.dirname(fileURLToPath(u)));
  });

  it("falls back to argv[1] when import meta url is empty", () => {
    const dir = monorepoLayoutStartDir("");
    const entry = process.argv[1];
    if (entry === undefined) {
      throw new Error("expected process.argv[1] when running under vitest/node");
    }
    expect(dir).toBe(path.dirname(path.resolve(entry)));
  });
});
