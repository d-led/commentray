#!/usr/bin/env node
/**
 * Automated **desktop VS Code** screenshots for the extension README companion assets.
 *
 * **Entrypoint:** `bash scripts/refresh-vscode-readme-screenshots-desktop.sh` (see companion
 * `.commentray/source/packages/vscode/README.md/main.md` → Maintainer → how scenarios work).
 *
 * - Downloads VS Code via `@vscode/test-electron` (same cache as `packages/vscode/.vscode-test`).
 * - Launches Electron with `--extensionDevelopmentPath`, dogfood workspace, `--remote-debugging-port`.
 * - Drives the UI with the keyboard and captures PNGs with Playwright `chromium.connectOverCDP`.
 *
 * Prerequisites: `npm run build -w @commentray/core && npm run build -w commentray-vscode` (or set
 * `COMMENTRAY_DESKTOP_SCREENSHOT_SKIP_BUILD=1` if `packages/vscode/dist/extension.js` is fresh).
 * One-time: `npx playwright install chromium` (CDP client).
 *
 * Optional:
 * - `VSCODE_TEST_VERSION` (default `stable`).
 * - `COMMENTRAY_VSCODE_VIEWPORT_WIDTH` / `COMMENTRAY_VSCODE_VIEWPORT_HEIGHT` (defaults **1200×780**).
 * - `COMMENTRAY_VSCODE_ZOOM_LEVEL` — `window.zoomLevel` for the temp profile (default **2**).
 * - `COMMENTRAY_VSCODE_CDP_PORT` — fixed CDP port (default random 20k–60k).
 *
 * Profile tweaks (cleaner shots): hide the secondary (Agent/Chat) sidebar and bump UI zoom via
 * `User/settings.json` in the disposable user-data dir.
 *
 * Output PNGs (all under `.commentray/source/packages/vscode/README.md/assets/`):
 *   vscode-palette-commentray.png
 *   vscode-open-paired-beside.png
 *   vscode-open-paired-choose-angle.png
 *   vscode-add-block-from-selection.png
 *   vscode-add-angle-to-project.png
 *   vscode-markdown-preview.png
 *   vscode-validate-workspace.png
 *
 * @see https://github.com/microsoft/playwright/issues/22351
 */
import { execSync, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vscodePkg = path.join(repoRoot, "packages", "vscode");
const extRoot = vscodePkg;
const dogfood = path.join(extRoot, "fixtures", "dogfood");
const assetsDir = path.join(
  repoRoot,
  ".commentray",
  "source",
  "packages",
  "vscode",
  "README.md",
  "assets",
);
const extensionJs = path.join(vscodePkg, "dist", "extension.js");

const viewportWidth = Math.max(
  800,
  Number(process.env.COMMENTRAY_VSCODE_VIEWPORT_WIDTH ?? "1200", 10),
);
const viewportHeight = Math.max(
  600,
  Number(process.env.COMMENTRAY_VSCODE_VIEWPORT_HEIGHT ?? "780", 10),
);

/** Palette shows contributed commands as `Category: title` (see `packages/vscode/package.json`). */
function commentrayCommand(title) {
  return `Commentray: ${title}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const paletteShortcut = process.platform === "darwin" ? "Meta+Shift+P" : "Control+Shift+P";
const quickOpenShortcut = process.platform === "darwin" ? "Meta+P" : "Control+P";
const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A";
const focusGroup = (n) => (process.platform === "darwin" ? `Meta+${n}` : `Control+${n}`);

async function ensureBuilt() {
  if ((process.env.COMMENTRAY_DESKTOP_SCREENSHOT_SKIP_BUILD ?? "").trim() === "1") {
    await access(extensionJs);
    return;
  }
  try {
    await access(extensionJs);
    return;
  } catch {
    /* build */
  }
  execSync("npm run build -w @commentray/core && npm run build -w commentray-vscode", {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}

async function waitForCdp(port, timeoutMs) {
  const url = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error(`CDP not ready on http://127.0.0.1:${port} within ${timeoutMs}ms`);
}

/**
 * @param {import('playwright').Browser} browser
 */
function pickWorkbenchPage(browser) {
  const pages = browser.contexts().flatMap((c) => c.pages());
  if (pages.length === 0) {
    return undefined;
  }
  let best;
  for (const p of pages) {
    const v = p.viewportSize();
    const area = (v?.width ?? 0) * (v?.height ?? 0);
    if (!best || area > best.area) {
      best = { page: p, area };
    }
  }
  return best?.page ?? pages[0];
}

/**
 * @param {import('playwright').Browser} browser
 */
async function waitForAnyPage(browser, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const p = pickWorkbenchPage(browser);
    if (p) return p;
    await sleep(400);
  }
  return undefined;
}

