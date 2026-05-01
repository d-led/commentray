/**
 * Angles-specific Extension Host scenarios (dogfood fixture).
 */
import * as assert from "node:assert";
import * as vscode from "vscode";

import {
  enableAnglesDogfoodFixture,
  openFixtureSourceFile,
  registerDogfoodWorkspaceLifecycle,
  resetGeneratedCommentrayStorage,
  restoreDogfoodCommentrayToml,
} from "./commentray-dogfood-test-support.js";

describe("Commentray Angles in VS Code (integration)", () => {
  const dogfoodWorkspace = registerDogfoodWorkspaceLifecycle();

  beforeEach(async () => {
    await enableAnglesDogfoodFixture(dogfoodWorkspace.root());
  });

  afterEach(async () => {
    await restoreDogfoodCommentrayToml(dogfoodWorkspace.root());
    await resetGeneratedCommentrayStorage(dogfoodWorkspace.root());
  });

  describe("Open paired markdown for a specific angle (programmatic)", () => {
    it('Given Angles layout with two definitions, when open angle is invoked with { angleId: "alt" }, then the alt companion file is created under the per-source folder.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openCommentrayAngle", { angleId: "alt" });

      const altUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ".commentray/source/src/sample.ts/alt.md",
      );
      const bytes = await vscode.workspace.fs.readFile(altUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(text.includes("# Commentray"), "Expected placeholder in alt angle Markdown.");
    });

    it('Given Angles layout, when open angle is invoked with { angleId: "main" }, then the default angle companion exists.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openCommentrayAngle", { angleId: "main" });

      const mainUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ".commentray/source/src/sample.ts/main.md",
      );
      const bytes = await vscode.workspace.fs.readFile(mainUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(text.includes("# Commentray"), "Expected placeholder in main angle Markdown.");
    });

    it('Given Angles layout, when rendered preview choose angle runs with { angleId: "alt" }, then the command completes without rejecting.', async () => {
      const editor = await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.window.showTextDocument(editor.document, { preview: false });
      await vscode.commands.executeCommand("commentray.openRenderedPreviewChooseAngle", {
        angleId: "alt",
      });
    });

    it('Given Angles layout and the main-angle companion is active, when the user runs "Commentray: Open corresponding source file", then the primary source file is focused.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openCommentrayAngle", { angleId: "main" });

      const mainUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ".commentray/source/src/sample.ts/main.md",
      );
      const mainDoc = await vscode.workspace.openTextDocument(mainUri);
      await vscode.window.showTextDocument(mainDoc);

      await vscode.commands.executeCommand("commentray.openCorrespondingSource");

      const active = vscode.window.activeTextEditor;
      assert.ok(active, "Expected an active editor after opening corresponding source.");
      const sampleFs = vscode.Uri.joinPath(dogfoodWorkspace.root(), "src", "sample.ts").fsPath;
      assert.strictEqual(active.document.uri.fsPath, sampleFs);
      const hasSample = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.fsPath === sampleFs,
      );
      const hasMain = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.fsPath === mainUri.fsPath,
      );
      assert.ok(
        hasSample && hasMain,
        "Expected the primary source and main-angle companion visible together for scroll sync.",
      );
    });
  });

  describe("Add angle to project (programmatic)", () => {
    it('Given Angles layout is enabled, when add angle is invoked with { id: "architecture", title: "Architecture", makeDefault: false }, then .commentray.toml includes that definition.', async () => {
      await vscode.commands.executeCommand("commentray.addAngleDefinition", {
        id: "architecture",
        title: "Architecture",
        makeDefault: false,
      });

      const tomlUri = vscode.Uri.joinPath(dogfoodWorkspace.root(), ".commentray.toml");
      const bytes = await vscode.workspace.fs.readFile(tomlUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(text.includes('id = "architecture"'), "Expected new angle id in .commentray.toml.");
      assert.ok(
        text.includes('title = "Architecture"'),
        "Expected new angle title in .commentray.toml.",
      );
    });
  });

  describe("Active editor UI flags with Angles dogfood", () => {
    it("Given Angles layout paths, when core computes UI flags for main.md, then the companion is under the tree and resolvable", async () => {
      const { commentrayActiveEditorUiFlags } =
        await import("../../../../core/dist/commentray-active-editor-ui-context.js");
      const root = dogfoodWorkspace.root().fsPath;
      const flags = commentrayActiveEditorUiFlags({
        normalizedRepoRelativePath: ".commentray/source/src/sample.ts/main.md",
        storageDir: ".commentray",
        repoRoot: root,
      });
      assert.deepStrictEqual(flags, {
        underCompanionSourceTree: true,
        isResolvableCompanionMarkdown: true,
      });
    });
  });
});
