import { describe, expect, it } from "vitest";

import { defaultCommentrayStaticBrowsePathResolver } from "./browse-path-default.js";
import { staticBrowseIndexRelPathFromPair } from "./commentray-static-browse-path.js";

const STORAGE = ".commentray";

describe("staticBrowseIndexRelPathFromPair — default resolver", () => {
  it("defaultCommentrayStaticBrowsePathResolver delegates to the same implementation", () => {
    const pair = {
      sourcePath: "README.md",
      commentrayPath: ".commentray/source/README.md/main.md",
    };
    expect(
      defaultCommentrayStaticBrowsePathResolver.browseIndexRelPathFromPair(pair, STORAGE),
    ).toBe(staticBrowseIndexRelPathFromPair(pair, STORAGE));
  });
});

describe("staticBrowseIndexRelPathFromPair — core mirrors", () => {
  it("mirrors Angles storage: .commentray/source/.commentray.toml/main.md", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        {
          sourcePath: ".commentray.toml",
          commentrayPath: ".commentray/source/.commentray.toml/main.md",
        },
        STORAGE,
      ),
    ).toBe(".commentray.toml/main/index.html");
  });

  it("mirrors flat companion: .commentray/source/src/x.ts.md", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "src/x.ts", commentrayPath: ".commentray/source/src/x.ts.md" },
        STORAGE,
      ),
    ).toBe("src/x.ts/index.html");
  });

  it("mirrors README multi-angle: README.md/main.md", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "README.md", commentrayPath: ".commentray/source/README.md/main.md" },
        STORAGE,
      ),
    ).toBe("README.md/main/index.html");
  });

  it("mirrors a second angle path under the same source filename", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        {
          sourcePath: "README.md",
          commentrayPath: ".commentray/source/README.md/architecture.md",
        },
        STORAGE,
      ),
    ).toBe("README.md/architecture/index.html");
  });

  it("falls back to encoded repo source path when commentray is outside storage/source", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "pkg/x.ts", commentrayPath: "weird/elsewhere.md" },
        STORAGE,
      ),
    ).toBe("pkg/x.ts/index.html");
  });

  it("uses custom storageDir prefix when mirroring", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "a.ts", commentrayPath: "docs-cr/source/a.ts/main.md" },
        "docs-cr",
      ),
    ).toBe("a.ts/main/index.html");
  });

  it("normalizes Windows separators on commentrayPath and storageDir", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "src\\x.ts", commentrayPath: ".commentray\\source\\src\\x.ts.md" },
        ".commentray",
      ),
    ).toBe("src/x.ts/index.html");
  });
});

describe("staticBrowseIndexRelPathFromPair — dotfiles and path shape", () => {
  it("mirrors dotfile companion at repo root: .gitignore.md flat layout", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        {
          sourcePath: ".gitignore",
          commentrayPath: ".commentray/source/.gitignore.md",
        },
        STORAGE,
      ),
    ).toBe(".gitignore/index.html");
  });

  it("mirrors dot-directory segment in the middle: packages/.internal/readme.md", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        {
          sourcePath: "packages/.internal/readme.ts",
          commentrayPath: ".commentray/source/packages/.internal/readme.ts.md",
        },
        STORAGE,
      ),
    ).toBe("packages/.internal/readme.ts/index.html");
  });

  it("mirrors angles under nested dot dir: pkg/.rc/custom/main.md", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        {
          sourcePath: "pkg/.rc/custom.ts",
          commentrayPath: ".commentray/source/pkg/.rc/custom.ts/main.md",
        },
        STORAGE,
      ),
    ).toBe("pkg/.rc/custom.ts/main/index.html");
  });

  it("treats .md case-insensitively for mirror branch", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "X.ts", commentrayPath: ".commentray/source/X.ts.MD" },
        STORAGE,
      ),
    ).toBe("X.ts/index.html");
  });

  it("strips redundant ./ segments after normalization", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "a/b.ts", commentrayPath: ".commentray/source/./a/b.ts.md" },
        STORAGE,
      ),
    ).toBe("a/b.ts/index.html");
  });
});

describe("staticBrowseIndexRelPathFromPair — fallback and validation", () => {
  it("falls back when companion under storage/source is not markdown", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "notes.txt", commentrayPath: ".commentray/source/notes.txt" },
        STORAGE,
      ),
    ).toBe("notes.txt/index.html");
  });

  it("falls back with encoded dot-leading source segments", () => {
    expect(
      staticBrowseIndexRelPathFromPair(
        { sourcePath: ".env.local", commentrayPath: "orphan.md" },
        STORAGE,
      ),
    ).toBe("%2Eenv.local/index.html");
  });

  it("falls back to pair/index.html when sourcePath is empty and commentray is outside prefix", () => {
    expect(
      staticBrowseIndexRelPathFromPair({ sourcePath: "", commentrayPath: "x.md" }, STORAGE),
    ).toBe("pair/index.html");
  });

  it("rejects sourcePath that escapes the repo", () => {
    expect(() =>
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "../evil.ts", commentrayPath: "x.md" },
        STORAGE,
      ),
    ).toThrow(/escapes repository root/);
  });

  it("rejects commentrayPath that escapes the repo", () => {
    expect(() =>
      staticBrowseIndexRelPathFromPair(
        { sourcePath: "a.ts", commentrayPath: ".commentray/source/../secret.md" },
        STORAGE,
      ),
    ).toThrow(/escapes repository root/);
  });
});