/**
 * @param {import('playwright').Page} page
 */
async function dismissOverlays(page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Escape");
    await sleep(180);
  }
}

/**
 * Open the command palette in **command (run) mode** so `Commentray: …` matches contributed
 * commands. Without a leading `>`, the unified picker often stays in file-search mode → "No matching results".
 *
 * @param {import('playwright').Page} page
 */
async function openCommandPaletteCommandMode(page) {
  await dismissOverlays(page);
  await page.keyboard.press(paletteShortcut);
  await sleep(850);
  await page.keyboard.press(selectAllShortcut);
  await sleep(90);
  await page.keyboard.press("Backspace");
  await sleep(160);
  await page.keyboard.type(">", { delay: 35 });
  await sleep(380);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} commandQuery text after the leading `>` (e.g. `Commentray: Validate workspace`)
 */
async function runPaletteQuery(page, commandQuery, { afterEnterMs = 3500, typeDelay = 20 } = {}) {
  await openCommandPaletteCommandMode(page);
  await page.keyboard.type(commandQuery, { delay: typeDelay });
  await sleep(500);
  await page.keyboard.press("Enter");
  await sleep(afterEnterMs);
}

/**
 * @param {string} userDataDir
 */
async function writeScreenshotProfileSettings(userDataDir) {
  const userDir = path.join(userDataDir, "User");
  await mkdir(userDir, { recursive: true });
  const zoomRaw = process.env.COMMENTRAY_VSCODE_ZOOM_LEVEL ?? "2";
  const zoom = Number.parseFloat(zoomRaw);
  const settings = {
    "window.zoomLevel": Number.isFinite(zoom) ? zoom : 2,
    // Secondary / Agent / Chat column — keep README frames editor-focused.
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "workbench.startupEditor": "none",
  };
  await writeFile(
    path.join(userDir, "settings.json"),
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf-8",
  );
}

/**
 * @param {import('playwright').Page} page
 */
async function shot(page, filename) {
  await page.screenshot({
    path: path.join(assetsDir, filename),
    animations: "disabled",
  });
}

/**
 * @param {import('playwright').Page} page
 */
async function openSampleTs(page) {
  await dismissOverlays(page);
  await page.keyboard.press(quickOpenShortcut);
  await sleep(700);
  await page.keyboard.press(selectAllShortcut);
  await sleep(120);
  await page.keyboard.type("src/sample.ts", { delay: 22 });
  await sleep(400);
  await page.keyboard.press("Enter");
  await sleep(4200);
}

async function downloadVscodeForScreenshots() {
  const { downloadAndUnzipVSCode } = await import("@vscode/test-electron/out/index.js");
  const version = (process.env.VSCODE_TEST_VERSION ?? "").trim() || "stable";
  const cachePath = path.join(vscodePkg, ".vscode-test");
  return downloadAndUnzipVSCode({
    cachePath,
    version,
    extensionDevelopmentPath: extRoot,
  });
}

function resolveCdpPort() {
  return Number(
    process.env.COMMENTRAY_VSCODE_CDP_PORT ?? String(20_000 + Math.floor(Math.random() * 40_000)),
    10,
  );
}

function vscodeLaunchArgs(cdpPort, extensionsDir, userDataDir) {
  return [
    `--remote-debugging-port=${cdpPort}`,
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--disable-updates",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
    `--extensions-dir=${extensionsDir}`,
    `--user-data-dir=${userDataDir}`,
    `--extensionDevelopmentPath=${extRoot}`,
    dogfood,
  ];
}

