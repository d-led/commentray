import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    ignores: ["**/dist/**", "**/out/**", "coverage/**", "**/*.mjs", "eslint.config.mjs"],
  },
  {
    files: ["packages/cli/src/**/*.ts", "packages/code-commentray-static/src/**/*.ts"],
    rules: {
      "no-console": "off",
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
