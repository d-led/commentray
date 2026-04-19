import process from "node:process";

const ansi = {
  reset: "\x1b[0m",
  boldYellow: "\x1b[1m\x1b[33m",
  boldRed: "\x1b[1m\x1b[31m",
} as const;

/**
 * Whether stderr may use ANSI styling. Honors NO_COLOR, FORCE_COLOR, NODE_DISABLE_COLORS,
 * and TTY detection so interactive runs and typical CI logs stay readable.
 */
export function stderrColorsEnabled(): boolean {
  if ("NO_COLOR" in process.env) return false;
  if (process.env.NODE_DISABLE_COLORS === "1") return false;
  const fc = process.env.FORCE_COLOR;
  if (fc !== undefined && fc !== "") {
    return fc !== "0" && fc !== "false";
  }
  return process.stderr.isTTY === true;
}

export function formatCliWarning(message: string): string {
  if (!stderrColorsEnabled()) return message;
  return `${ansi.boldYellow}${message}${ansi.reset}`;
}

export function formatCliError(message: string): string {
  if (!stderrColorsEnabled()) return message;
  return `${ansi.boldRed}${message}${ansi.reset}`;
}

export function logCliWarning(message: string): void {
  console.warn(formatCliWarning(message));
}

export function logCliError(message: string): void {
  console.error(formatCliError(message));
}

export function logCliValidationIssue(issue: { level: "warn" | "error"; message: string }): void {
  const line = `[${issue.level}] ${issue.message}`;
  if (issue.level === "error") logCliError(line);
  else logCliWarning(line);
}
