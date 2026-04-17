import { defineConfig } from "vitest/config";

import { sharedCoverageOptions } from "./vitest.shared.js";

/** Unit + integration tests with coverage (excludes expensive suite). */
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "packages/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.expensive.test.ts"],
    coverage: sharedCoverageOptions,
  },
});
