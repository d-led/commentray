# `cli.ts` — commentray

Commander is the table read: **`init`**, **`init config`**, **`init scm`**, **`validate`**, **`doctor`**, **`migrate`**, **`paths`**, **`render`**. The version string is read from **this** package’s `package.json` (JSON import) so SEA bundles and plain `node` never improvise different numbers.

**Split** — `validate` is for machines (CI, hooks). `doctor` is for humans who want environment noise in the same pass. `paths` exists so scripts and editors can ask “where’s the **commentray** for this source file?” without reimplementing path rules.

**Binaries** — [`binaries.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/binaries.yml) on **`v*`** tags; local smoke stays **`npm run binary:smoke`**.
