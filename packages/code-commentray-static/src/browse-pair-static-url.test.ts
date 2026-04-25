import { describe, expect, it } from "vitest";

import { browsePairStaticBrowseRelUrl } from "./browse-pair-static-url.js";

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
