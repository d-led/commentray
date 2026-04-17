import path from "node:path";

import type { Code, Definition, Html, Image, Link, Root as MdastRoot } from "mdast";
import type { Element, Root as HastRoot } from "hast";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { escapeHtml } from "./html-utils.js";

export type GithubBlobLinkRewriteOptions = {
  owner: string;
  repo: string;
  /** Absolute path to the HTML file being generated (used to compute relative `href`s). */
  htmlOutputFileAbs: string;
  /** Absolute repository root; rewritten targets must stay under this directory. */
  repoRootAbs: string;
};

export type MarkdownPipelineOptions = {
  /**
   * When set, `https://github.com/<owner>/<repo>/blob|tree/<branch>/path` in Markdown becomes
   * an `href` (or `img` `src`) relative to `htmlOutputFileAbs`, pointing at `repoRootAbs/path`.
   */
  githubBlobLinkRewrite?: GithubBlobLinkRewriteOptions;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripUrlQueryAndHash(s: string): string {
  let end = s.length;
  const q = s.indexOf("?");
  const h = s.indexOf("#");
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return s.slice(0, end);
}

function tryExtractRepoFilePathFromGithubUrl(
  url: string,
  owner: string,
  repo: string,
): string | null {
  const re = new RegExp(
    `^https://github\\.com/${escapeRegExp(owner)}/${escapeRegExp(repo)}/(?:blob|tree)/[^/]+/(.+)$`,
    "i",
  );
  const m = re.exec(url.trim());
  if (!m) return null;
  let tail = m[1];
  try {
    tail = decodeURIComponent(tail);
  } catch {
    // keep encoded path
  }
  return stripUrlQueryAndHash(tail);
}

function remarkGithubBlobToRepoPaths(opts: { owner: string; repo: string }) {
  const { owner, repo } = opts;
  return (tree: MdastRoot) => {
    const rewrite = (url: string): string | null => {
      const next = tryExtractRepoFilePathFromGithubUrl(url, owner, repo);
      return next ? next.replace(/\\/g, "/") : null;
    };
    visit(tree, "link", (node: Link) => {
      const next = rewrite(node.url);
      if (next) node.url = next;
    });
    visit(tree, "image", (node: Image) => {
      const next = rewrite(node.url);
      if (next) node.url = next;
    });
    visit(tree, "definition", (node: Definition) => {
      const next = rewrite(node.url);
      if (next) node.url = next;
    });
  };
}

function posixHref(fsPath: string): string {
  return fsPath.split(path.sep).join("/");
}

function rehypeRelativizeRepoLinks(opts: { repoRootAbs: string; htmlOutputFileAbs: string }) {
  const repoRoot = path.resolve(opts.repoRootAbs);
  const htmlDir = path.dirname(path.resolve(opts.htmlOutputFileAbs));

  function adjustUrl(raw: string): string | null {
    const href = raw.trim();
    if (!href || href.startsWith("#")) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(href)) return null;
    if (href.startsWith("//")) return null;
    if (href.startsWith(".")) return null;

    const normalized = href.replace(/^\.\/+/, "").replace(/\\/g, "/");
    if (normalized.includes("://")) return null;

    const segments = normalized.split("/").filter((s) => s && s !== "." && s !== "..");
    const targetAbs = path.normalize(path.join(repoRoot, ...segments));
    const relToRepo = path.relative(repoRoot, targetAbs);
    if (relToRepo.startsWith("..") || path.isAbsolute(relToRepo)) return null;

    const out = path.relative(htmlDir, targetAbs);
    if (path.isAbsolute(out)) return null;

    return posixHref(out);
  }

  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a" && node.tagName !== "img") return;
      const key = node.tagName === "a" ? "href" : "src";
      const raw = node.properties?.[key];
      if (typeof raw !== "string") return;
      const next = adjustUrl(raw);
      if (next == null) return;
      node.properties ??= {};
      node.properties[key] = next;
    });
  };
}

function remarkMermaidPlaceholders() {
  return (tree: MdastRoot) => {
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

export async function renderMarkdownToHtml(
  markdown: string,
  options?: MarkdownPipelineOptions,
): Promise<string> {
  const rewriter = options?.githubBlobLinkRewrite;
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(function remarkGithubBlobMaybe() {
      return (tree: MdastRoot) => {
        if (!rewriter) return;
        remarkGithubBlobToRepoPaths({ owner: rewriter.owner, repo: rewriter.repo })(tree);
      };
    })
    .use(remarkMermaidPlaceholders)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(function rehypeRelativizeMaybe() {
      return (tree: HastRoot) => {
        if (!rewriter) return;
        rehypeRelativizeRepoLinks({
          repoRootAbs: rewriter.repoRootAbs,
          htmlOutputFileAbs: rewriter.htmlOutputFileAbs,
        })(tree);
      };
    })
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

export async function renderFencedCode(markdownFence: string): Promise<string> {
  return renderMarkdownToHtml(markdownFence);
}
