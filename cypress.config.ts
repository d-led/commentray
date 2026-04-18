import { defineConfig } from "cypress";

export default defineConfig({
  reporter: "mocha-junit-reporter",
  reporterOptions: {
    mochaFile: "test-results/junit-[hash].xml",
  },
  video: true,
  videoCompression: true,
  env: {
    CI: `${process.env.CYPRESS_CI}` === "true",
  },
  e2e: {
    baseUrl: "http://127.0.0.1:4173",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    excludeSpecPattern: "**/screenshot*.cy.ts",
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      on("before:browser:launch", (browser, launchOptions) => {
        // Chrome on Linux (GitLab, GitHub runners): typical CI flags. Omit on macOS/Windows
        // where they can break Cypress’s own launch / smoke-test flow.
        if (
          process.platform === "linux" &&
          browser.family === "chromium" &&
          browser.name !== "electron"
        ) {
          launchOptions.args.push("--no-sandbox");
          launchOptions.args.push("--disable-dev-shm-usage");
        }
        return launchOptions;
      });
      return config;
    },
  },
});
