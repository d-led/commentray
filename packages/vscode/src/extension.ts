import {
  type BlockRange,
  type CommentrayIndex,
  addBlockToIndex,
  appendBlockToCommentray,
  commentrayMarkdownPath,
  createBlockForRange,
  emptyIndex,
  normalizeRepoRelativePath,
  parseAnchor,
  readIndex,
  validateProject,
  writeIndex,
} from "@commentray/core";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * A block's position in both panes, used by scroll sync to snap the
 * commentray pane to the heading of the block that covers the currently
 * visible top line of the source pane.
 */
type BlockLink = {
  /** 0-based line of the `<!-- commentray:block ... -->` marker in the commentray file. */
  commentrayLine: number;
  /** 1-based inclusive start line in the source file. */
  sourceStart: number;
  /** 1-based inclusive end line in the source file. */
  sourceEnd: number;
};

type ScrollPair = {
  code: vscode.TextEditor;
  commentray: vscode.TextEditor;
  /** Block anchors sorted ascending by `sourceStart`; empty when no blocks exist yet. */
  blocks: BlockLink[];
};

type PairedPaths = {
  repoRoot: string;
  sourceRelative: string;
  commentrayUri: vscode.Uri;
};

const COMMENTRAY_STORAGE_PREFIX = ".commentray/";
const PLACEHOLDER_TEXT = "_(write commentary here)_";

let activePair: ScrollPair | undefined;
let scrollDisposable: vscode.Disposable | undefined;

function commentrayAbsolutePath(repoRoot: string, repoRelativeSource: string): string {
  const rel = commentrayMarkdownPath(repoRelativeSource);
  return path.join(repoRoot, ...rel.split("/"));
}

function disposeScrollSync() {
  scrollDisposable?.dispose();
  scrollDisposable = undefined;
  activePair = undefined;
}

function bindScrollSync(pair: ScrollPair) {
  disposeScrollSync();
  activePair = pair;
  scrollDisposable = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    if (!activePair) return;
    if (event.textEditor !== activePair.code) return;
    const range = event.visibleRanges.at(0);
    if (!range) return;
    syncCommentrayForVisibleSourceRange(activePair, range);
  });
}

function syncCommentrayForVisibleSourceRange(pair: ScrollPair, range: vscode.Range): void {
  const topSourceLine = range.start.line + 1;
  const blockLine = pickBlockLineForSourceLine(pair.blocks, topSourceLine);
  const targetLine = blockLine ?? ratioTargetLine(pair, range);
  const reveal = new vscode.Range(targetLine, 0, targetLine, 0);
  pair.commentray.revealRange(reveal, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/**
 * Snap to the block whose source range covers `topSourceLine`, or — if none
 * covers it — to the nearest preceding block, or to the first block when the
 * user is above all of them. Returns `null` when no blocks exist so the
 * caller can fall back to a proportional scroll.
 */
function pickBlockLineForSourceLine(blocks: BlockLink[], topSourceLine: number): number | null {
  if (blocks.length === 0) return null;
  let best: BlockLink | undefined;
  for (const b of blocks) {
    if (b.sourceStart <= topSourceLine) best = b;
    else break;
  }
  return (best ?? blocks[0]).commentrayLine;
}

function ratioTargetLine(pair: ScrollPair, range: vscode.Range): number {
  const codeLines = Math.max(1, pair.code.document.lineCount);
  const commentrayLines = Math.max(1, pair.commentray.document.lineCount);
  const center = (range.start.line + range.end.line) / 2;
  const fraction = center / Math.max(1, codeLines - 1);
  return Math.min(commentrayLines - 1, Math.max(0, Math.round(fraction * (commentrayLines - 1))));
}

const BLOCK_MARKER_RE = /<!-- commentray:block id=([a-z0-9]+) -->/;

/**
 * Build the block links for scroll sync by correlating the metadata index
 * (anchors, by id) with `<!-- commentray:block id=... -->` markers found in
 * the commentray file. Blocks whose anchor is not a `lines:` range — or
 * whose marker cannot be located in the file — are skipped silently: they
 * simply fall through to the ratio-based fallback.
 */
async function collectBlockLinks(
  repoRoot: string,
  sourceRelative: string,
  commentrayDoc: vscode.TextDocument,
): Promise<BlockLink[]> {
  const index = await readIndex(repoRoot);
  const entry = index?.bySourceFile[sourceRelative];
  if (!entry || entry.blocks.length === 0) return [];
  const markerLineById = findMarkerLines(commentrayDoc.getText());
  const links: BlockLink[] = [];
  for (const block of entry.blocks) {
    const anchor = parseAnchor(block.anchor);
    if (anchor.kind !== "lines") continue;
    const commentrayLine = markerLineById.get(block.id);
    if (commentrayLine === undefined) continue;
    links.push({
      commentrayLine,
      sourceStart: anchor.range.start,
      sourceEnd: anchor.range.end,
    });
  }
  links.sort((a, b) => a.sourceStart - b.sourceStart);
  return links;
}

function findMarkerLines(text: string): Map<string, number> {
  const markerLineById = new Map<string, number>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = BLOCK_MARKER_RE.exec(lines[i]);
    if (match) markerLineById.set(match[1], i);
  }
  return markerLineById;
}

async function ensureCommentrayFile(uri: vscode.Uri): Promise<vscode.Uri> {
  try {
    await vscode.workspace.fs.stat(uri);
    return uri;
  } catch {
    const enc = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, enc.encode("# Commentray\n\n"));
    return uri;
  }
}

