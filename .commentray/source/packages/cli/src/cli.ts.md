# `cli.ts` — companion

Commander entry: **`init`**, **`init config`**, **`init scm`**, **`validate`**, **`doctor`**, **`migrate`**, **`paths`**, **`render`**. Version string comes from this package’s `package.json` (JSON import) so **SEA** bundles and plain `node` agree.

## Operational split

| Command    | Typical use                                                  |
| ---------- | ------------------------------------------------------------ |
| `validate` | CI + hooks — schema and anchor checks                        |
| `doctor`   | Human preflight — validate + environment                     |
| `paths`    | Scripts / editors — resolve companion path for a source file |

## Binary story

[`binaries.yml`](https://github.com/d-led/commentray/blob/main/.github/workflows/binaries.yml) publishes OS/arch builds on **`v*`** tags; local smoke: `npm run binary:smoke`.
