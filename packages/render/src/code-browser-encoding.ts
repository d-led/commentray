/**
 * Decode base64 payload embedded in HTML attributes (UTF-8 bytes, as produced by Node
 * `Buffer.from(str, "utf8").toString("base64")`).
 *
 * Avoids `decodeURIComponent(escape(atob(...)))`, which is fragile for some Unicode
 * in modern browsers and can fail silently in edge cases.
 */
export function decodeBase64Utf8(b64: string): string {
  const t = b64.trim();
  if (t === "") return "";
  try {
    const bin = atob(t);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      u8[i] = bin.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(u8);
  } catch {
    return "";
  }
}
