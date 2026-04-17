import {
  type BlockRange,
  type BlockScrollLink,
  type CommentrayIndex,
  addBlockToIndex,
  appendBlockToCommentray,
  assertValidAngleId,
  buildBlockScrollLinks,
  commentrayAnglesLayoutEnabled,
  commentrayAnglesSentinelPath,
  createBlockForRange,
  defaultMetadataIndexPath,
  emptyIndex,
  ensureAnglesSentinelFile,
  loadCommentrayConfig,
  normalizeRepoRelativePath,
  pickCommentrayLineForSourceScroll,
  pickSourceLine0ForCommentrayScroll,
  readIndex,
  resolveCommentrayMarkdownPath,
  upsertAngleDefinitionInCommentrayToml,
  validateProject,
  writeIndex,
} from "@commentray/core";
import * as path from "node:path";
import * as vscode from "vscode";

type ScrollPair = {
  code: vscode.TextEditor;
  commentray: vscode.TextEditor;
  /** Block anchors sorted ascending by `sourceStart`; empty when no blocks exist yet. */
  blocks: BlockScrollLink[];
  repoRoot: string;
  sourceRelative: string;
  /** Repo-relative path to the open commentray `.md` (flat or per-angle). */
  commentrayPathRel: string;
};

type PairedPaths = {
  repoRoot: string;
  sourceRelative: string;
  commentrayUri: vscode.Uri;
  commentrayPathRel: string;
  angleId: string | null;
};

let activePair: ScrollPair | undefined;
let scrollSyncDisposable: vscode.Disposable | undefined;
let ignoreScrollPairEvents = false;
let blockRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function storageCommentraySourcePrefix(storageDir: string): string {
  const sd = storageDir.replaceAll("\\", "/");
  return `${sd}/source/`;
}

function disposeScrollSync() {
  if (blockRefreshTimer !== undefined) {
    clearTimeout(blockRefreshTimer);
    blockRefreshTimer = undefined;
  }
  scrollSyncDisposable?.dispose();
  scrollSyncDisposable = undefined;
  activePair = undefined;
}

function withIgnoredScrollPairEvents(fn: () => void): void {
  ignoreScrollPairEvents = true;
  try {
    fn();
  } finally {
    setTimeout(() => {
      ignoreScrollPairEvents = false;
    }, 16);
  }
}

async function refreshActivePairBlocks(): Promise<void> {
  if (!activePair) return;
  const index = await readIndex(activePair.repoRoot);
  activePair.blocks = buildBlockScrollLinks(
    index,
    activePair.sourceRelative,
    activePair.commentrayPathRel,
    activePair.commentray.document.getText(),
  );
}

function scheduleRefreshActivePairBlocks(): void {
  if (!activePair) return;
  if (blockRefreshTimer !== undefined) clearTimeout(blockRefreshTimer);
  blockRefreshTimer = setTimeout(() => {
    blockRefreshTimer = undefined;
    void refreshActivePairBlocks();
  }, 120);
}

function syncCommentrayForVisibleSourceRange(pair: ScrollPair, range: vscode.Range): void {
  const topSourceLine = range.start.line + 1;
  const blockLine = pickCommentrayLineForSourceScroll(pair.blocks, topSourceLine);
  const targetLine = blockLine ?? ratioCommentrayLineFromSourceScroll(pair, range);
  const reveal = new vscode.Range(targetLine, 0, targetLine, 0);
  withIgnoredScrollPairEvents(() =>
    pair.commentray.revealRange(reveal, vscode.TextEditorRevealType.InCenterIfOutsideViewport),
  );
}

function syncCodeForVisibleCommentrayRange(pair: ScrollPair, range: vscode.Range): void {
  const topCommentrayLine = range.start.line;
  const sourceLine0 = pickSourceLine0ForCommentrayScroll(pair.blocks, topCommentrayLine);
  const targetLine = sourceLine0 ?? ratioSourceLine0FromCommentrayScroll(pair, range);
  const reveal = new vscode.Range(targetLine, 0, targetLine, 0);
  withIgnoredScrollPairEvents(() =>
    pair.code.revealRange(reveal, vscode.TextEditorRevealType.InCenterIfOutsideViewport),
  );
}

