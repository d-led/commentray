/**
 * Narrow entry for embedders that only need companion Markdown → HTML (same pipeline as static
 * pages) without pulling in the full code-browser shell, search UI, or other site chrome.
 */
export {
  renderCommentrayPreviewHtml,
  type RenderCommentrayPreviewHtmlArgs,
} from "./commentray-preview-html.js";
export type { CommentrayOutputUrlOptions, MarkdownPipelineOptions } from "./markdown-pipeline.js";
