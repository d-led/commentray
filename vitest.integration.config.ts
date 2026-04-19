import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.integration.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      /** Runs under the VS Code test runner (`npm run test:vscode-extension`), not Vitest. */
      "packages/vscode/**",
    ],
  },
});
