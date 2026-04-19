import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    ignores: [
      "**/dist/**",
      "**/out/**",
      "coverage/**",
      "**/*.mjs",
      "eslint.config.mjs",
      "packages/vscode/fixtures/**",
      "cypress/**",
      "cypress.config.ts",
    ],
  },
  {
    files: ["packages/cli/src/**/*.ts", "packages/code-commentray-static/src/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  /** Node CommonJS scripts (`require`, `__dirname`) — keep `require` and Node globals allowed. */
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        console: "readonly",
        exports: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
      sourceType: "script",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
