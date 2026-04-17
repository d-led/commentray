# @commentray/render

Markdown → HTML rendering stack for [Commentray](https://github.com/d-led/commentray): remark + GFM, `rehype-sanitize`, `rehype-highlight` (lowlight), Mermaid containers, and ready-made HTML shells (side-by-side and a client-side interactive code browser with in-page token search).

## Install

```bash
npm install @commentray/render
```

## Use

```ts
import { renderSideBySideHtml } from "@commentray/render";

const html = await renderSideBySideHtml({
  title: "src/example.ts",
  code: sourceText,
  language: "ts",
  commentrayMarkdown: markdownText,
});
```

The package ships a bundled browser client for the code-browser shell; no extra build step is required in your project.

## License

[MPL-2.0](./LICENSE)