function ratioCommentrayLineFromSourceScroll(pair: ScrollPair, range: vscode.Range): number {
  const codeLines = Math.max(1, pair.code.document.lineCount);
  const commentrayLines = Math.max(1, pair.commentray.document.lineCount);
  const center = (range.start.line + range.end.line) / 2;
  const fraction = center / Math.max(1, codeLines - 1);
  return Math.min(commentrayLines - 1, Math.max(0, Math.round(fraction * (commentrayLines - 1))));
}

function ratioSourceLine0FromCommentrayScroll(pair: ScrollPair, range: vscode.Range): number {
  const commentrayLines = Math.max(1, pair.commentray.document.lineCount);
  const codeLines = Math.max(1, pair.code.document.lineCount);
  const center = (range.start.line + range.end.line) / 2;
  const fraction = center / Math.max(1, commentrayLines - 1);
  return Math.min(codeLines - 1, Math.max(0, Math.round(fraction * (codeLines - 1))));
}

function metadataIndexAbsolutePath(repoRoot: string): string {
  return path.join(repoRoot, ...defaultMetadataIndexPath().split("/"));
}

function bindScrollSync(pair: ScrollPair): void {
  disposeScrollSync();
  activePair = pair;

  const onVisibleRanges = (event: vscode.TextEditorVisibleRangesChangeEvent) => {
    if (!activePair || ignoreScrollPairEvents) return;
    const range = event.visibleRanges.at(0);
    if (!range) return;
    if (event.textEditor === activePair.code) {
      syncCommentrayForVisibleSourceRange(activePair, range);
    } else if (event.textEditor === activePair.commentray) {
      syncCodeForVisibleCommentrayRange(activePair, range);
    }
  };

  const onDocChange = (e: vscode.TextDocumentChangeEvent) => {
    if (!activePair) return;
    if (e.document !== activePair.code.document && e.document !== activePair.commentray.document) {
      return;
    }
    scheduleRefreshActivePairBlocks();
  };

  const onIndexSave = (doc: vscode.TextDocument) => {
    if (!activePair) return;
    if (doc.uri.fsPath !== metadataIndexAbsolutePath(activePair.repoRoot)) return;
    void refreshActivePairBlocks();
  };

  scrollSyncDisposable = vscode.Disposable.from(
    vscode.window.onDidChangeTextEditorVisibleRanges(onVisibleRanges),
    vscode.workspace.onDidChangeTextDocument(onDocChange),
    vscode.workspace.onDidSaveTextDocument(onIndexSave),
  );

  const initial = pair.code.visibleRanges.at(0);
  if (initial) syncCommentrayForVisibleSourceRange(pair, initial);
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
  angleId?: string | null,
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
  const repoRoot = folder.uri.fsPath;
  const cfg = await loadCommentrayConfig(repoRoot);
  const sourcePrefix = storageCommentraySourcePrefix(cfg.storageDir);
  if (normalized.startsWith(sourcePrefix)) {
    await vscode.window.showWarningMessage(
      "Run this command from the primary source file — not from a file under .commentray/source/…",
    );
    return null;
  }
  const resolution = resolveCommentrayMarkdownPath(repoRoot, normalized, cfg, angleId ?? undefined);
  const commentrayUri = vscode.Uri.file(
    path.join(repoRoot, ...resolution.commentrayPath.split("/")),
  );
  return {
    repoRoot,
    sourceRelative: normalized,
    commentrayUri,
    commentrayPathRel: resolution.commentrayPath,
    angleId: resolution.angleId,
  };
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
  const index = await readIndex(paths.repoRoot);
  const blocks = buildBlockScrollLinks(
    index,
    paths.sourceRelative,
    paths.commentrayPathRel,
    commentrayDoc.getText(),
  );
  bindScrollSync({
    code: codeEditor,
    commentray: commentrayEditor,
    blocks,
    repoRoot: paths.repoRoot,
    sourceRelative: paths.sourceRelative,
    commentrayPathRel: paths.commentrayPathRel,
  });
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
  const PLACEHOLDER_TEXT = "_(write commentary here)_";
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
  commentrayPathRel: string,
  block: Parameters<typeof addBlockToIndex>[1]["block"],
): Promise<void> {
  const current: CommentrayIndex = (await readIndex(repoRoot)) ?? emptyIndex();
  const next = addBlockToIndex(current, {
    sourcePath: sourceRelative,
    commentrayPath: commentrayPathRel,
    block,
  });
  await writeIndex(repoRoot, next);
}

