import {
  type BlockRange,
  type BlockScrollLink,
  type CommentrayIndex,
  addBlockToIndex,
  assertValidAngleId,
  buildBlockScrollLinks,
  commentrayActiveEditorUiFlags,
  commentrayAnglesLayoutEnabled,
  commentrayAnglesSentinelPath,
  companionPlaceholderMarkdown,
  commentrayStorageSourcePrefix,
  createBlockForRange,
  defaultMetadataIndexPath,
  defaultRegionMarkerNamingStrategy,
  emptyIndex,
  ensureAnglesSentinelFile,
  initializeCommentrayProject,
  insertBlockBySourceMarkerOrder,
  isCommentrayProjectInitialized,
  loadCommentrayConfig,
  normalizeRepoRelativePath,
  pickCommentrayLineForSourceDualPane,
  pickSourceLine0ForCommentrayScroll,
  pairFromCommentraySourceRel,
  readIndex,
  resolveCommentrayMarkdownPath,
  upsertAngleDefinitionInCommentrayToml,
  validateProject,
  wrapSourceLineRangeWithCommentrayMarkers,
  writeIndex,
} from "@commentray/core";
import * as path from "node:path";
import * as vscode from "vscode";

import { CommentrayRenderedPreviewPanel } from "./commentray-rendered-preview.js";

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
/** Last pair we bound scroll sync for; kept when listeners are disposed so toggling sync back on can reattach. */
let lastBoundScrollPair: ScrollPair | undefined;
let scrollSyncDisposable: vscode.Disposable | undefined;
let ignoreScrollPairEvents = false;
let blockRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let commentrayOutput: vscode.OutputChannel | undefined;

function logCommentray(line: string): void {
  commentrayOutput?.appendLine(line);
}

function scrollPairEditorsReachable(pair: ScrollPair): boolean {
  return (
    vscode.window.visibleTextEditors.some((e) => e.document === pair.code.document) &&
    vscode.window.visibleTextEditors.some((e) => e.document === pair.commentray.document)
  );
}

function applyScrollSyncSettingFromConfig(): void {
  if (scrollSyncEnabled()) {
    if (!activePair && lastBoundScrollPair && scrollPairEditorsReachable(lastBoundScrollPair)) {
      bindScrollSync(lastBoundScrollPair);
    }
  } else {
    disposeScrollSync();
  }
}

const CTX_ACTIVE_EDITOR_UNDER_COMPANION_SOURCE_TREE =
  "commentray.activeEditorUnderCompanionSourceTree";
const CTX_ACTIVE_EDITOR_IS_RESOLVABLE_COMPANION_MD =
  "commentray.activeEditorIsResolvableCompanionMarkdown";
const CTX_WORKSPACE_INITIALIZED = "commentray.workspaceInitialized";

/**
 * Drives `when` / `enablement` clauses so editor-only commands match companion vs primary files.
 */