async function resolvePairedPaths(
  editor: vscode.TextEditor,
  folder: vscode.WorkspaceFolder,
): Promise<PairedPaths | null> {
  const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
  let normalized: string;
  try {
    normalized = normalizeRepoRelativePath(relative.replaceAll("\\", "/"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(
      `Could not resolve a repo-relative path for the active editor: ${message}`,
    );
    return null;
  }
  if (normalized.startsWith(COMMENTRAY_STORAGE_PREFIX)) {
    await vscode.window.showWarningMessage(
      "Run this command from the source file — the active editor is already a Commentray companion.",
    );
    return null;
  }
  const repoRoot = folder.uri.fsPath;
  const commentrayUri = vscode.Uri.file(commentrayAbsolutePath(repoRoot, normalized));
  return { repoRoot, sourceRelative: normalized, commentrayUri };
}

/**
 * Translate the active selection into a 1-based inclusive line range. A
 * selection that ends at column 0 of the line after the last highlighted
 * character is collapsed to the previous line — this matches the way users
 * visually "drag through line 20": end line should be 20, not 21.
 */
function selectionToRange(editor: vscode.TextEditor): BlockRange {
  const selection = editor.selection;
  const startLine = selection.start.line + 1;
  const rawEndLine = selection.end.line + 1;
  const endLine =
    selection.end.line > selection.start.line && selection.end.character === 0
      ? rawEndLine - 1
      : rawEndLine;
  return { startLine, endLine: Math.max(startLine, endLine) };
}

async function openBesideAndSync(
  sourceEditor: vscode.TextEditor,
  paths: PairedPaths,
): Promise<vscode.TextEditor> {
  const ensured = await ensureCommentrayFile(paths.commentrayUri);
  const commentrayDoc = await vscode.workspace.openTextDocument(ensured);
  const commentrayEditor = await vscode.window.showTextDocument(commentrayDoc, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: false,
  });
  const codeEditor =
    vscode.window.visibleTextEditors.find((te) => te.document === sourceEditor.document) ??
    sourceEditor;
  const blocks = await collectBlockLinks(paths.repoRoot, paths.sourceRelative, commentrayDoc);
  bindScrollSync({ code: codeEditor, commentray: commentrayEditor, blocks });
  return commentrayEditor;
}

async function requireActiveEditorInWorkspace(): Promise<{
  editor: vscode.TextEditor;
  folder: vscode.WorkspaceFolder;
} | null> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showWarningMessage("Open a source file first.");
    return null;
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return null;
  }
  return { editor, folder };
}

