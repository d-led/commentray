import { defineConfig } from "@vscode/test-cli";

/**
 * VS Code extension integration tests (Extension Development Host).
 * Run from repo: bash scripts/test-vscode-extension.sh
 *
 * `VSCODE_TEST_VERSION` overrides the downloaded VS Code build (e.g. `stable`,
 * `insiders`, or an exact release like `1.95.0`). Defaults to `stable`. CI
 * should exercise at least `stable` and the same minimum as `engines.vscode`
 * in this package's package.json — see docs/development.md.
 */
const vscodeVersion = (process.env.VSCODE_TEST_VERSION ?? "").trim() || "stable";

export default defineConfig({
  files: "dist/test/suite/**/*.integration.test.js",
  workspaceFolder: "./fixtures/dogfood",
  version: vscodeVersion,
  mocha: {
    ui: "bdd",
    timeout: 60_000,
  },
  launchArgs: ["--disable-extensions"],
});
