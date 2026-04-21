import { describe, expect, it } from "vitest";

import {
  COMMENTRAY_COLOR_THEME_STORAGE_KEY,
  commentrayColorThemeHeadBoot,
  nextCommentrayColorThemeMode,
  parseCommentrayColorThemeMode,
} from "./code-browser-color-theme.js";

describe("parseCommentrayColorThemeMode", () => {
  it("given null or unknown, returns system", () => {
    expect(parseCommentrayColorThemeMode(null)).toBe("system");
    expect(parseCommentrayColorThemeMode(undefined)).toBe("system");
    expect(parseCommentrayColorThemeMode("")).toBe("system");
    expect(parseCommentrayColorThemeMode("nope")).toBe("system");
  });

  it("given light, dark, or system, returns that mode", () => {
    expect(parseCommentrayColorThemeMode("light")).toBe("light");
    expect(parseCommentrayColorThemeMode("dark")).toBe("dark");
    expect(parseCommentrayColorThemeMode("system")).toBe("system");
  });
});

describe("nextCommentrayColorThemeMode", () => {
  it("cycles system then light then dark then system", () => {
    expect(nextCommentrayColorThemeMode("system")).toBe("light");
    expect(nextCommentrayColorThemeMode("light")).toBe("dark");
    expect(nextCommentrayColorThemeMode("dark")).toBe("system");
  });
});

describe("commentrayColorThemeHeadBoot", () => {
  it("should reference the storage key and hljs link ids", () => {
    const s = commentrayColorThemeHeadBoot();
    expect(s).toContain(COMMENTRAY_COLOR_THEME_STORAGE_KEY);
    expect(s).toContain("commentray-hljs-light");
    expect(s).toContain("commentray-hljs-dark");
    expect(s).toContain("localStorage.getItem");
  });
});
