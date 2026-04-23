import path from "node:path";

import type { Code, Definition, Html, Image, Link, Root as MdastRoot } from "mdast";
import type { Element, Root as HastRoot, Text } from "hast";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { escapeHtml } from "./html-utils.js";

/**
 * When generating static HTML (Pages, `commentray render`), rewrites `img[src]` and `a[href]`
 * so local assets work from the output file location.
 *
 * **URL rules** (same commentray file as in the editor):
 * - **`/path/to/file`** — resolved from the **repository root** (leading slash), POSIX-style,
 *   after `..` normalization; must stay **inside** `repoRootAbs`.
 * - **`./` / `../` / `figures/a.png`** — resolved with `path.resolve(markdownUrlBaseDirAbs, …)`;
 *   must stay **inside** `repoRootAbs`.
 *
 * **Images (`img[src]`)** — resolved path must also lie **inside** `commentrayStorageRootAbs`
 * (typically `{repo}/.commentray`). Raster or SVG assets for commentray belong next to the
 * Markdown under storage; repo-root images are **not** emitted (src removed) so static pages
 * cannot pull arbitrary repo files as image bytes.
 *
 * **Links (`a[href]`)** — any in-repo file under `repoRootAbs` may still be linked (e.g. specs
 * under `docs/`). Only images are restricted to storage.
 */
export type CommentrayOutputUrlOptions = {
  repoRootAbs: string;
  htmlOutputFileAbs: string;
  markdownUrlBaseDirAbs: string;
  /**
   * Absolute path to Commentray storage (e.g. `{repoRoot}/.commentray`). Used to sandbox
   * **local image** URLs; see package JSDoc above.
   */
  commentrayStorageRootAbs: string;
  /** When set, `https://github.com/<owner>/<repo>/blob|tree/<branch>/…` becomes a `/…` repo path. */
  githubBlobRepo?: { owner: string; repo: string };
};

export type MarkdownPipelineOptions = {
  commentrayOutputUrls?: CommentrayOutputUrlOptions;
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
      if (!next) return null;
      const posix = next.replace(/\\/g, "/").replace(/^\/+/, "");
      return posix ? `/${posix}` : null;
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

function decodeUrlPath(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function isResolvedPathInsideRoot(resolvedAbs: string, rootAbs: string): boolean {
  const rel = path.relative(path.resolve(rootAbs), path.resolve(resolvedAbs));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return true;
}

type LocalUrlRewrite = { relativeToHtml: string } | { blockedImage: true } | null;

function rehypeCommentrayOutputUrls(ctx: CommentrayOutputUrlOptions) {
  const repoRoot = path.resolve(ctx.repoRootAbs);
  const storageRoot = path.resolve(ctx.commentrayStorageRootAbs);
  const htmlDir = path.dirname(path.resolve(ctx.htmlOutputFileAbs));
  const baseDir = path.resolve(ctx.markdownUrlBaseDirAbs);

  function resolveTargetAbs(raw: string, tagName: "a" | "img"): LocalUrlRewrite {
    const t = raw.trim();
    if (!t || t.startsWith("#")) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(t)) return null;
    if (t.startsWith("//")) return null;

    let resolved: string;
    if (t.startsWith("/")) {
      const rest = decodeUrlPath(t.replace(/^\/+/, ""));
      if (!rest || rest.includes("\0")) return null;
      resolved = path.normalize(path.join(repoRoot, rest));
    } else {
      const decoded = decodeUrlPath(t);
      resolved = path.normalize(path.resolve(baseDir, decoded));
    }

    if (!isResolvedPathInsideRoot(resolved, repoRoot)) return null;

    if (tagName === "img" && !isResolvedPathInsideRoot(resolved, storageRoot)) {
      return { blockedImage: true };
    }

    const out = path.relative(htmlDir, resolved);
    if (path.isAbsolute(out)) return null;

    return { relativeToHtml: posixHref(out) };
  }

  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a" && node.tagName !== "img") return;
      const key = node.tagName === "a" ? "href" : "src";
      const raw = node.properties?.[key];
      if (typeof raw !== "string") return;
      const next = resolveTargetAbs(raw, node.tagName);
      if (next == null) return;
      node.properties ??= {};
      if ("blockedImage" in next) {
        delete node.properties[key];
        return;
      }
      node.properties[key] = next.relativeToHtml;
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
        /** Diagram text must end up as direct text under `<pre class="mermaid">` (see {@link rehypeMermaidUnwrapInnerCode}). */
        value: `<div class="commentray-mermaid"><pre class="mermaid">${escapeHtml(
          value,
        )}</pre></div>`,
      };
      parent.children[index] = html;
    });
  };
}

function hastPlainTextFromElement(node: Element): string {
  let out = "";
  for (const c of node.children) {
    if (c.type === "text") {
      out += c.value;
    } else if (c.type === "element") {
      out += hastPlainTextFromElement(c);
    }
  }
  return out;
}

/**
 * `rehype-highlight` may leave (or introduce) `<pre class="mermaid"><code class="language-mermaid">…</code></pre>`.
 * Mermaid 11's browser runtime expects the diagram source as **text** under `<pre class="mermaid">`, otherwise it
 * shows "Syntax error in text".
 */
function rehypeMermaidUnwrapInnerCode() {
  return (tree: HastRoot): void => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const cls = node.properties?.className;
      if (!Array.isArray(cls) || !cls.map(String).includes("mermaid")) return;

      const codeChild = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!codeChild) return;

      const value = hastPlainTextFromElement(codeChild);
      const textNode: Text = { type: "text", value };
      node.children = [textNode];
    });
  };
}

const sanitizeSchema = structuredClone(defaultSchema);

/** Companion Markdown is repo-controlled; keep `id` unprefixed so `commentray-block-*` anchors are stable. */
sanitizeSchema.clobber = ["ariaDescribedBy", "ariaLabelledBy", "name"];

sanitizeSchema.attributes = {
  ...sanitizeSchema.attributes,
  code: [...(sanitizeSchema.attributes?.code ?? []), "className"],
  pre: [...(sanitizeSchema.attributes?.pre ?? []), "className"],
  span: [...(sanitizeSchema.attributes?.span ?? []), "className"],
  div: [
    ...(sanitizeSchema.attributes?.div ?? []),
    "className",
    "id",
    "ariaHidden",
    /** Block scroll sync markers from `injectCommentrayDocAnchors` (hast property names). */
    "dataSourceStart",
    "dataCommentrayLine",
  ],
};

export async function renderMarkdownToHtml(
  markdown: string,
  options?: MarkdownPipelineOptions,
): Promise<string> {
  const outUrls = options?.commentrayOutputUrls;
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(function remarkGithubBlobMaybe() {
      return (tree: MdastRoot) => {
        const gh = outUrls?.githubBlobRepo;
        if (!gh) return;
        remarkGithubBlobToRepoPaths({ owner: gh.owner, repo: gh.repo })(tree);
      };
    })
    .use(remarkMermaidPlaceholders)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(function rehypeOutputUrlsMaybe() {
      return (tree: HastRoot) => {
        if (!outUrls) return;
        rehypeCommentrayOutputUrls(outUrls)(tree);
      };
    })
    .use(rehypeHighlight, { plainText: ["mermaid"] })
    .use(rehypeMermaidUnwrapInnerCode)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

export async function renderFencedCode(markdownFence: string): Promise<string> {
  return renderMarkdownToHtml(markdownFence);
}
