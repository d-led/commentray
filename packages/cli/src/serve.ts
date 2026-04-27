import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import process from "node:process";

import { loadCommentrayConfig, normalizeRepoRelativePath } from "@commentray/core";
import { appendHtmlToOpaqueBrowseRequestUrl } from "@commentray/render";
import chokidar from "chokidar";
import handler from "serve-handler";

import { startLivereloadServer } from "./serve-livereload.js";

export type ServeCliOptions = {
  port: number;
};

function posixPath(p: string): string {
  return p.replaceAll("\\", "/");
}

function serveHandlerOptions(siteAbs: string): Parameters<typeof handler>[2] {
  let renderSingle = true;
  const serveJsonPath = path.join(siteAbs, "serve.json");
  if (existsSync(serveJsonPath)) {
    try {
      const extra = JSON.parse(readFileSync(serveJsonPath, "utf8")) as { renderSingle?: boolean };
      if (typeof extra.renderSingle === "boolean") renderSingle = extra.renderSingle;
    } catch {
      /* ignore invalid serve.json */
    }
  }
  return {
    public: siteAbs,
    etag: true,
    cleanUrls: false,
    renderSingle,
    // Same hub entry as GitHub Pages: GET `/` serves `_site/index.html` (not a directory index).
    rewrites: [{ source: "/", destination: "/index.html" }],
  };
}

function attachStaticSiteHandler(
  siteAbs: string,
): (req: IncomingMessage, res: ServerResponse) => void {
  const opts = serveHandlerOptions(siteAbs);
  return (req: IncomingMessage, res: ServerResponse) => {
    const raw = req.url;
    if (typeof raw === "string" && raw.length > 0) {
      req.url = appendHtmlToOpaqueBrowseRequestUrl(raw);
    }
    // `cleanUrls: true` (serve-handler default) 301-strips trailing `/index` and `.html`, which breaks
    // portable `…/index.html` shims. Keep literal paths like GitHub Pages. `_site/serve.json` supplies
    // `renderSingle` (lone `index.html` in humane browse dirs); see `github-pages-site.ts`.
    void handler(req, res, opts).catch((err: unknown) => {
      process.stderr.write(
        `[commentray serve] request error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  };
}

function listenHttp(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = (err: Error) => {
      server.off("listening", onListen);
      reject(err);
    };
    const onListen = () => {
      server.off("error", onErr);
      resolve();
    };
    server.once("error", onErr);
    server.once("listening", onListen);
    server.listen(port, "0.0.0.0");
  });
}

export async function runServeStaticPages(
  repoRootAbs: string,
  opts: ServeCliOptions,
): Promise<void> {
  // Dynamic import: the static-site stack pulls `renderCodeBrowserHtml` and filesystem reads that
  // assume a Commentray **source** checkout. Consumer repos (and the Homebrew/SEA binary) only
  // ship the bundled CLI — load this stack when `serve` actually runs, not for `--help` / `--version`.
  const { buildGithubPagesStaticSite } =
    await import("@commentray/code-commentray-static/github-pages-site");
  const repoRoot = path.resolve(repoRootAbs);
  const siteRel = "_site";
  const siteAbs = path.join(repoRoot, siteRel);
  const livereload = await startLivereloadServer(opts.port + 1);

  async function rebuild(notifyBrowser = false): Promise<void> {
    process.stderr.write("[commentray serve] rebuilding…\n");
    await buildGithubPagesStaticSite({ repoRoot });
    await livereload?.injectIntoSite(siteAbs);
    process.stderr.write("[commentray serve] rebuild finished\n");
    if (notifyBrowser) livereload?.notifyReload();
  }

  await rebuild();

  const httpServer = createServer(attachStaticSiteHandler(siteAbs));
  try {
    await listenHttp(httpServer, opts.port);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[commentray serve] failed to listen on port ${String(opts.port)}: ${msg}\n`,
    );
    throw err;
  }
  process.stderr.write(
    `[commentray serve] HTTP listening on http://127.0.0.1:${String(opts.port)}/ (${siteRel})\n`,
  );

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
      void rebuild(true).catch((e: unknown) => {
        process.stderr.write(
          `[commentray serve] rebuild failed: ${e instanceof Error ? e.message : String(e)}\n`,
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

  async function stopHttpServerAsync(): Promise<void> {
    if (!httpServer.listening) return;
    const exitPromise = once(httpServer, "close");
    httpServer.close();
    const killTimer = setTimeout(() => {
      httpServer.closeAllConnections?.();
    }, 8000);
    try {
      await exitPromise;
    } finally {
      clearTimeout(killTimer);
    }
  }

  let exiting = false;
  const exitClean = (): void => {
    if (exiting) return;
    exiting = true;
    void (async () => {
      void watcher.close();
      await livereload?.close();
      await stopHttpServerAsync();
      process.exit(0);
    })();
  };

  process.once("SIGINT", exitClean);
  // `serve-with-package-watch.mjs` restarts the CLI via SIGTERM.
  process.once("SIGTERM", exitClean);
}