async function openSideBySideCommand(): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const paths = await resolvePairedPaths(active.editor, active.folder);
  if (!paths) return;
  await openBesideAndSync(active.editor, paths);
}

async function openCommentrayAngleCommand(): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const cfg = await loadCommentrayConfig(active.folder.uri.fsPath);
  if (!commentrayAnglesLayoutEnabled(active.folder.uri.fsPath, cfg.storageDir)) {
    const sentinel = commentrayAnglesSentinelPath(cfg.storageDir);
    await vscode.window.showInformationMessage(
      `Angles layout is off (missing ${sentinel}). Use “Add Angle to project…” to enable it and register angles in .commentray.toml.`,
    );
    return;
  }
  const items: vscode.QuickPickItem[] = cfg.angles.definitions.map((d) => ({
    label: d.title,
    description: d.id,
  }));
  items.push({ label: "Custom angle id…", alwaysShow: true });
  const chosen = await vscode.window.showQuickPick(items, {
    title: "Open Commentray angle",
    placeHolder: "Pick an angle for the current source file",
  });
  if (!chosen) return;
  let angleId: string;
  if (chosen.label === "Custom angle id…") {
    const raw = await vscode.window.showInputBox({
      title: "Angle id",
      prompt: "Use letters, digits, underscores, or hyphens (1–64 chars).",
      validateInput: (value) => {
        try {
          assertValidAngleId(value);
          return undefined;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
    });
    if (!raw) return;
    angleId = assertValidAngleId(raw);
  } else {
    if (!chosen.description) return;
    angleId = assertValidAngleId(chosen.description);
  }
  const paths = await resolvePairedPaths(active.editor, active.folder, angleId);
  if (!paths) return;
  await openBesideAndSync(active.editor, paths);
}

async function addAngleDefinitionCommand(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }
  const repoRoot = folder.uri.fsPath;
  const cfg = await loadCommentrayConfig(repoRoot);
  const idRaw = await vscode.window.showInputBox({
    title: "New Commentray angle",
    prompt: "Short id (used in paths and .commentray.toml), e.g. architecture",
    validateInput: (value) => {
      try {
        assertValidAngleId(value);
        return undefined;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
  });
  if (!idRaw) return;
  const id = assertValidAngleId(idRaw);
  const titleRaw = await vscode.window.showInputBox({
    title: "Display title",
    prompt: "Optional — shown in the angle picker",
    value: id,
  });
  let makeDefault = cfg.angles.definitions.length === 0;
  if (!makeDefault) {
    const pick = await vscode.window.showQuickPick(
      [
        { label: "Yes", description: "Set as default_angle in .commentray.toml" },
        { label: "No", description: "Keep the current default" },
      ],
      { placeHolder: `Set “${id}” as the default angle?` },
    );
    makeDefault = pick?.label === "Yes";
  }
  try {
    await ensureAnglesSentinelFile(repoRoot, cfg.storageDir);
    await upsertAngleDefinitionInCommentrayToml(repoRoot, {
      id,
      title: titleRaw?.trim() && titleRaw.trim() !== id ? titleRaw.trim() : undefined,
      makeDefault,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await vscode.window.showErrorMessage(`Could not update .commentray.toml: ${msg}`);
    return;
  }
  await vscode.window.showInformationMessage(
    `Angle “${id}” was added to .commentray.toml and Angles layout is enabled (${commentrayAnglesSentinelPath(cfg.storageDir)}).`,
  );
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

  await upsertBlockMetadata(
    paths.repoRoot,
    paths.sourceRelative,
    paths.commentrayPathRel,
    created.block,
  );

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
    vscode.commands.registerCommand("commentray.openCommentrayAngle", openCommentrayAngleCommand),
    vscode.commands.registerCommand("commentray.addAngleDefinition", addAngleDefinitionCommand),
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
