import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads `version` from this package’s `package.json` (works for both `src/` and `dist/` layouts).
 */
export function commentrayRenderVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageDir = join(here, "..");
  const raw = readFileSync(join(packageDir, "package.json"), "utf8");
  const j = JSON.parse(raw) as { version?: string };
  return j.version ?? "0.0.0";
}
