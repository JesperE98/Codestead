// Port of Commands/Archive/ArchiveCmd.Sizes.cs – pretend sizes of archives and their entries (an estimate of how
// well deflate compresses).

import { Js } from "../../Js.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as AwkCmd from "../Awk/AwkCmd.js";
import { entryLabel, GzMagic, readTar, ZipMagic } from "./ArchiveCmd.js";
import type { ArchiveEntry } from "./ArchiveEntry.js";
import type { GzPayload } from "./GzPayload.js";

/** The size of the content as programs see it (archives have a pretend size). */
export function logicalSize(content: string): number {
  return VfsLib.nodeSize({ type: "file", mode: 0, owner: "", group: "", mtime: 0, content });
}

const utf8Encoder = new TextEncoder();

/**
 * Estimates how many bytes deflate (gzip/zip) compresses the text to: a simple LZ77 that
 * looks for repetitions, where a repetition costs a few bytes and other characters a
 * little under a byte each. Small files therefore do not get smaller.
 */
export function deflateSize(text: string): number {
  const b = utf8Encoder.encode(text);
  const n = b.length;
  if (n === 0) return 2;
  const last = new Map<number, number>();
  const key = (i: number): number => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
  let literals = 0;
  let matches = 0;
  let i = 0;
  while (i < n) {
    if (i + 2 < n) {
      const k = key(i);
      const j = last.get(k);
      last.set(k, i);
      if (j !== undefined && i - j <= 32768) {
        let len = 3;
        while (i + len < n && len < 258 && b[j + len] === b[i + len]) len++;
        for (let p = i + 1; p < i + len && p + 2 < n; p++) last.set(key(p), p);
        matches++;
        i += len;
        continue;
      }
    }
    literals++;
    i++;
  }
  const fixedBits = literals * 8.5 + matches * 18;
  const dynamicBits = literals * 5 + matches * 22 + 500;
  return Math.ceil(Math.min(fixedBits, dynamicBits) / 8) + 2;
}

export function entrySize(e: ArchiveEntry): number {
  return e.type === "dir" ? 0 : (e.size ?? logicalSize(e.content ?? ""));
}

/** Roughly how many bytes deflate makes of the content. */
function packedSize(content: string, size: number | null = null): number {
  if (size !== null) return AwkCmd.jsRound(size * 0.45);
  const entries = readTar(content);
  // A tar archive is mostly zeros and headers, which compress to almost nothing.
  if (entries !== null) {
    let sum = 2;
    for (const e of entries) sum += 24 + Js.utf8Length(e.path) + compressedEntrySize(e);
    return sum;
  }
  // Already compressed (.gz, .zip) does not get smaller – rather a little larger.
  if (content.startsWith(GzMagic) || content.startsWith(ZipMagic)) return logicalSize(content) + 5;
  return deflateSize(content);
}

/** Compressed size of a file in an archive. Never larger than the original (then it is stored uncompressed). */
export function compressedEntrySize(e: ArchiveEntry): number {
  if (e.type === "dir") return 0;
  return Math.min(packedSize(e.content ?? "", e.size ?? null), entrySize(e));
}

export function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

/** A real tar archive: a 512 byte header per file, content in blocks of 512, in total a multiple of 10240. */
export function tarSize(entries: ArchiveEntry[]): number {
  let n = 1024;
  for (const e of entries) n += 512 + ceilDiv(entrySize(e), 512) * 512;
  return ceilDiv(n, 10240) * 10240;
}

export function gzSize(p: GzPayload): number {
  return 18 + (p.n !== null && p.n !== undefined && p.n !== "" ? Js.utf8Length(p.n) + 1 : 0) + packedSize(p.d, p.s ?? null);
}

export function zipSize(entries: ArchiveEntry[]): number {
  let s = 22;
  for (const e of entries) s += 76 + 2 * Js.utf8Length(entryLabel(e)) + compressedEntrySize(e);
  return s;
}
