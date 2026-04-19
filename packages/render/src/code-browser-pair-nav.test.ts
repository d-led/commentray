import { describe, expect, it } from "vitest";

import {
  findDocumentedPair,
  isSameDocumentedPair,
  normPosixPath,
  resolveStaticBrowseHref,
  siteRootPathnameFromPathname,
} from "./code-browser-pair-nav.js";

describe("normPosixPath", () => {
  it("should trim and normalize slashes", () => {
    expect(normPosixPath(" ./foo/bar ")).toBe("foo/bar");
  });
});

describe("siteRootPathnameFromPathname", () => {
  it("should strip /browse/... so browse links resolve from the hub root", () => {
    expect(siteRootPathnameFromPathname("/repo/browse/abc.html")).toBe("/repo");
    expect(siteRootPathnameFromPathname("/browse/abc.html")).toBe("/");
  });

  it("should strip the filename for the hub index", () => {
    expect(siteRootPathnameFromPathname("/repo/index.html")).toBe("/repo");
    expect(siteRootPathnameFromPathname("/index.html")).toBe("/");
  });
});

describe("resolveStaticBrowseHref", () => {
  it("should prefix ./browse/ from the site root, not double /browse/ when already under browse", () => {
    const origin = "https://pages.github.io";
    expect(
      resolveStaticBrowseHref("./browse/slug.html", "/repo/browse/current.html", origin),
    ).toBe("https://pages.github.io/repo/browse/slug.html");
    expect(resolveStaticBrowseHref("./browse/slug.html", "/repo/index.html", origin)).toBe(
      "https://pages.github.io/repo/browse/slug.html",
    );
  });
});

describe("findDocumentedPair", () => {
  const pairs = [
    {
      sourcePath: "README.md",
      commentrayPath: ".commentray/source/README.md/main.md",
      commentrayOnGithub: "https://github.com/x/blob/y/main.md",
    },
    {
      sourcePath: "docs/a.md",
      commentrayPath: ".commentray/source/docs/a.md/main.md",
      commentrayOnGithub: "https://github.com/x/blob/y/a.md",
    },
  ];

  it("should match by commentray path first", () => {
    const p = findDocumentedPair(pairs, ".commentray/source/docs/a.md/main.md", "");
    expect(p?.sourcePath).toBe("docs/a.md");
  });

  it("should match by source path when commentray is empty", () => {
    const p = findDocumentedPair(pairs, "", "docs/a.md");
    expect(p?.commentrayPath).toBe(".commentray/source/docs/a.md/main.md");
  });
});

describe("isSameDocumentedPair", () => {
  it("should compare normalized paths", () => {
    const p = {
      sourcePath: "README.md",
      commentrayPath: ".commentray/source/README.md/main.md",
      commentrayOnGithub: "x",
    };
    expect(isSameDocumentedPair(p, "README.md", ".commentray/source/README.md/main.md")).toBe(
      true,
    );
    expect(isSameDocumentedPair(p, "other.md", ".commentray/source/README.md/main.md")).toBe(
      false,
    );
  });
});
