import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.expensive.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
