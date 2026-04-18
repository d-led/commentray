import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import { buildGithubPagesStaticSite } from "@commentray/code-commentray-static/github-pages-site";
import { loadCommentrayConfig, normalizeRepoRelativePath } from "@commentray/core";
import chokidar from "chokidar";

export type ServeCliOptions = {
  port: number;
};

function resolveServeMain(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("serve/build/main.js");
}

function posixPath(p: string): string {
  return p.replaceAll("\\", "/");
}

export async function runServeStaticPages(
  repoRootAbs: string,
  opts: ServeCliOptions,
): Promise<void> {
  const repoRoot = path.resolve(repoRootAbs);
  const serveMain = resolveServeMain();
  const siteRel = "_site";

  async function rebuild(): Promise<void> {
    process.stderr.write("[commentray serve] rebuilding…\n");
    await buildGithubPagesStaticSite({ repoRoot });
    process.stderr.write("[commentray serve] rebuild finished\n");
  }

  await rebuild();

  const serveArgs = [serveMain, siteRel, "-s", "-l", String(opts.port), "-n"];
  const serveChild = spawn(process.execPath, serveArgs, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  serveChild.on("exit", (code, signal) => {
    if (signal === "SIGTERM") return;
    process.stderr.write(
      `[commentray serve] static server exited (${code ?? "null"} / ${signal ?? "null"})\n`,
    );
    process.exit(code ?? 1);
  });

  const cfg = await loadCommentrayConfig(repoRoot);
  const ss = cfg.staticSite;
  const storageNorm = normalizeRepoRelativePath(cfg.storageDir.replaceAll("\\", "/"));
  const storageAbs = path.join(repoRoot, ...storageNorm.split("/"));
  const storageGlob = `${posixPath(storageAbs)}/**`;

  const watchPaths: string[] = [
    path.join(repoRoot, ".commentray.toml"),
    posixPath(path.join(repoRoot, ss.sourceFile)),
    storageGlob,
    path.join(repoRoot, ".commentray", "metadata", "index.json"),
  ];
  if (ss.commentrayMarkdownFile) {
    watchPaths.push(posixPath(path.join(repoRoot, ss.commentrayMarkdownFile)));
  }

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const queueRebuild = (): void => {
    if (debounce !== undefined) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = undefined;
      void rebuild().catch((err: unknown) => {
        process.stderr.write(
          `[commentray serve] rebuild failed: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      });
    }, 300);
  };

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    ignored: ["**/node_modules/**", "**/_site/**"],
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 100 },
  });
  watcher.on("all", () => {
    queueRebuild();
  });

  const shutdown = (): void => {
    void watcher.close();
    serveChild.kill("SIGTERM");
  };

  process.on("SIGINT", () => {
    shutdown();
    process.exit(0);
  });
}