async function replaceDocumentContents(
  doc: vscode.TextDocument,
  newContent: string,
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
  edit.replace(doc.uri, fullRange, newContent);
  await vscode.workspace.applyEdit(edit);
}

function findPlaceholderSelection(
  doc: vscode.TextDocument,
  blockId: string,
): vscode.Selection | null {
  const marker = `<!-- commentray:block id=${blockId} -->`;
  const text = doc.getText();
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const placeholderIndex = text.indexOf(PLACEHOLDER_TEXT, markerIndex);
  if (placeholderIndex < 0) return null;
  const start = doc.positionAt(placeholderIndex);
  const end = doc.positionAt(placeholderIndex + PLACEHOLDER_TEXT.length);
  return new vscode.Selection(start, end);
}

async function upsertBlockMetadata(
  repoRoot: string,
  sourceRelative: string,
  block: Parameters<typeof addBlockToIndex>[1]["block"],
): Promise<void> {
  const current: CommentrayIndex = (await readIndex(repoRoot)) ?? emptyIndex();
  const next = addBlockToIndex(current, {
    sourcePath: sourceRelative,
    commentrayPath: commentrayMarkdownPath(sourceRelative),
    block,
  });
  await writeIndex(repoRoot, next);
}

async function openSideBySideCommand(): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const paths = await resolvePairedPaths(active.editor, active.folder);
  if (!paths) return;
  // Leave the source editor wherever the user put it. Open the
  // Commentray markdown in a column to the right of it (`Beside`
  // creates a split if none exists, or reuses the existing
  // right-hand column). This is the tool's core affordance:
  // source on one side, commentary on the other — never two tabs
  // stacked in the same column.
  await openBesideAndSync(active.editor, paths);
}

async function startBlockFromSelectionCommand(): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const paths = await resolvePairedPaths(active.editor, active.folder);
  if (!paths) return;

  const sourceText = active.editor.document.getText();
  const created = createBlockForRange({
    sourcePath: paths.sourceRelative,
    sourceText,
    range: selectionToRange(active.editor),
  });

  const ensured = await ensureCommentrayFile(paths.commentrayUri);
  const commentrayDoc = await vscode.workspace.openTextDocument(ensured);
  const nextContent = appendBlockToCommentray(commentrayDoc.getText(), created.markdown);
  await replaceDocumentContents(commentrayDoc, nextContent);
  await commentrayDoc.save();

  await upsertBlockMetadata(paths.repoRoot, paths.sourceRelative, created.block);

  const commentrayEditor = await openBesideAndSync(active.editor, paths);
  const selection = findPlaceholderSelection(commentrayEditor.document, created.block.id);
  if (selection) {
    commentrayEditor.selection = selection;
    commentrayEditor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
}

async function validateWorkspaceCommand(output: vscode.OutputChannel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }
  const result = await validateProject(folder.uri.fsPath);
  output.clear();
  for (const issue of result.issues) {
    output.appendLine(`[${issue.level}] ${issue.message}`);
  }
  if (result.issues.length === 0) {
    output.appendLine("No issues found.");
  }
  output.show(true);
}

async function openCommentrayPreviewCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showWarningMessage("Open a commentray markdown file first.");
    return;
  }
  if (!editor.document.fileName.endsWith(".md")) {
    await vscode.window.showWarningMessage("This command expects a Markdown file.");
    return;
  }
  await vscode.commands.executeCommand("markdown.showPreview", editor.document.uri);
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Commentray");
  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.commands.registerCommand("commentray.openSideBySide", openSideBySideCommand),
    vscode.commands.registerCommand(
      "commentray.startBlockFromSelection",
      startBlockFromSelectionCommand,
    ),
    vscode.commands.registerCommand(
      "commentray.openCommentrayPreview",
      openCommentrayPreviewCommand,
    ),
    vscode.commands.registerCommand("commentray.validateWorkspace", () =>
      validateWorkspaceCommand(output),
    ),
    { dispose: () => disposeScrollSync() },
  );
}

export function deactivate() {
  disposeScrollSync();
}
