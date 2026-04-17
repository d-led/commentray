/** Shared coverage defaults for root Vitest configs (keeps jscpd clean). */
export const sharedCoverageOptions = {
  provider: "v8" as const,
  reportsDirectory: "./coverage",
  reporter: ["text", "html", "lcov", "json-summary"],
  all: true,
  include: ["packages/*/src/**/*.ts"],
  exclude: [
    "**/*.test.ts",
    "**/*.integration.test.ts",
    "**/*.expensive.test.ts",
    "**/dist/**",
    "**/node_modules/**",
    "**/*.d.ts",
    "packages/**/fixtures/**",
  ],
};
