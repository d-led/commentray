import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = [
  {
    from: join(here, "src", "code-browser-intro.css"),
    to: join(here, "dist", "code-browser-intro.css"),
  },
  {
    from: join(here, "src", "code-browser-shell.css"),
    to: join(here, "dist", "code-browser-shell.css"),
  },
  {
    from: join(here, "src", "code-browser-nav-rail-doc-hub.html"),
    to: join(here, "dist", "code-browser-nav-rail-doc-hub.html"),
  },
  {
    from: join(here, "src", "mermaid-runtime-bootstrap.mjs"),
    to: join(here, "dist", "mermaid-runtime-bootstrap.mjs"),
  },
];

for (const { from, to } of assets) {
  cpSync(from, to);
}
