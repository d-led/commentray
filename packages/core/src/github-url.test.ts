import { describe, expect, it } from "vitest";

import { parseGithubRepoWebUrl } from "./github-url.js";

describe("parseGithubRepoWebUrl", () => {
  it("parses canonical https URLs", () => {
    expect(parseGithubRepoWebUrl("https://github.com/d-led/commentray")).toEqual({
      owner: "d-led",
      repo: "commentray",
    });
  });

  it("accepts trailing slash, .git suffix, and http", () => {
    expect(parseGithubRepoWebUrl("http://github.com/foo/bar.git/")).toEqual({
      owner: "foo",
      repo: "bar",
    });
  });

  it("returns null for blob paths, other hosts, or malformed input", () => {
    expect(parseGithubRepoWebUrl("https://github.com/d-led/commentray/blob/main/README.md")).toBe(
      null,
    );
    expect(parseGithubRepoWebUrl("https://gitlab.com/a/b")).toBe(null);
    expect(parseGithubRepoWebUrl("not a url")).toBe(null);
  });
});
