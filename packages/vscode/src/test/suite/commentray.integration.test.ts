/**
 * Commentray — VS Code extension (integration)
 *
 * These examples describe behavior in plain language. They double as a source
 * for user-facing documentation: each scenario should read like a short spec
 * (“given / when / then”) without naming internal implementation details.
 */
import * as assert from "node:assert";
import * as vscode from "vscode";

import {
  type DogfoodWorkspaceAccessor,
  openFixtureSourceFile,
  pairedMarkdownPath,
  registerDogfoodWorkspaceLifecycle,
} from "./commentray-dogfood-test-support.js";

/** Same implementation the extension calls; loaded via relative path because the EDH resolves `@commentray/core` package exports poorly under `require()`. */
type ValidateProjectFn = (
  repoRoot: string,
) => Promise<{ issues: readonly { level: string; message: string }[] }>;

function registerExtensionSurfaceTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Extension command surface", () => {
    before(async () => {
      const editor = await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openSideBySide");
      await vscode.window.showTextDocument(editor.document, { preview: false });
    });

    it("Given the extension is active, when querying VS Code commands, then Angles-related Commentray commands are registered.", async () => {
      const cmds = await vscode.commands.getCommands(true);
      assert.ok(cmds.includes("commentray.openCommentrayAngle"));
      assert.ok(cmds.includes("commentray.addAngleDefinition"));
      assert.ok(cmds.includes("commentray.openRenderedPreview"));
      assert.ok(cmds.includes("commentray.openRenderedPreviewChooseAngle"));
      assert.ok(cmds.includes("commentray.openCorrespondingSource"));
    });
  });
}

function registerOpenPairedMarkdownTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Open paired markdown beside the source editor", () => {
    it('Given a workspace with Commentray configured, when the user runs "Commentray: Open paired markdown beside editor" from a source file, then the paired Markdown file exists under `.commentray/source/` and starts with a Commentray heading.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openSideBySide");

      const pairedUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ...pairedMarkdownPath.split("/"),
      );
      const bytes = await vscode.workspace.fs.readFile(pairedUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(
        text.includes("# Commentray"),
        "Expected default placeholder heading in new paired file.",
      );
    });

    it("Given a primary file URI (as from Explorer), when the user runs open paired with that URI, then the paired Markdown is created the same way.", async () => {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      const sampleUri = vscode.Uri.joinPath(dogfoodWorkspace.root(), "src", "sample.ts");
      await vscode.commands.executeCommand("commentray.openSideBySide", sampleUri);

      const pairedUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ...pairedMarkdownPath.split("/"),
      );
      const bytes = await vscode.workspace.fs.readFile(pairedUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(text.includes("# Commentray"), "Expected paired file from URI-driven open.");
    });
  });
}

function registerValidateWorkspaceTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Validate workspace", () => {
    let validateProject: ValidateProjectFn;

    before(async () => {
      const mod = await import("../../../../core/dist/validate-project.js");
      validateProject = mod.validateProject;
    });

    it("Given a clean dogfood tree (no generated `.commentray/` yet), when `validateProject` runs on that folder, then it reports storage or index warnings — not a config load failure.", async () => {
      const root = dogfoodWorkspace.root().fsPath;
      const { issues } = await validateProject(root);
      assert.ok(
        issues.length >= 1,
        "Expected at least one validation issue for a repo without storage dirs.",
      );
      assert.ok(
        issues.every((i) => i.level === "warn" || i.level === "error"),
        "Issues must use warn or error level.",
      );
      const text = issues.map((i) => i.message).join("\n");
      assert.ok(
        text.includes("Missing directory:") || text.includes("No metadata index at"),
        `Expected missing storage or missing index warnings; got:\n${text}`,
      );
      assert.ok(
        !text.includes("Failed to load .commentray.toml"),
        "Dogfood .commentray.toml must remain valid for this fixture.",
      );
    });

    it('Given an open folder, when the user runs "Commentray: Validate workspace", then the command completes and core `validateProject` still reports the same issues afterward.', async () => {
      const root = dogfoodWorkspace.root().fsPath;
      const before = await validateProject(root);
      await vscode.commands.executeCommand("commentray.validateWorkspace");
      const after = await validateProject(root);
      assert.strictEqual(
        after.issues.length,
        before.issues.length,
        "Validate workspace must not mutate project state in a way that changes issue count for a static tree.",
      );
      assert.deepStrictEqual(
        after.issues.map((i) => `${i.level}:${i.message}`),
        before.issues.map((i) => `${i.level}:${i.message}`),
        "Validate workspace should surface the same validation result as `validateProject` for this folder.",
      );
    });

    it("Given paired Markdown was opened once, when `validateProject` runs, then the `.commentray/source` tree exists so validation no longer warns about a missing source directory.", async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openSideBySide");
      const root = dogfoodWorkspace.root().fsPath;
      const { issues } = await validateProject(root);
      const text = issues.map((i) => i.message).join("\n");
      assert.ok(
        !text.includes("Missing directory: .commentray/source"),
        `Did not expect missing source dir after pair open; got:\n${text}`,
      );
    });
  });
}

function registerAddBlockFromSelectionTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Add commentary block from selection", () => {
    it('Given a source file with a non-empty selection, when the user runs "Commentray: Add commentary block from selection", then the paired Markdown gains a `commentray:block` marker and the metadata index is updated.', async function () {
      this.timeout(90_000);
      const editor = await openFixtureSourceFile(dogfoodWorkspace.root());
      const doc = editor.document;
      const start = new vscode.Position(5, 0);
      const end = doc.lineAt(7).range.end;
      editor.selection = new vscode.Selection(start, end);

      await vscode.commands.executeCommand("commentray.startBlockFromSelection");

      const samplePath = vscode.Uri.joinPath(dogfoodWorkspace.root(), "src", "sample.ts").fsPath;
      const sampleDoc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === samplePath);
      assert.ok(sampleDoc, "Expected sample.ts buffer after add-block.");
      const sampleText = sampleDoc.getText();
      assert.ok(
        sampleText.includes("//#region commentray:") &&
          sampleText.includes("//#endregion commentray:"),
        "Expected TypeScript Commentray region delimiters around the selection in the primary file.",
      );

      const pairedUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ...pairedMarkdownPath.split("/"),
      );
      const mdBytes = await vscode.workspace.fs.readFile(pairedUri);
      const mdText = new TextDecoder("utf-8").decode(mdBytes);
      assert.ok(
        mdText.includes("<!-- commentray:block id="),
        "Expected block marker in paired Markdown.",
      );

      const indexUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ".commentray",
        "metadata",
        "index.json",
      );
      const indexBytes = await vscode.workspace.fs.readFile(indexUri);
      const indexText = new TextDecoder("utf-8").decode(indexBytes);
      assert.ok(indexText.includes('"blocks"'), "Expected blocks array in index.json.");
    });
  });
}

function registerActiveEditorUiFlagsContractTests(
  dogfoodWorkspace: DogfoodWorkspaceAccessor,
): void {
  describe("Active editor UI flags (core contract for menus)", () => {
    it("Given dogfood paths, when core computes UI flags, then the companion markdown is under the tree and resolvable and the primary file is not", async () => {
      const { commentrayActiveEditorUiFlags } =
        await import("../../../../core/dist/commentray-active-editor-ui-context.js");
      const root = dogfoodWorkspace.root().fsPath;
      const companion = commentrayActiveEditorUiFlags({
        normalizedRepoRelativePath: pairedMarkdownPath,
        storageDir: ".commentray",
        repoRoot: root,
      });
      assert.deepStrictEqual(companion, {
        underCompanionSourceTree: true,
        isResolvableCompanionMarkdown: true,
      });
      const primary = commentrayActiveEditorUiFlags({
        normalizedRepoRelativePath: "src/sample.ts",
        storageDir: ".commentray",
        repoRoot: root,
      });
      assert.deepStrictEqual(primary, {
        underCompanionSourceTree: false,
        isResolvableCompanionMarkdown: false,
      });
    });
  });
}

function registerOpenCorrespondingSourceTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Open corresponding source file from companion markdown", () => {
    it('Given the paired Commentray markdown is active, when the user runs "Commentray: Open corresponding source file", then the primary source editor becomes active for that pair.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openSideBySide");

      const pairedUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ...pairedMarkdownPath.split("/"),
      );
      const pairedDoc = await vscode.workspace.openTextDocument(pairedUri);
      await vscode.window.showTextDocument(pairedDoc);

      await vscode.commands.executeCommand("commentray.openCorrespondingSource");

      const active = vscode.window.activeTextEditor;
      assert.ok(active, "Expected an active editor after opening corresponding source.");
      const sampleFs = vscode.Uri.joinPath(dogfoodWorkspace.root(), "src", "sample.ts").fsPath;
      assert.strictEqual(
        active.document.uri.fsPath,
        sampleFs,
        "Expected focus on the dogfood primary source file.",
      );
      const pairedFs = pairedUri.fsPath;
      const hasSample = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.fsPath === sampleFs,
      );
      const hasPaired = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.fsPath === pairedFs,
      );
      assert.ok(
        hasSample && hasPaired,
        "Expected the primary source and companion markdown to stay visible together for scroll sync.",
      );
    });
  });
}

function registerMarkdownPreviewTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Open Markdown preview for paired file", () => {
    it('Given the paired Markdown file is active, when the user runs "Commentray: Open Markdown preview for paired file", then the command runs without rejecting.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openSideBySide");

      const pairedUri = vscode.Uri.joinPath(
        dogfoodWorkspace.root(),
        ...pairedMarkdownPath.split("/"),
      );
      const pairedDoc = await vscode.workspace.openTextDocument(pairedUri);
      await vscode.window.showTextDocument(pairedDoc);

      await vscode.commands.executeCommand("commentray.openCommentrayPreview");
    });

    it('Given a primary source file that is not Markdown is active, when the user runs "Commentray: Open Markdown preview for paired file", then the command runs without rejecting.', async () => {
      await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.commands.executeCommand("commentray.openCommentrayPreview");
    });
  });
}

function registerRenderedPreviewTests(dogfoodWorkspace: DogfoodWorkspaceAccessor): void {
  describe("Open rendered Commentray preview (library HTML + webview)", () => {
    it('Given a primary source file is active, when the user runs "Commentray: Open rendered Commentray preview (default angle)", then the command completes without rejecting.', async () => {
      const editor = await openFixtureSourceFile(dogfoodWorkspace.root());
      await vscode.window.showTextDocument(editor.document, { preview: false });
      await vscode.commands.executeCommand("commentray.openRenderedPreview");
    });
  });
}

describe("Commentray in VS Code (integration)", () => {
  const dogfoodWorkspace = registerDogfoodWorkspaceLifecycle();
  registerExtensionSurfaceTests(dogfoodWorkspace);
  registerOpenPairedMarkdownTests(dogfoodWorkspace);
  registerActiveEditorUiFlagsContractTests(dogfoodWorkspace);
  registerOpenCorrespondingSourceTests(dogfoodWorkspace);
  registerValidateWorkspaceTests(dogfoodWorkspace);
  registerAddBlockFromSelectionTests(dogfoodWorkspace);
  registerMarkdownPreviewTests(dogfoodWorkspace);
  registerRenderedPreviewTests(dogfoodWorkspace);
});
