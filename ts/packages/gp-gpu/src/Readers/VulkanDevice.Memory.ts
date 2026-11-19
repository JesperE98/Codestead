// Memory: memcpy into mapped memory, the formats the program fills itself, copies between buffers and images, reads.
// (VulkanDevice.Memory.cs: a part of the partial class VulkanDevice, as functions of the device.)
import { toInt, toLong } from "../internal/dotnet.js";
import * as A from "../Shading/ShaderAst.js";
import { CppExec } from "./CppExec.js";
import { VulkanDevice } from "./VulkanDevice.js";

export function write(d: VulkanDevice, dst: A.Expr, from: A.Expr, size: A.Expr | null): void {
  const target = d.eval(dst);
  const address = target !== null && target.v !== null && target.v.length > 0 ? target.v[0]! : 0;
  if (address < VulkanDevice.AddressUnit) return;
  const m = toInt(address / VulkanDevice.AddressUnit) - 1;
  if (m < 0 || m >= d.memories.length) return;
  const offset = toLong(address - (m + 1) * VulkanDevice.AddressUnit);
  const value = d.eval(VulkanDevice.strip(from));
  if (value === null) return;
  if (value.text !== null && d.loaded.has(value.text)) {
    d.memories[m]!.images.set(offset, value.text);
    return;
  }
  let numbers: number[] = [];
  CppExec.flatten(value, numbers);
  // 16-bit indices (std::vector<uint16_t> indices) take 2 bytes each.
  // 16-bit indices take 2 bytes each, bytes (std::vector<unsigned char>: a glyph atlas) 1.
  let bytes = 4;
  const n = sourceName(VulkanDevice.strip(from));
  const type = n !== null ? d.src.declaredType(n) : null;
  if (type !== null) {
    if (/uint16|int16|short/i.test(type)) bytes = 2;
    else if (/char\b|uint8|int8|\bBYTE\b|stbi_uc|GLubyte/i.test(type)) bytes = 1;
  }
  // long arithmetic: (long)Num(size) * bytes / 4 divides as integers; no size: long.MaxValue.
  const limit = size === null ? Number.POSITIVE_INFINITY : bytes === 1 ? toLong(d.num(size)) : Math.trunc((toLong(d.num(size)) * bytes) / 4);
  if (limit < numbers.length * bytes) numbers = numbers.slice(0, Math.max(0, Math.trunc((limit + bytes - 1) / bytes)));
  d.memories[m]!.write(offset, bytes, numbers);
}

/** The variable a memcpy source names: pixels, atlas.data(), &amp;atlas[0]. */
function sourceName(e: A.Expr): string | null {
  if (e instanceof A.Name) return e.id;
  if (e instanceof A.Call && e.function_ === ".data" && e.args.length === 1) return sourceName(e.args[0]!);
  if (e instanceof A.IndexOf) return sourceName(e.target);
  if (e instanceof A.Member) return e.field;
  return null;
}

/** Bytes per texel of an 8-bit format the program fills itself (R8 … R8G8B8A8), or 0. */
export function bytesPerTexel(format: string): number {
  if (format.includes("R8G8B8A8") || format.includes("B8G8R8A8")) return 4;
  if (format.includes("R8G8B8_")) return 3;
  if (format.includes("R8G8_")) return 2;
  if (format.includes("R8_")) return 1;
  return 0;
}

/** Floats per texel of a 32-bit float format (R32G32B32A32_SFLOAT …), or 0. */
export function floatsPerTexel(format: string): number {
  if (format.includes("R32G32B32A32_SFLOAT")) return 4;
  if (format.includes("R32G32B32_SFLOAT")) return 3;
  if (format.includes("R32G32_SFLOAT")) return 2;
  if (format.includes("R32_SFLOAT")) return 1;
  return 0;
}

export function copy(d: VulkanDevice, from: string | null, fromOffset: number, to: string | null, toOffset: number, bytes: number): void {
  if (from === null || to === null) return;
  const s = d.buffers.get(from), t = d.buffers.get(to);
  if (s === undefined || t === undefined || s.memory < 0 || t.memory < 0) return;
  const src = d.memories[s.memory]!;
  const dst = d.memories[t.memory]!;
  const a = s.offset + fromOffset, b = t.offset + toOffset;
  // Runs stay runs (a texture's floats through a staging buffer).
  for (const r of src.runs.filter((r) => r.start >= a && r.start + r.values.length * r.step <= a + bytes)) dst.write(r.start - a + b, r.step, r.values);
  for (const [k, v] of [...src.bytes].filter(([k]) => k >= a && k < a + bytes)) dst.set(k - a + b, v);
  for (const [k, v] of [...src.images].filter(([k]) => k >= a && k < a + bytes)) dst.images.set(k - a + b, v);
}

/** Numbers of a buffer at a byte offset (from where it is bound in its memory). */
export function read(d: VulkanDevice, buffer: string, byteOffset: number, comps: number): number[] | null {
  const place = d.buffers.get(buffer);
  if (place === undefined || place.memory < 0) return null;
  const mem = d.memories[place.memory]!;
  const at = place.offset + byteOffset;
  if (mem.tryGet(at) === undefined) return null;
  const r = new Array<number>(comps);
  for (let k = 0; k < comps; k++) r[k] = mem.tryGet(at + k * 4) ?? 0;
  return r;
}

export function readIndex(d: VulkanDevice, buffer: string, byteOffset: number): number | null {
  const place = d.buffers.get(buffer);
  return place !== undefined && place.memory >= 0 ? (d.memories[place.memory]!.tryGet(place.offset + byteOffset) ?? null) : null;
}
