#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runCommanderMain } from "@commentray/core";
import { Command } from "commander";
import { buildCommentrayStatic } from "./build.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(here, "..");
const defaultSource = path.join(pkgRoot, "fixtures", "sample.ts");
const defaultMarkdown = path.join(pkgRoot, "fixtures", "sample.md");
const defaultOut = path.join(pkgRoot, "site", "index.html");

const program = new Command();
program
  .name("code-commentray-static")
  .description("Emit a static HTML code + commentray browser page")
  .option("--source <path>", "Source file to display", defaultSource)
  .option("--markdown <path>", "Commentray Markdown file", defaultMarkdown)
  .option("--out <path>", "Output HTML file", defaultOut)
  .option("--title <text>", "HTML title override")
  .option("--mermaid", "Include Mermaid runtime (CDN)", false)
  .action(async (opts) => {
    await buildCommentrayStatic({
      sourceFile: opts.source as string,
      markdownFile: opts.markdown as string,
      outHtml: opts.out as string,
      title: opts.title as string | undefined,
      includeMermaidRuntime: Boolean(opts.mermaid),
    });
    console.log(`Wrote ${path.resolve(opts.out as string)}`);
  });

void runCommanderMain(() => program.parseAsync(process.argv));
