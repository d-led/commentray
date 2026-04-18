import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function composeCommentrayMarkdown(intro: string, fileMarkdown: string): string {
  const parts: string[] = [];
  if (intro.trim()) parts.push(intro.trim());
  if (fileMarkdown.trim()) parts.push(fileMarkdown.trim());
  if (parts.length === 0) return "_No commentray content configured._\n";
  return `${parts.join("\n\n")}\n`;
}
