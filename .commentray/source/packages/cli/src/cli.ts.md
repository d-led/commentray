# `cli.ts` — commentray

Commander registers **`init`**, **`init config`**, **`init scm`**, **`validate`**, **`doctor`**, **`migrate`**, **`paths`**, **`render`**. The version string comes from **this** package’s `package.json` (JSON import) so SEA bundles and plain `node` agree on one number.

**Split** — `validate` is for machines (CI, hooks). `doctor` adds environment checks for humans. `paths` answers “where is the commentray for this source path?” without reimplementing storage rules.

**Binaries** — [`binaries.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/binaries.yml) on **`v*`** tags; local smoke: **`npm run binary:smoke`**.
