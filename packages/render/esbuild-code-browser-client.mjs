import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = dirname(fileURLToPath(import.meta.url));
const outDir = join(pkgRoot, "dist");
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, "code-browser-client.bundle.js");

await esbuild.build({
  entryPoints: [join(pkgRoot, "src", "code-browser-client.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  outfile,
});

for (const name of ["side-by-side-layout.css"]) {
  copyFileSync(join(pkgRoot, "src", name), join(outDir, name));
}

console.error("wrote", outfile);
