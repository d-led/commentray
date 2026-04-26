import { describe, expect, it } from "vitest";

import {
  browsePairStaticBrowseRelUrl,
  canonicalHumaneBrowseRedirectHref,
} from "./browse-pair-static-url.js";

function resolvedBrowsePathname(aliasRelPath: string, href: string): string {
  const origin = "http://127.0.0.1:4173";
  /** Matches static hosts that serve `index.html` for a directory while keeping a no-trailing-slash URL in the bar. */
  const base = `${origin}/browse/${aliasRelPath}`;
  return new URL(href, base).pathname;
}

describe("canonicalHumaneBrowseRedirectHref", () => {
  const slug = "AbCdEfGh123";

  it("Given a nested humane alias, when the document URL has no trailing slash, then the redirect still lands under /browse/", () => {
    const alias = "docs/manual.md";
    const href = canonicalHumaneBrowseRedirectHref(alias, slug);
    expect(href).toBe(`../${slug}.html`);
    expect(resolvedBrowsePathname(alias, href)).toBe(`/browse/${slug}.html`);
  });

  it("Given a deeper nested alias, when the URL has no trailing slash, then the redirect still lands under /browse/", () => {
    const alias = "docs/spec/blocks.md";
    const href = canonicalHumaneBrowseRedirectHref(alias, slug);
    expect(href).toBe(`../../${slug}.html`);
    expect(resolvedBrowsePathname(alias, href)).toBe(`/browse/${slug}.html`);
  });

  it("Given a single-segment alias, then the href is sibling-style under /browse/", () => {
    const alias = "README.md";
    const href = canonicalHumaneBrowseRedirectHref(alias, slug);
    expect(href).toBe(`${slug}.html`);
    expect(resolvedBrowsePathname(alias, href)).toBe(`/browse/${slug}.html`);
  });

  it("Given src/x.ts style alias, then one ../ segment is enough for no-slash resolution", () => {
    const alias = "src/x.ts";
    const href = canonicalHumaneBrowseRedirectHref(alias, slug);
    expect(href).toBe(`../${slug}.html`);
    expect(resolvedBrowsePathname(alias, href)).toBe(`/browse/${slug}.html`);
  });

  it("Rejects the broken relative that escapes /browse/ from a no-slash manual.md URL", () => {
    const alias = "docs/manual.md";
    const broken = `../../${slug}.html`;
    expect(resolvedBrowsePathname(alias, broken)).toBe(`/${slug}.html`);
    expect(resolvedBrowsePathname(alias, broken)).not.toMatch(/^\/browse\//);
  });
});

describe("browsePairStaticBrowseRelUrl", () => {
  it("uses a directory index URL when the source path is unique in the nav", () => {
    expect(
      browsePairStaticBrowseRelUrl(
        {
          sourcePath: "src/x.ts",
          commentrayPath: ".commentray/source/src/x.ts.md",
        },
        1,
      ),
    ).toBe("./browse/src/x.ts/index.html");
  });

  it("uses a flat @angle URL when the same source is documented under multiple angles", () => {
    expect(
      browsePairStaticBrowseRelUrl(
        {
          sourcePath: "README.md",
          commentrayPath: ".commentray/source/README.md/main.md",
        },
        2,
      ),
    ).toBe("./browse/README.md@main.html");
  });

  it("uses the opaque slug for dot-leading paths so hosts do not collapse %2E to . in the URL", () => {
    expect(
      browsePairStaticBrowseRelUrl(
        {
          sourcePath: ".commentray.toml",
          commentrayPath: ".commentray/source/.commentray.toml/main.md",
        },
        1,
      ),
    ).toBe("./browse/CvkTeB-uylIXI5c5sxIID71qQtjD.html");
  });
});
