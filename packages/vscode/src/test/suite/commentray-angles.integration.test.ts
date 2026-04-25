/**
 * Angles-specific Extension Host scenarios (dogfood fixture).
 */
import * as assert from "node:assert";
import * as vscode from "vscode";

import {
  dogfoodWorkspaceRoot,
  enableAnglesDogfoodFixture,
  openFixtureSourceFile,
  resetGeneratedCommentrayStorage,
  restoreDogfoodCommentrayToml,
} from "./commentray-dogfood-test-support.js";

describe("Commentray Angles in VS Code (integration)", () => {
  let workspaceRoot: vscode.Uri;

  before(() => {
    workspaceRoot = dogfoodWorkspaceRoot();
  });

  beforeEach(async () => {
    await resetGeneratedCommentrayStorage(workspaceRoot);
  });

  describe("Open paired markdown for a specific angle (programmatic)", () => {
    beforeEach(async () => {
      await enableAnglesDogfoodFixture(workspaceRoot);
    });

    afterEach(async () => {
      await restoreDogfoodCommentrayToml(workspaceRoot);
      await resetGeneratedCommentrayStorage(workspaceRoot);
    });

    it('Given Angles layout with two definitions, when open angle is invoked with { angleId: "alt" }, then the alt companion file is created under the per-source folder.', async () => {
      await openFixtureSourceFile(workspaceRoot);
      await vscode.commands.executeCommand("commentray.openCommentrayAngle", { angleId: "alt" });

      const altUri = vscode.Uri.joinPath(workspaceRoot, ".commentray/source/src/sample.ts/alt.md");
      const bytes = await vscode.workspace.fs.readFile(altUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(text.includes("# Commentray"), "Expected placeholder in alt angle Markdown.");
    });

    it('Given Angles layout, when open angle is invoked with { angleId: "main" }, then the default angle companion exists.', async () => {
      await openFixtureSourceFile(workspaceRoot);
      await vscode.commands.executeCommand("commentray.openCommentrayAngle", { angleId: "main" });

      const mainUri = vscode.Uri.joinPath(
        workspaceRoot,
        ".commentray/source/src/sample.ts/main.md",
      );
      const bytes = await vscode.workspace.fs.readFile(mainUri);
      const text = new TextDecoder("utf-8").decode(bytes);
      assert.ok(text.includes("# Commentray"), "Expected placeholder in main angle Markdown.");
    });
  });
});