async function applyCommentrayActiveEditorUiContexts(uri: vscode.Uri | undefined): Promise<void> {
  const folderFromUri = uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
  const fallbackFolder = vscode.workspace.workspaceFolders?.[0];
  const contextFolder = folderFromUri ?? fallbackFolder;

  let workspaceInitialized = false;
  if (contextFolder) {
    try {
      workspaceInitialized = await isCommentrayProjectInitialized(contextFolder.uri.fsPath);
    } catch {
      workspaceInitialized = false;
    }
  }

  const setContexts = async (
    underCompanionTree: boolean,
    resolvableCompanionMd: boolean,
  ): Promise<void> => {
    await vscode.commands.executeCommand(
      "setContext",
      CTX_ACTIVE_EDITOR_UNDER_COMPANION_SOURCE_TREE,
      underCompanionTree,
    );
    await vscode.commands.executeCommand(
      "setContext",
      CTX_ACTIVE_EDITOR_IS_RESOLVABLE_COMPANION_MD,
      resolvableCompanionMd,
    );
    await vscode.commands.executeCommand(
      "setContext",
      CTX_WORKSPACE_INITIALIZED,
      workspaceInitialized,
    );
  };

  if (!uri || uri.scheme !== "file") {
    await setContexts(false, false);
    return;
  }
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    await setContexts(false, false);
    return;
  }

  try {
    const relative = vscode.workspace.asRelativePath(uri, false);
    if (path.isAbsolute(relative)) {
      await setContexts(false, false);
      return;
    }
    const normalized = normalizeRepoRelativePath(relative.replaceAll("\\", "/"));
    const cfg = await loadCommentrayConfig(folder.uri.fsPath);
    const flags = commentrayActiveEditorUiFlags({
      normalizedRepoRelativePath: normalized,
      storageDir: cfg.storageDir,
      repoRoot: folder.uri.fsPath,
      staticSiteCommentrayMarkdownFile: cfg.staticSite.commentrayMarkdownFile,
    });
    await setContexts(flags.underCompanionSourceTree, flags.isResolvableCompanionMarkdown);
  } catch {
    await setContexts(false, false);
  }
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
  let index: CommentrayIndex | null = null;
  try {
    index = await readIndex(activePair.repoRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logCommentray(`[commentray] readIndex (refresh blocks): ${msg}`);
  }
  activePair.blocks = buildBlockScrollLinks(
    index,
    activePair.sourceRelative,
    activePair.commentrayPathRel,
    activePair.commentray.document.getText(),
    activePair.code.document.getText(),
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
  const targetLine = pickCommentrayLineForSourceDualPane(
    pair.blocks,
    topSourceLine,
    pair.commentray.document.lineCount,
    () => ratioCommentrayLineFromSourceScroll(pair, range),
  );
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
  lastBoundScrollPair = pair;

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
  const sourcePrefix = commentrayStorageSourcePrefix(cfg.storageDir);
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

/** 1-based inclusive line range covering every line that touches the selection (for region wrap). */
function fullLineBlockRange(editor: vscode.TextEditor): BlockRange {
  const sel = editor.selection;
  const lo = Math.min(sel.start.line, sel.end.line);
  const hi = Math.max(sel.start.line, sel.end.line);
  return { startLine: lo + 1, endLine: hi + 1 };
}

function scrollSyncEnabled(): boolean {
  const v = vscode.workspace.getConfiguration("commentray").get("scrollSync.enabled");
  return v !== false;
}

function pairedPathsFromDiskPair(
  repoRoot: string,
  diskPair: { sourcePath: string; commentrayPath: string },
): PairedPaths {
  const commentrayUri = vscode.Uri.file(path.join(repoRoot, ...diskPair.commentrayPath.split("/")));
  return {
    repoRoot,
    sourceRelative: diskPair.sourcePath,
    commentrayUri,
    commentrayPathRel: diskPair.commentrayPath,
    angleId: null,
  };
}

async function bindPairScrollSync(
  codeEditor: vscode.TextEditor,
  commentrayEditor: vscode.TextEditor,
  paths: PairedPaths,
): Promise<void> {
  let index: CommentrayIndex | null = null;
  try {
    index = await readIndex(paths.repoRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logCommentray(`[commentray] readIndex (open pair): ${msg}`);
    void vscode.window.showWarningMessage(
      `Commentray could not read metadata index.json; block-aware scroll sync is limited until the file is valid. (${msg})`,
    );
  }
  const blocks = buildBlockScrollLinks(
    index,
    paths.sourceRelative,
    paths.commentrayPathRel,
    commentrayEditor.document.getText(),
    codeEditor.document.getText(),
  );
  const pair: ScrollPair = {
    code: codeEditor,
    commentray: commentrayEditor,
    blocks,
    repoRoot: paths.repoRoot,
    sourceRelative: paths.sourceRelative,
    commentrayPathRel: paths.commentrayPathRel,
  };
  if (scrollSyncEnabled()) {
    bindScrollSync(pair);
  }
}

/**
 * Prefer [source | companion]: if the companion is already past the first column, open the source in
 * column one; otherwise open the source first and place the companion in the group to the right.
 */
async function revealSourceLeftOfCompanionAndReturnEditors(
  companionEditor: vscode.TextEditor,
  sourceDoc: vscode.TextDocument,
): Promise<{ code: vscode.TextEditor; commentray: vscode.TextEditor }> {
  const companionUri = companionEditor.document.uri;
  const findCompanion = (): vscode.TextEditor =>
    vscode.window.visibleTextEditors.find(
      (te) => te.document.uri.toString() === companionUri.toString(),
    ) ?? companionEditor;

  const findSource = (doc: vscode.TextDocument): vscode.TextEditor | undefined =>
    vscode.window.visibleTextEditors.find((te) => te.document === doc);

  const cCol = companionEditor.viewColumn;
  if (cCol !== undefined && cCol > vscode.ViewColumn.One) {
    const codeEditor = await vscode.window.showTextDocument(sourceDoc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });
    return { code: codeEditor, commentray: findCompanion() };
  }

  const codeEditor = await vscode.window.showTextDocument(sourceDoc, { preview: false });
  const companionDoc = await vscode.workspace.openTextDocument(companionUri);
  await vscode.window.showTextDocument(companionDoc, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: false,
    preserveFocus: true,
  });
  const code = findSource(sourceDoc) ?? codeEditor;
  return { code, commentray: findCompanion() };
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
  await bindPairScrollSync(codeEditor, commentrayEditor, paths);
  return commentrayEditor;
}

function workspaceFolderContaining(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(uri);
}

async function requireEditorInWorkspaceFolder(editor: vscode.TextEditor): Promise<{
  editor: vscode.TextEditor;
  folder: vscode.WorkspaceFolder;
} | null> {
  const folder = workspaceFolderContaining(editor.document.uri);
  if (!folder) {
    await vscode.window.showWarningMessage(
      "This file is not inside an open workspace folder. Open the repository root (or a parent folder that contains the project).",
    );
    return null;
  }
  return { editor, folder };
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
  if (!vscode.workspace.workspaceFolders?.length) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return null;
  }
  return requireEditorInWorkspaceFolder(editor);
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
  let current: CommentrayIndex;
  try {
    current = (await readIndex(repoRoot)) ?? emptyIndex();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logCommentray(`[commentray] readIndex (block metadata): ${msg}`);
    current = emptyIndex();
  }
  const next = addBlockToIndex(current, {
    sourcePath: sourceRelative,
    commentrayPath: commentrayPathRel,
    block,
  });
  await writeIndex(repoRoot, next);
}

