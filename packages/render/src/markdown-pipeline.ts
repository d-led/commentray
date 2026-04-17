import type { Code, Html, Root } from "mdast";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { escapeHtml } from "./html-utils.js";

function remarkMermaidPlaceholders() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (node.lang !== "mermaid" || parent === undefined || index === undefined) return;
      const value = node.value;
      const html: Html = {
        type: "html",
        value: `<div class="commentray-mermaid"><pre class="mermaid"><code>${escapeHtml(
          value,
        )}</code></pre></div>`,
      };
      parent.children[index] = html;
    });
  };
}

const sanitizeSchema = structuredClone(defaultSchema);

sanitizeSchema.attributes = {
  ...sanitizeSchema.attributes,
  code: [...(sanitizeSchema.attributes?.code ?? []), "className"],
  pre: [...(sanitizeSchema.attributes?.pre ?? []), "className"],
  span: [...(sanitizeSchema.attributes?.span ?? []), "className"],
  div: ["className"],
};

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMermaidPlaceholders)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

export async function renderFencedCode(markdownFence: string): Promise<string> {
  return renderMarkdownToHtml(markdownFence);
}
