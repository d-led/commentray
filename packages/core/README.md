# @commentray/core

Models, TOML config parsing, JSON metadata validation + migrations, Git SCM adapter, and staleness helpers for [Commentray](https://github.com/d-led/commentray) — a side-by-side "commentary track" for code.

This package is the library all other Commentray packages build on. It has no UI and no process side-effects.

## Install

```bash
npm install @commentray/core
```

## Use

```ts
import { commentrayMarkdownPath, loadCommentrayConfig, validateProject } from "@commentray/core";

const config = await loadCommentrayConfig(process.cwd());
const report = await validateProject(process.cwd());
for (const issue of report.issues) {
  console.log(issue.level, issue.message);
}
```

Paths, schema, and anchor grammar are specified under [`docs/spec/`](https://github.com/d-led/commentray/tree/main/docs/spec) in the monorepo.

## License

[MPL-2.0](./LICENSE)
