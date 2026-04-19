/**
 * Commentray — VS Code extension (integration)
 *
 * These examples describe behavior in plain language. They double as a source
 * for user-facing documentation: each scenario should read like a short spec
 * (“given / when / then”) without naming internal implementation details.
 */
import * as assert from "node:assert";
import * as vscode from "vscode";

const pairedMarkdownPath = ".commentray/source/sample.ts.md";

async function resetGeneratedCommentrayStorage(workspaceRoot: vscode.Uri): Promise<void> {
  const commentrayDir = vscode.Uri.joinPath(workspaceRoot, ".commentray");
  try {
    await vscode.workspace.fs.delete(commentrayDir, { recursive: true, useTrash: false });
  } catch {
    // Missing folder is fine.
  }
}

async function openFixtureSourceFile(workspaceRoot: vscode.Uri): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(workspaceRoot, "sample.ts"),
  );
  return vscode.window.showTextDocument(doc);
}

describe("Commentray in VS Code (integration)", () => {
  let workspaceRoot: vscode.Uri;

  before(() => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "Expected a workspace folder (tests must run with fixtures/dogfood open).");
    workspaceRoot = folder.uri;
  });

  beforeEach(async () => {
    await resetGeneratedCommentrayStorage(workspaceRoot);
  });

  describe("Open paired markdown beside the source editor", () => {
    it('Given a workspace with Commentray configured, when the user runs "Commentray: Open paired markdown beside editor" from a source file, then the paired Markdown file exists under `.commentray/source/` and starts with a Commentray heading.', async () => {
      await openFixtureSourceFile(workspaceRoot);
      await vscode.commands.executeCommand("commentray.openSideBySide");

      const pairedUri = vscode.Uri.joinPath(workspaceRoot, ...pairedMarkdownPath.split("/"));
      const bytes = await vscode.workspace.fs.readFile(pairedUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(
        text.includes("# Commentray"),
        "Expected default placeholder heading in new paired file.",
      );
    });
  });

  describe("Validate workspace", () => {
    it('Given an open folder, when the user runs "Commentray: Validate workspace", then the command completes without rejecting (results appear in the Commentray output channel).', async () => {
      await vscode.commands.executeCommand("commentray.validateWorkspace");
    });
  });

  describe("Add commentary block from selection", () => {
    it('Given a source file with a non-empty selection, when the user runs "Commentray: Add commentary block from selection", then the paired Markdown gains a `commentray:block` marker and the metadata index is updated.', async function () {
      this.timeout(90_000);
      const editor = await openFixtureSourceFile(workspaceRoot);
      const doc = editor.document;
      const start = new vscode.Position(5, 0);
      const end = doc.lineAt(7).range.end;
      editor.selection = new vscode.Selection(start, end);

      await vscode.commands.executeCommand("commentray.startBlockFromSelection");

      const pairedUri = vscode.Uri.joinPath(workspaceRoot, ...pairedMarkdownPath.split("/"));
      const mdBytes = await vscode.workspace.fs.readFile(pairedUri);
      const mdText = new TextDecoder("utf-8").decode(mdBytes);
      assert.ok(
        mdText.includes("<!-- commentray:block id="),
        "Expected block marker in paired Markdown.",
      );

      const indexUri = vscode.Uri.joinPath(workspaceRoot, ".commentray", "metadata", "index.json");
      const indexBytes = await vscode.workspace.fs.readFile(indexUri);
      const indexText = new TextDecoder("utf-8").decode(indexBytes);
      assert.ok(indexText.includes('"blocks"'), "Expected blocks array in index.json.");
    });
  });

  describe("Open Markdown preview for paired file", () => {
    it('Given the paired Markdown file is active, when the user runs "Commentray: Open Markdown preview for paired file", then the command runs without rejecting.', async () => {
      await openFixtureSourceFile(workspaceRoot);
      await vscode.commands.executeCommand("commentray.openSideBySide");

      const pairedUri = vscode.Uri.joinPath(workspaceRoot, ...pairedMarkdownPath.split("/"));
      const pairedDoc = await vscode.workspace.openTextDocument(pairedUri);
      await vscode.window.showTextDocument(pairedDoc);

      await vscode.commands.executeCommand("commentray.openCommentrayPreview");
    });
  });
});
