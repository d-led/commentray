export type LineRange = { start: number; end: number };

export type ParsedAnchor =
  | { kind: "lines"; range: LineRange }
  | { kind: "symbol"; name: string }
  | { kind: "opaque"; raw: string };

/**
 * Minimal anchor grammar (versioned; see docs/spec/anchors.md).
 * - lines:12-34
 * - symbol:SomeName
 */
export function parseAnchor(anchor: string): ParsedAnchor {
  const trimmed = anchor.trim();
  const linesMatch = /^lines:(\d+)-(\d+)$/.exec(trimmed);
  if (linesMatch) {
    const start = Number(linesMatch[1]);
    const end = Number(linesMatch[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
      throw new Error(`Invalid lines anchor: ${anchor}`);
    }
    return { kind: "lines", range: { start, end } };
  }
  const symbolMatch = /^symbol:(.+)$/.exec(trimmed);
  if (symbolMatch) {
    const name = symbolMatch[1].trim();
    if (!name) throw new Error(`Invalid symbol anchor: ${anchor}`);
    return { kind: "symbol", name };
  }
  return { kind: "opaque", raw: trimmed };
}

export function formatLineRange(range: LineRange): string {
  return `lines:${range.start}-${range.end}`;
}
