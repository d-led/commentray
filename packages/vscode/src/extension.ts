import {
  commentrayMarkdownPath,
  normalizeRepoRelativePath,
  validateProject,
} from "@commentray/core";
import * as path from "node:path";
import * as vscode from "vscode";

type ScrollPair = {
  code: vscode.TextEditor;
  commentray: vscode.TextEditor;
};

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

    const codeLines = Math.max(1, activePair.code.document.lineCount);
    const commentrayLines = Math.max(1, activePair.commentray.document.lineCount);

    const center = (range.start.line + range.end.line) / 2;
    const fraction = center / Math.max(1, codeLines - 1);
    const targetLine = Math.min(
      commentrayLines - 1,
      Math.max(0, Math.round(fraction * (commentrayLines - 1))),
    );

    const reveal = new vscode.Range(targetLine, 0, targetLine, 0);
    activePair.commentray.revealRange(
      reveal,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  });
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

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("commentray.openSideBySide", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showWarningMessage("Open a source file first.");
        return;
      }

      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) {
        await vscode.window.showWarningMessage("Open a workspace folder first.");
        return;
      }

      const repoRoot = folder.uri.fsPath;
      const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
      let normalized: string;
      try {
        normalized = normalizeRepoRelativePath(relative.replaceAll("\\", "/"));
      } catch (err) {
        await vscode.window.showErrorMessage(
          `Could not resolve a repo-relative path for the active editor: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return;
      }

      // Leave the source editor wherever the user put it. Open the
      // Commentray markdown in a column to the right of it (`Beside`
      // creates a split if none exists, or reuses the existing
      // right-hand column). This is the tool's core affordance:
      // source on one side, commentary on the other — never two tabs
      // stacked in the same column.
      const commentrayUri = vscode.Uri.file(commentrayAbsolutePath(repoRoot, normalized));
      const ensured = await ensureCommentrayFile(commentrayUri);
      const commentrayDoc = await vscode.workspace.openTextDocument(ensured);
      const commentrayEditor = await vscode.window.showTextDocument(commentrayDoc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });

      const codeEditor =
        vscode.window.visibleTextEditors.find((te) => te.document === editor.document) ?? editor;

      bindScrollSync({ code: codeEditor, commentray: commentrayEditor });
    }),
  );

  const output = vscode.window.createOutputChannel("Commentray");
  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.commands.registerCommand("commentray.validateWorkspace", async () => {
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
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("commentray.openCommentrayPreview", async () => {
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
    }),
  );

  context.subscriptions.push({ dispose: () => disposeScrollSync() });
}

export function deactivate() {
  disposeScrollSync();
}
