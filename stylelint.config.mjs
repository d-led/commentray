/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "**/node_modules/**",
    "**/dist/**",
    "**/out/**",
    "coverage/**",
    "**/.vscode-test/**",
    "**/.cache/**",
  ],
  rules: {
    /** System UI colors (`Canvas`, `CanvasText`) are valid in modern CSS. */
    "value-keyword-case": null,
  },
};
