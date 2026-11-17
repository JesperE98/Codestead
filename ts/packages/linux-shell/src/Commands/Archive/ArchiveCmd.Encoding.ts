// Port of Commands/Archive/ArchiveCmd.Encoding.cs – how archives are stored as strings: base64 with a scrambled
// alphabet behind a marker.

import { Js } from "../../Js.js";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** 64 characters from Latin-1 (¡ ... á, except the soft hyphen) – looks like binary data. */
function buildScrambled(): string {
  let s = "";
  for (let c = 0xa1; s.length < 64; c++) if (c !== 0xad) s += String.fromCharCode(c);
  return s;
}

// Built on first use (these functions may run while the group's modules are still being loaded).
let maps: { to: Map<string, string>; from: Map<string, number> } | null = null;

function scrambleMaps(): { to: Map<string, string>; from: Map<string, number> } {
  if (maps === null) {
    const scrambled = buildScrambled();
    const to = new Map<string, string>();
    const from = new Map<string, number>();
    for (let i = 0; i < 64; i++) {
      to.set(B64[i]!, scrambled[i]!);
      from.set(scrambled[i]!, i);
    }
    maps = { to, from };
  }
  return maps;
}

const utf8Encoder = new TextEncoder();

export function encode(text: string): string {
  const to = scrambleMaps().to;
  const bytes = utf8Encoder.encode(text);
  let o = "";
  // base64 without the padding, each character replaced by its scrambled twin.
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    o += to.get(B64[(n >> 18) & 63]!)!;
    o += to.get(B64[(n >> 12) & 63]!)!;
    if (i + 1 < bytes.length) o += to.get(B64[(n >> 6) & 63]!)!;
    if (i + 2 < bytes.length) o += to.get(B64[n & 63]!)!;
  }
  return o;
}

export function decode(data: string): string | null {
  const from = scrambleMaps().from;
  const values: number[] = [];
  for (const ch of data) {
    const v = from.get(ch);
    if (v === undefined) return null;
    values.push(v);
  }
  // One character left over is not valid base64 (C# Convert.FromBase64String throws a FormatException).
  if (values.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const v0 = values[i]!;
    const v1 = values[i + 1]!;
    const v2 = i + 2 < values.length ? values[i + 2]! : 0;
    const v3 = i + 3 < values.length ? values[i + 3]! : 0;
    const n = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
    bytes.push((n >> 16) & 255);
    if (i + 2 < values.length) bytes.push((n >> 8) & 255);
    if (i + 3 < values.length) bytes.push(n & 255);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
  // TextDecoder drops a leading byte order mark.
  return text.startsWith("\ufeff") ? text.slice(1) : text;
}

export function wrap(magic: string, size: number, json: string): string {
  return `${magic}\u0000${Js.num(size)}\u0000${encode(json)}`;
}

/** The JSON inside an archive, or null. */
export function unwrap(magic: string, content: string): unknown {
  if (!content.startsWith(magic + "\u0000")) return null;
  const rest = content.slice(magic.length + 1);
  const nul = rest.indexOf("\u0000");
  if (nul < 0) return null;
  const json = decode(rest.slice(nul + 1));
  if (json === null) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}