function uriFromOpenSideBySideArgs(arg: unknown): vscode.Uri | undefined {
  if (arg instanceof vscode.Uri) return arg;
  if (Array.isArray(arg) && arg[0] instanceof vscode.Uri) return arg[0];
  return undefined;
}

/** `executeCommand("commentray.openCommentrayAngle", { angleId: "…" })` skips the picker (tests, keybindings). */
type OpenAngleCommandArg = "absent" | "invalid" | { angleId: string };

function presetAngleFromOpenAngleCommandArg(arg: unknown): OpenAngleCommandArg {
  if (arg === undefined || arg === null) return "absent";
  if (typeof arg !== "object") return "invalid";
  if (!("angleId" in arg)) return "absent";
  const raw = Reflect.get(arg, "angleId");
  if (typeof raw !== "string") return "invalid";
  const t = raw.trim();
  if (t.length === 0) return "invalid";
  try {
    return { angleId: assertValidAngleId(t) };
  } catch {
    return "invalid";
  }
}

function validateAngleIdInput(value: string): string | undefined {
  try {
    assertValidAngleId(value);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Angles layout must be on. Returns an angle id, or `null` when the user cancels, angles are off,
 * or the programmatic `arg` is invalid (after showing a warning).
 */
async function pickCommentrayAngleIdInteractively(
  folder: vscode.WorkspaceFolder,
  arg: unknown | undefined,
  quickPickTitle: string,
  placeHolder: string,
): Promise<string | null> {
  const cfg = await loadCommentrayConfig(folder.uri.fsPath);
  if (!commentrayAnglesLayoutEnabled(folder.uri.fsPath, cfg.storageDir)) {
    const sentinel = commentrayAnglesSentinelPath(cfg.storageDir);
    await vscode.window.showInformationMessage(
      `Angles layout is off (missing ${sentinel}). Use “Commentray: Add angle to project…” to enable it and register angles in .commentray.toml.`,
    );
    return null;
  }

  const preset = presetAngleFromOpenAngleCommandArg(arg);
  if (preset === "invalid") {
    await vscode.window.showWarningMessage(
      'Invalid angle id: use { "angleId": "your-angle" } when invoking this command programmatically.',
    );
    return null;
  }

  if (preset !== "absent") return preset.angleId;

  const items: vscode.QuickPickItem[] = cfg.angles.definitions.map((d) => ({
    label: d.title,
    description: d.id,
  }));
  items.push({ label: "Custom angle id…", alwaysShow: true });
  const chosen = await vscode.window.showQuickPick(items, {
    title: quickPickTitle,
    placeHolder,
  });
  if (!chosen) return null;
  if (chosen.label === "Custom angle id…") {
    const raw = await vscode.window.showInputBox({
      title: "Angle id",
      prompt: "Use letters, digits, underscores, or hyphens (1–64 chars).",
      validateInput: validateAngleIdInput,
    });
    if (!raw) return null;
    return assertValidAngleId(raw);
  }
  if (!chosen.description) return null;
  return assertValidAngleId(chosen.description);
}

/** `executeCommand("commentray.addAngleDefinition", { id: "architecture", title: "Architecture", makeDefault: true })` skips prompts (tests, automation). */
type AddAngleDefinitionCommandArg =
  | "absent"
  | "invalid"
  | { id: string; title?: string; makeDefault?: boolean };

function parseOptionalString(value: unknown): string | "invalid" | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | "invalid" | undefined {
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : "invalid";
}

function presetFromAddAngleDefinitionCommandArg(arg: unknown): AddAngleDefinitionCommandArg {
  if (arg === undefined || arg === null) return "absent";
  if (typeof arg !== "object") return "invalid";
  if (!("id" in arg)) return "absent";
  const rawId = Reflect.get(arg, "id");
  if (typeof rawId !== "string") return "invalid";
  const trimmedId = rawId.trim();
  if (trimmedId.length === 0) return "invalid";
  let id: string;
  try {
    id = assertValidAngleId(trimmedId);
  } catch {
    return "invalid";
  }
  const title = parseOptionalString(Reflect.get(arg, "title"));
  if (title === "invalid") return "invalid";
  const makeDefault = parseOptionalBoolean(Reflect.get(arg, "makeDefault"));
  if (makeDefault === "invalid") return "invalid";
  return { id, title, makeDefault };
}

async function openSideBySideCommand(arg?: unknown): Promise<void> {
  let editor = vscode.window.activeTextEditor;
  const fromExplorer = uriFromOpenSideBySideArgs(arg);
  if (fromExplorer) {
    const doc = await vscode.workspace.openTextDocument(fromExplorer);
    editor = await vscode.window.showTextDocument(doc, { preview: false });
  }
  if (!editor) {
    await vscode.window.showWarningMessage("Open a source file first.");
    return;
  }
  if (!vscode.workspace.workspaceFolders?.length) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }
  const active = await requireEditorInWorkspaceFolder(editor);
  if (!active) return;
  const paths = await resolvePairedPaths(active.editor, active.folder);
  if (!paths) return;
  await openBesideAndSync(active.editor, paths);
}

async function openCommentrayAngleCommand(arg?: unknown): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const angleId = await pickCommentrayAngleIdInteractively(
    active.folder,
    arg,
    "Open Commentray angle",
    "Pick an angle for the current source file",
  );
  if (!angleId) return;

  const paths = await resolvePairedPaths(active.editor, active.folder, angleId);
  if (!paths) return;
  await openBesideAndSync(active.editor, paths);
}

