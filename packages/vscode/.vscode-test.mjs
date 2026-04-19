import { defineConfig } from "@vscode/test-cli";

/**
 * VS Code extension integration tests (Extension Development Host).
 * Run from repo: bash scripts/test-vscode-extension.sh
 */
export default defineConfig({
  files: "dist/test/suite/**/*.integration.test.js",
  workspaceFolder: "./fixtures/dogfood",
  version: "stable",
  mocha: {
    ui: "bdd",
    timeout: 60_000,
  },
  launchArgs: ["--disable-extensions"],
});
