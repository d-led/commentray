import { describe, expect, it } from "vitest";

import { hljsStylesheetThemes } from "./hljs-stylesheet-themes.js";

describe("hljsStylesheetThemes", () => {
  it("given no theme, uses github for light and github-dark for dark", () => {
    expect(hljsStylesheetThemes(undefined)).toEqual({
      hljsLight: "github",
      hljsDark: "github-dark",
    });
    expect(hljsStylesheetThemes("  ")).toEqual({
      hljsLight: "github",
      hljsDark: "github-dark",
    });
  });

  it("given a dark theme name, keeps it only for the dark color-scheme slot", () => {
    expect(hljsStylesheetThemes("github-dark")).toEqual({
      hljsLight: "github",
      hljsDark: "github-dark",
    });
  });

  it("given a light theme name, uses it for light and github-dark for dark", () => {
    expect(hljsStylesheetThemes("github")).toEqual({
      hljsLight: "github",
      hljsDark: "github-dark",
    });
  });
});
