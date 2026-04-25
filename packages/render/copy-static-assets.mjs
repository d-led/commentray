import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = [
  {
    from: join(here, "src", "code-browser-intro.css"),
    to: join(here, "dist", "code-browser-intro.css"),
  },
];

for (const { from, to } of assets) {
  cpSync(from, to);
}
