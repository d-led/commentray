import { defineConfig } from "vitest/config";

import { sharedCoverageOptions } from "./vitest.shared.js";

export default defineConfig({
  test: {
    /** Required by ArchUnitTS Vitest integration (`toPassAsync` matcher). */
    globals: true,
    include: ["packages/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.integration.test.ts",
      "**/*.expensive.test.ts",
    ],
    coverage: sharedCoverageOptions,
  },
});