async function prepareDisposableProfile() {
  const profileRoot = await mkdtemp(path.join(os.tmpdir(), "commentray-desktop-shot-"));
  const userDataDir = path.join(profileRoot, "user-data");
  const extensionsDir = path.join(profileRoot, "extensions");
  await mkdir(userDataDir, { recursive: true });
  await mkdir(extensionsDir, { recursive: true });
  await writeScreenshotProfileSettings(userDataDir);
  return { profileRoot, userDataDir, extensionsDir };
}

/**
 * @param {import('playwright').Page} page
 */
async function runScreenshotScenarios(page) {
  await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
  await sleep(15_000);

  await openCommandPaletteCommandMode(page);
  await page.keyboard.type("Commentray", { delay: 22 });
  await sleep(700);
  await shot(page, "vscode-palette-commentray.png");
  await dismissOverlays(page);

  await openSampleTs(page);

  await runPaletteQuery(page, commentrayCommand("Open paired markdown beside editor"), {
    afterEnterMs: 5500,
  });
  await shot(page, "vscode-open-paired-beside.png");

  await runPaletteQuery(page, commentrayCommand("Open paired markdown (choose angle)"), {
    afterEnterMs: 2800,
  });
  await shot(page, "vscode-open-paired-choose-angle.png");
  await dismissOverlays(page);

  await page.keyboard.press(focusGroup(1));
  await sleep(500);
  await page.keyboard.press(selectAllShortcut);
  await sleep(350);
  await runPaletteQuery(page, commentrayCommand("Add commentary block from selection"), {
    afterEnterMs: 6500,
  });
  await shot(page, "vscode-add-block-from-selection.png");
  await dismissOverlays(page);

  await runPaletteQuery(page, commentrayCommand(`Add angle to project\u2026`), {
    afterEnterMs: 2800,
  });
  await shot(page, "vscode-add-angle-to-project.png");
  await dismissOverlays(page);

  await page.keyboard.press(focusGroup(2));
  await sleep(700);
  await runPaletteQuery(page, commentrayCommand("Open Markdown preview for paired file"), {
    afterEnterMs: 4500,
  });
  await shot(page, "vscode-markdown-preview.png");
  await dismissOverlays(page);

  await runPaletteQuery(page, commentrayCommand("Validate workspace"), { afterEnterMs: 3500 });
  await runPaletteQuery(page, "Output: Focus on Output View", { afterEnterMs: 3200 });
  await shot(page, "vscode-validate-workspace.png");
  await dismissOverlays(page);
}

/**
 * @param {import('playwright').Browser | undefined} browser
 * @param {import('node:child_process').ChildProcess} child
 * @param {string} profileRoot
 */
async function shutdownVscodeSession(browser, child, profileRoot) {
  try {
    if (browser) await browser.close();
  } catch {
    /* ignore */
  }
  child.kill("SIGTERM");
  await sleep(1500);
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
  await rm(profileRoot, { recursive: true, force: true });
}

async function main() {
  await ensureBuilt();
  await mkdir(assetsDir, { recursive: true });

  const vscodeExecutablePath = await downloadVscodeForScreenshots();
  const { profileRoot, userDataDir, extensionsDir } = await prepareDisposableProfile();
  const cdpPort = resolveCdpPort();
  const child = spawn(vscodeExecutablePath, vscodeLaunchArgs(cdpPort, extensionsDir, userDataDir), {
    stdio: "ignore",
    detached: false,
    env: { ...process.env },
  });

  const { chromium } = await import("playwright");
  let browser;
  try {
    await waitForCdp(cdpPort, 120_000);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    const page = await waitForAnyPage(browser, 90_000);
    if (!page) {
      const n = browser.contexts().reduce((a, c) => a + c.pages().length, 0);
      throw new Error(`No page found after CDP connect (context page count: ${n})`);
    }
    await runScreenshotScenarios(page);
  } finally {
    await shutdownVscodeSession(browser, child, profileRoot);
  }

  console.log("Wrote desktop VS Code screenshots to:", assetsDir);
}

await main();
