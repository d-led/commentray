import * as assert from "node:assert";
import { afterEach, before, beforeEach } from "mocha";
import * as vscode from "vscode";

export const pairedMarkdownPath = ".commentray/source/src/sample.ts/main.md";

const DOGFOOD_INTEGRATION_MARKDOWN_SOURCE_BYTES = new TextEncoder().encode(
  ["# Markdown source fixture", "", "alpha", "beta", "gamma", ""].join("\n"),
);

/** Tracked `fixtures/dogfood/src/sample.ts` (restored each test so “add block” region wraps do not accumulate). */
const DOGFOOD_SAMPLE_TS_BYTES = new TextEncoder().encode(
  [
    "// Sample source file for exercising the Commentray VS Code extension.",
    "//",
    "// Open this file and run **Commentray: Open paired markdown beside editor** (or",
    "// the angle / rendered-preview commands) to work with the companion Markdown",
    "// under `.commentray/source/src/sample.ts/`. README screenshots use longer",
    "// companion prose plus a page break so the rendered preview is readable in",
    "// small frames.",
    "",
    "export function greet(name: string): string {",
    "  return `Hello, ${name}!`;",
    "}",
    "",
    "export function farewell(name: string): string {",
    "  return `Goodbye, ${name}.`;",
    "}",
    "",
  ].join("\n"),
);

export type DogfoodWorkspaceAccessor = {
  /** Dogfood workspace folder URI; valid after the suite `before` hook runs. */
  root(): vscode.Uri;
};

async function restoreDogfoodMutableFixtures(workspaceRoot: vscode.Uri): Promise<void> {
  const sampleUri = vscode.Uri.joinPath(workspaceRoot, "src", "sample.ts");
  await vscode.workspace.fs.writeFile(sampleUri, DOGFOOD_SAMPLE_TS_BYTES);
  const integrationMarkdownSourceUri = vscode.Uri.joinPath(
    workspaceRoot,
    "docs",
    "integration-markdown-source.md",
  );
  await vscode.workspace.fs.writeFile(
    integrationMarkdownSourceUri,
    DOGFOOD_INTEGRATION_MARKDOWN_SOURCE_BYTES,
  );
}

/**
 * Registers suite-level `before` / `beforeEach` that resolve the dogfood folder and reset `.commentray/`.
 */
export function registerDogfoodWorkspaceLifecycle(): DogfoodWorkspaceAccessor {
  let workspaceRoot!: vscode.Uri;
  before(() => {
    workspaceRoot = dogfoodWorkspaceRoot();
  });
  beforeEach(async () => {
    await resetGeneratedCommentrayStorage(workspaceRoot);
    await restoreDogfoodMutableFixtures(workspaceRoot);
  });
  afterEach(async () => {
    await restoreDogfoodMutableFixtures(workspaceRoot);
  });
  return {
    root: () => workspaceRoot,
  };
}

/** Bytes of `fixtures/dogfood/.commentray.toml` (restored after Angles tests mutate it). */
const DOGFOOD_COMMENTRAY_TOML_BYTES = new TextEncoder().encode(
  `# Fixture Commentray config for the VS Code extension dogfood folder.
# Keeping defaults explicit so the project-root resolver locks onto this
# directory when the Extension Development Host opens it.

[storage]
# dir = ".commentray"

[render]
# mermaid = true
`,
);

export function dogfoodWorkspaceRoot(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "Expected a workspace folder (tests must run with fixtures/dogfood open).");
  return folder.uri;
}

export async function restoreDogfoodCommentrayToml(workspaceRoot: vscode.Uri): Promise<void> {
  const tomlUri = vscode.Uri.joinPath(workspaceRoot, ".commentray.toml");
  await vscode.workspace.fs.writeFile(tomlUri, DOGFOOD_COMMENTRAY_TOML_BYTES);
}

/** Enables Angles without importing `@commentray/core` (extension host resolves CJS vs package exports poorly). */
export async function enableAnglesDogfoodFixture(workspaceRoot: vscode.Uri): Promise<void> {
  const enc = new TextEncoder();
  const sentinelUri = vscode.Uri.joinPath(workspaceRoot, ".commentray", "source", ".default");
  await vscode.workspace.fs.writeFile(
    sentinelUri,
    enc.encode("# Commentray Angles layout sentinel (fixture).\n"),
  );
  const anglesToml = `[storage]
dir = ".commentray"

[angles]
default_angle = "main"

[[angles.definitions]]
id = "main"
title = "Main"

[[angles.definitions]]
id = "alt"
title = "Alt"
`;
  const tomlUri = vscode.Uri.joinPath(workspaceRoot, ".commentray.toml");
  await vscode.workspace.fs.writeFile(tomlUri, enc.encode(`${anglesToml}\n`));
}

export async function resetGeneratedCommentrayStorage(workspaceRoot: vscode.Uri): Promise<void> {
  const commentrayDir = vscode.Uri.joinPath(workspaceRoot, ".commentray");
  try {
    await vscode.workspace.fs.delete(commentrayDir, { recursive: true, useTrash: false });
  } catch {
    // Missing folder is fine.
  }
}

export async function openFixtureSourceFile(workspaceRoot: vscode.Uri): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(workspaceRoot, "src", "sample.ts"),
  );
  return vscode.window.showTextDocument(doc);
}