function pickWorkspaceFolderForRepoWideCommand(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return undefined;
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const fromDoc = workspaceFolderContaining(editor.document.uri);
    if (fromDoc) return fromDoc;
  }
  return folders[0];
}

async function addAngleDefinitionCommand(arg?: unknown): Promise<void> {
  const folder = pickWorkspaceFolderForRepoWideCommand();
  if (!folder) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }
  const repoRoot = folder.uri.fsPath;
  const cfg = await loadCommentrayConfig(repoRoot);
  const preset = presetFromAddAngleDefinitionCommandArg(arg);
  if (preset === "invalid") {
    await vscode.window.showWarningMessage(
      'Invalid angle definition: use { "id": "your-angle", "title"?: "Display title", "makeDefault"?: true|false } when invoking this command programmatically.',
    );
    return;
  }

  let id: string;
  let title: string | undefined;
  let makeDefault: boolean;
  if (preset === "absent") {
    const idRaw = await vscode.window.showInputBox({
      title: "New Commentray angle",
      prompt: "Short id (used in paths and .commentray.toml), e.g. architecture",
      validateInput: validateAngleIdInput,
    });
    if (!idRaw) return;
    id = assertValidAngleId(idRaw);
    const titleRaw = await vscode.window.showInputBox({
      title: "Display title",
      prompt: "Optional — shown in the angle picker",
      value: id,
    });
    title = titleRaw?.trim() && titleRaw.trim() !== id ? titleRaw.trim() : undefined;
    makeDefault = cfg.angles.definitions.length === 0;
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
  } else {
    id = preset.id;
    title = preset.title;
    makeDefault = preset.makeDefault ?? cfg.angles.definitions.length === 0;
  }

  try {
    await ensureAnglesSentinelFile(repoRoot, cfg.storageDir);
    await upsertAngleDefinitionInCommentrayToml(repoRoot, {
      id,
      title,
      makeDefault,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await vscode.window.showErrorMessage(`Could not update .commentray.toml: ${msg}`);
    return;
  }
  void vscode.window.showInformationMessage(
    `Angle “${id}” was added to .commentray.toml and Angles layout is enabled (${commentrayAnglesSentinelPath(cfg.storageDir)}).`,
  );
}

async function startBlockFromSelectionCommand(): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const paths = await resolvePairedPaths(active.editor, active.folder);
  if (!paths) return;

  const lineRange = fullLineBlockRange(active.editor);
  const blockId = defaultRegionMarkerNamingStrategy.suggestMarkerId({
    languageId: active.editor.document.languageId,
    sourceText: active.editor.document.getText(),
    range: lineRange,
  });
  const wrapped = wrapSourceLineRangeWithCommentrayMarkers({
    sourceText: active.editor.document.getText(),
    range: lineRange,
    languageId: active.editor.document.languageId,
    markerId: blockId,
  });
  await replaceDocumentContents(active.editor.document, wrapped.sourceText);
  await active.editor.document.save();
  const sourceText = active.editor.document.getText();
  const created = createBlockForRange({
    sourcePath: paths.sourceRelative,
    sourceText,
    range: wrapped.innerRange,
    id: blockId,
  });

  const ensured = await ensureCommentrayFile(paths.commentrayUri);
  const commentrayDoc = await vscode.workspace.openTextDocument(ensured);
  const existingCommentray = commentrayDoc.getText();
  const scaffold = companionPlaceholderMarkdown(paths.sourceRelative).trim();
  const normalizedExisting = existingCommentray.replaceAll("\r\n", "\n").trim();
  const baseCommentrayForInsert = normalizedExisting === scaffold ? "" : existingCommentray;
  const nextContent = insertBlockBySourceMarkerOrder({
    existingCommentray: baseCommentrayForInsert,
    blockMarkdown: created.markdown,
    sourceText,
    markerId: created.block.id,
  });
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

async function initWorkspaceCommand(output: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolderForRepoWideCommand();
  if (!folder) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }

  const repoRoot = folder.uri.fsPath;
  let init;
  try {
    init = await initializeCommentrayProject(repoRoot, {
      ensureSiteGitignore: true,
      runValidation: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await vscode.window.showErrorMessage(`Commentray init failed: ${msg}`);
    return;
  }

  output.clear();
  output.appendLine("Commentray init summary:");
  output.appendLine(`- created index: ${init.createdIndex ? "yes" : "no"}`);
  output.appendLine(`- migrated index: ${init.migratedIndex ? "yes" : "no"}`);
  output.appendLine(`- created .commentray.toml: ${init.createdToml ? "yes" : "no"}`);
  output.appendLine(`- added _site to .gitignore: ${init.addedSiteGitignore ? "yes" : "no"}`);
  for (const issue of init.validationIssues) {
    output.appendLine(`[${issue.level}] ${issue.message}`);
  }

  const hasErrors = init.validationIssues.some((i) => i.level === "error");
  if (hasErrors) {
    output.show(true);
    void vscode.window.showErrorMessage(
      "Commentray initialized, but validation reported errors. See the Commentray output panel.",
    );
  } else {
    void vscode.window.showInformationMessage("Commentray initialized for this workspace.");
  }

  void applyCommentrayActiveEditorUiContexts(vscode.window.activeTextEditor?.document.uri);
}

async function validateWorkspaceCommand(output: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolderForRepoWideCommand();
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
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;

  // Companion track is already focused — built-in preview applies to this `.md`.
  try {
    const relative = vscode.workspace.asRelativePath(active.editor.document.uri, false);
    const normalized = normalizeRepoRelativePath(relative.replaceAll("\\", "/"));
    const cfg = await loadCommentrayConfig(active.folder.uri.fsPath);
    const sourcePrefix = commentrayStorageSourcePrefix(cfg.storageDir);
    if (normalized.startsWith(sourcePrefix) && active.editor.document.fileName.endsWith(".md")) {
      await vscode.commands.executeCommand("markdown.showPreview", active.editor.document.uri);
      return;
    }
  } catch {
    /* fall through: resolve paired paths from primary */
  }

  const paths = await resolvePairedPaths(active.editor, active.folder);
  if (!paths) return;
  const ensured = await ensureCommentrayFile(paths.commentrayUri);
  await vscode.commands.executeCommand("markdown.showPreview", ensured);
}

async function openCorrespondingSourceCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showWarningMessage("Open a Commentray companion markdown file first.");
    return;
  }
  if (!vscode.workspace.workspaceFolders?.length) {
    await vscode.window.showWarningMessage("Open a workspace folder first.");
    return;
  }
  const active = await requireEditorInWorkspaceFolder(editor);
  if (!active) return;

  let normalized: string;
  try {
    const relative = vscode.workspace.asRelativePath(active.editor.document.uri, false);
    normalized = normalizeRepoRelativePath(relative.replaceAll("\\", "/"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(
      `Could not resolve a repo-relative path for the active editor: ${message}`,
    );
    return;
  }

  const repoRoot = active.folder.uri.fsPath;
  const cfg = await loadCommentrayConfig(repoRoot);
  const diskPair = resolveCompanionPathToSourcePair(normalized, repoRoot, cfg);

  if (!diskPair) {
    await vscode.window.showInformationMessage(
      "Open a Commentray companion `.md` (under storage/source or the configured static_site.commentray_markdown path) to jump to its primary source file.",
    );
    return;
  }

  const sourceAbs = path.join(repoRoot, ...diskPair.sourcePath.split("/"));
  const sourceUri = vscode.Uri.file(sourceAbs);
  try {
    await vscode.workspace.fs.stat(sourceUri);
  } catch {
    await vscode.window.showErrorMessage(
      `Primary source file is missing on disk: ${diskPair.sourcePath}`,
    );
    return;
  }

  const paths = pairedPathsFromDiskPair(repoRoot, diskPair);
  const sourceDoc = await vscode.workspace.openTextDocument(sourceUri);
  const { code, commentray } = await revealSourceLeftOfCompanionAndReturnEditors(editor, sourceDoc);
  await bindPairScrollSync(code, commentray, paths);
  await vscode.window.showTextDocument(code.document, {
    viewColumn: code.viewColumn,
    preview: false,
    preserveFocus: false,
  });
}

function resolveCompanionPathToSourcePair(
  normalizedRepoPath: string,
  repoRoot: string,
  cfg: Awaited<ReturnType<typeof loadCommentrayConfig>>,
): { sourcePath: string; commentrayPath: string } | null {
  const sourcePrefix = commentrayStorageSourcePrefix(cfg.storageDir);
  if (normalizedRepoPath.startsWith(sourcePrefix) && normalizedRepoPath.endsWith(".md")) {
    const relFromSourceDir = normalizedRepoPath.slice(sourcePrefix.length);
    const storageNorm = normalizeRepoRelativePath(cfg.storageDir.replaceAll("\\", "/"));
    const anglesOn = commentrayAnglesLayoutEnabled(repoRoot, cfg.storageDir);
    return pairFromCommentraySourceRel(storageNorm, relFromSourceDir, anglesOn);
  }

  const configured = cfg.staticSite.commentrayMarkdownFile
    ? normalizeRepoRelativePath(cfg.staticSite.commentrayMarkdownFile.replaceAll("\\", "/"))
    : "";
  if (
    configured.length > 0 &&
    normalizedRepoPath === configured &&
    cfg.staticSite.sourceFile.trim().length > 0
  ) {
    return {
      sourcePath: normalizeRepoRelativePath(cfg.staticSite.sourceFile.replaceAll("\\", "/")),
      commentrayPath: configured,
    };
  }

  return null;
}

async function openRenderedPreviewCore(
  editor: vscode.TextEditor,
  folder: vscode.WorkspaceFolder,
  angleId?: string | null,
): Promise<void> {
  const paths = await resolvePairedPaths(editor, folder, angleId);
  if (!paths) return;
  const ensured = await ensureCommentrayFile(paths.commentrayUri);
  const cfg = await loadCommentrayConfig(folder.uri.fsPath);
  const editorNow =
    vscode.window.visibleTextEditors.find((e) => e.document === editor.document) ?? editor;
  await CommentrayRenderedPreviewPanel.openOrReveal({
    repoRoot: paths.repoRoot,
    storageDir: cfg.storageDir,
    sourceRelative: paths.sourceRelative,
    commentrayPathRel: paths.commentrayPathRel,
    commentrayUri: ensured,
    sourceEditor: editorNow,
    pauseEditorScrollSync: () => disposeScrollSync(),
    restoreEditorScrollSync: () => applyScrollSyncSettingFromConfig(),
  });
}

async function openRenderedPreviewFromSourceCommand(): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  await openRenderedPreviewCore(active.editor, active.folder);
}

async function openRenderedPreviewChooseAngleCommand(arg?: unknown): Promise<void> {
  const active = await requireActiveEditorInWorkspace();
  if (!active) return;
  const angleId = await pickCommentrayAngleIdInteractively(
    active.folder,
    arg,
    "Rendered Commentray preview — angle",
    "Pick an angle for the current source file",
  );
  if (!angleId) return;

  await openRenderedPreviewCore(active.editor, active.folder, angleId);
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Commentray");
  commentrayOutput = output;
  const refreshUiContexts = () =>
    void applyCommentrayActiveEditorUiContexts(vscode.window.activeTextEditor?.document.uri);

  // Register commands before any listener that might throw — otherwise the host can show
  // "command … not found" when activation aborts mid-way.
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand("commentray.init", () => initWorkspaceCommand(output)),
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
    vscode.commands.registerCommand(
      "commentray.openCorrespondingSource",
      openCorrespondingSourceCommand,
    ),
    vscode.commands.registerCommand(
      "commentray.openRenderedPreview",
      openRenderedPreviewFromSourceCommand,
    ),
    vscode.commands.registerCommand(
      "commentray.openRenderedPreviewChooseAngle",
      openRenderedPreviewChooseAngleCommand,
    ),
    vscode.commands.registerCommand("commentray.validateWorkspace", () =>
      validateWorkspaceCommand(output),
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      try {
        if (!e.affectsConfiguration("commentray.scrollSync")) return;
        applyScrollSyncSettingFromConfig();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCommentray(`[commentray] scroll sync setting handler: ${msg}`);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      void applyCommentrayActiveEditorUiContexts(ed?.document.uri);
    }),
    vscode.window.onDidChangeWindowState((state) => {
      if (!state.focused) return;
      refreshUiContexts();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      refreshUiContexts();
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (path.basename(doc.uri.fsPath) !== ".commentray.toml") return;
      refreshUiContexts();
    }),
    // Watch for external init (e.g. `commentray serve` creating files without a save event).
    (() => {
      const watcher = vscode.workspace.createFileSystemWatcher("**/.commentray.toml");
      const refresh = () => refreshUiContexts();
      watcher.onDidCreate(refresh);
      watcher.onDidChange(refresh);
      watcher.onDidDelete(refresh);
      return watcher;
    })(),
    (() => {
      const watcher = vscode.workspace.createFileSystemWatcher(
        "**/.commentray/metadata/index.json",
      );
      const refresh = () => refreshUiContexts();
      watcher.onDidCreate(refresh);
      watcher.onDidChange(refresh);
      watcher.onDidDelete(refresh);
      return watcher;
    })(),
    (() => {
      const watcher = vscode.workspace.createFileSystemWatcher("**/.commentray/source/**");
      const refresh = () => refreshUiContexts();
      watcher.onDidCreate(refresh);
      watcher.onDidDelete(refresh);
      return watcher;
    })(),
    { dispose: () => disposeScrollSync() },
  );

  refreshUiContexts();
}

export function deactivate() {
  CommentrayRenderedPreviewPanel.disposeIfOpen();
  disposeScrollSync();
  lastBoundScrollPair = undefined;
  commentrayOutput = undefined;
  void applyCommentrayActiveEditorUiContexts(undefined);
}
