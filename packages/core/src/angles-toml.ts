import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml, stringify } from "@iarna/toml";

import { assertValidAngleId } from "./angles.js";
import type { CommentrayToml } from "./config.js";
import { mergeCommentrayConfig } from "./config.js";
import { commentrayAnglesSentinelPath } from "./paths.js";

export type UpsertAngleDefinitionInput = {
  id: string;
  title?: string;
  /** When true, set `angles.default_angle` to this id after the merge. */
  makeDefault?: boolean;
};

const MINIMAL_NEW_TOML = `[storage]
dir = ".commentray"
`;

/**
 * Ensures `{storage.dir}/source/.default` exists so the repository uses **Angles** on-disk layout
 * (see `docs/spec/storage.md`).
 */
export async function ensureAnglesSentinelFile(
  repoRoot: string,
  storageDir: string,
): Promise<void> {
  const rel = commentrayAnglesSentinelPath(storageDir);
  const absolute = path.join(repoRoot, ...rel.split("/"));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  try {
    await fs.access(absolute);
  } catch {
    await fs.writeFile(
      absolute,
      "# Commentray Angles layout sentinel (see docs/spec/storage.md).\n",
      "utf8",
    );
  }
}

/**
 * Reads `.commentray.toml`, appends a new `[[angles.definitions]]` row (or throws if the id
 * already exists), validates via {@link mergeCommentrayConfig}, and writes the file back using
 * TOML stringify (comments and key order are not preserved).
 */
export async function upsertAngleDefinitionInCommentrayToml(
  repoRoot: string,
  input: UpsertAngleDefinitionInput,
): Promise<void> {
  const id = assertValidAngleId(input.id);
  const configPath = path.join(repoRoot, ".commentray.toml");
  let raw = "";
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }

  const parsed: CommentrayToml = raw.trim() ? parseToml(raw) : {};
  const angles = parsed.angles ?? {};
  const definitions = [...(angles.definitions ?? [])];
  if (
    definitions.some(
      (d) => d && typeof d === "object" && "id" in d && String((d as { id: string }).id) === id,
    )
  ) {
    throw new Error(`Angle "${id}" is already listed in [angles].definitions`);
  }
  definitions.push({
    id,
    title: input.title?.trim() || undefined,
  });
  angles.definitions = definitions;
  if (input.makeDefault === true || definitions.length === 1) {
    angles.default_angle = id;
  }
  parsed.angles = angles;
  mergeCommentrayConfig(parsed);

  const serialized = stringify(parsed as never);
  const body = raw.trim() ? serialized : `${MINIMAL_NEW_TOML.trim()}\n\n${serialized}`;
  await fs.writeFile(configPath, `${body}\n`, "utf8");
}
