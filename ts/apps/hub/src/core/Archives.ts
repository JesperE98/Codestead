import { createReadStream, createWriteStream } from "node:fs";
import { link, mkdir, open, symlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createInflateRaw } from "node:zlib";
import { InvalidDataError, IOError, messageOf } from "./Errors.js";

// Unpacking the tools' portable packages without any dependency – what ToolStore gets from .NET's
// TarFile.ExtractToDirectoryAsync (a .tar.gz on Linux) and ZipFile.ExtractToDirectory (a .zip on Windows), with their
// rules: nothing is written outside the destination folder (an entry that tries throws IOException), existing files are
// not overwritten (overwriteFiles: false), and Unix permissions in the archive are kept.

/** The folder with a separator at the end, for "is this path inside it?" (as .NET checks). */
function withSeparator(dir: string): string {
  return dir.endsWith(sep) ? dir : dir + sep;
}

function isInside(full: string, destination: string, allowSelf: boolean): boolean {
  return full.startsWith(withSeparator(destination)) || (allowSelf && withSeparator(full) === withSeparator(destination));
}

/**
 * Writes a new file that must not exist yet (File.Open(…, FileMode.CreateNew): IOException when it does) from `source`
 * through `transforms`. Damaged compressed data is InvalidDataException, as in .NET.
 */
async function writeNew(path: string, mode: number, source: AsyncIterable<Buffer> | NodeJS.ReadableStream, ...transforms: NodeJS.ReadWriteStream[]): Promise<void> {
  try {
    await pipeline([source, ...transforms, createWriteStream(path, { flags: "wx", mode })]);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (typeof code === "string" && code.startsWith("Z_")) throw new InvalidDataError(`The archive is damaged: ${messageOf(e)}`, { cause: e });
    if (typeof code === "string") throw new IOError(messageOf(e), { cause: e });
    throw e;
  }
}

// ---------- .tar.gz ----------

/** Reads exactly as many bytes as asked from a stream of chunks. */
class ByteReader {
  private chunks: Buffer[] = [];
  private length = 0;
  private done = false;

  constructor(private readonly source: AsyncIterator<Buffer>) {}

  private async fill(n: number): Promise<void> {
    while (this.length < n && !this.done) {
      const r = await this.source.next();
      if (r.done) this.done = true;
      else if (r.value.length > 0) {
        this.chunks.push(r.value);
        this.length += r.value.length;
      }
    }
  }

  /** True when nothing more comes. */
  async atEnd(): Promise<boolean> {
    await this.fill(1);
    return this.length === 0;
  }

  /** Exactly n bytes; the archive ending before is an error. */
  async read(n: number): Promise<Buffer> {
    await this.fill(n);
    if (this.length < n) throw new InvalidDataError("The archive ends unexpectedly.");
    return this.take(n);
  }

  /** Between 1 and max bytes (what has arrived). */
  async readSome(max: number): Promise<Buffer> {
    await this.fill(1);
    if (this.length === 0) throw new InvalidDataError("The archive ends unexpectedly.");
    return this.take(Math.min(max, this.chunks[0]!.length));
  }

  async skip(n: number): Promise<void> {
    while (n > 0) n -= (await this.readSome(Math.min(n, 1 << 20))).length;
  }

  private take(n: number): Buffer {
    let out: Buffer;
    const first = this.chunks[0]!;
    if (first.length >= n) {
      out = first.subarray(0, n);
      if (first.length === n) this.chunks.shift();
      else this.chunks[0] = first.subarray(n);
    } else {
      out = Buffer.concat(this.chunks, this.length).subarray(0, n);
      const rest = Buffer.concat(this.chunks, this.length).subarray(n);
      this.chunks = rest.length > 0 ? [rest] : [];
    }
    this.length -= n;
    return out;
  }
}

/** A NUL-terminated text field. */
function field(b: Buffer, offset: number, length: number): string {
  const slice = b.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end < 0 ? slice.length : end).toString("utf8");
}

/** An octal number field, or a base-256 one (the high bit of the first byte set; GNU tar for big values). */
function numeric(b: Buffer, offset: number, length: number): number {
  if ((b[offset]! & 0x80) !== 0) {
    let value = b[offset]! & 0x7f;
    for (let i = offset + 1; i < offset + length; i++) value = value * 256 + b[i]!;
    return value;
  }
  const text = b.toString("latin1", offset, offset + length).replace(/[\0 ]+$/g, "").replace(/^[\0 ]+/, "");
  if (text === "") return 0;
  if (!/^[0-7]+$/.test(text)) throw new InvalidDataError("The archive has an invalid header.");
  return parseInt(text, 8);
}

/** The pax extended header records: "<length> <key>=<value>\n". */
function paxRecords(data: Buffer): Map<string, string> {
  const records = new Map<string, string>();
  let pos = 0;
  while (pos < data.length) {
    const space = data.indexOf(0x20, pos);
    if (space < 0) break;
    const length = parseInt(data.toString("latin1", pos, space), 10);
    if (!(length > 0)) break;
    const record = data.toString("utf8", space + 1, pos + length - 1);
    const eq = record.indexOf("=");
    if (eq > 0) records.set(record.slice(0, eq), record.slice(eq + 1));
    pos += length;
  }
  return records;
}

const block = 512;
const padding = (size: number) => (block - (size % block)) % block;

/** TarFile.ExtractToDirectoryAsync(new GZipStream(file), destination, overwriteFiles: false). */
export async function extractTarGz(file: string, destination: string): Promise<void> {
  const dest = resolve(destination);
  const gunzip = createReadStream(file).pipe(createGunzip());
  const reader = new ByteReader(gunzip[Symbol.asyncIterator]() as AsyncIterator<Buffer>);
  let longName: string | null = null;
  let longLink: string | null = null;
  let pax = new Map<string, string>();
  try {
    while (!(await reader.atEnd())) {
      const header = await reader.read(block);
      if (header.every((b) => b === 0)) break; // the end-of-archive blocks
      checkHeaderChecksum(header);
      const type = String.fromCharCode(header[156]!);
      let size = numeric(header, 124, 12);
      let name = field(header, 0, 100);
      let linkName = field(header, 157, 100);
      // POSIX ustar (and pax): a prefix for long paths. GNU tar ("ustar  ") uses that space for other things.
      if (header.toString("latin1", 257, 263) === "ustar\0") {
        const prefix = field(header, 345, 155);
        if (prefix !== "") name = prefix + "/" + name;
      }

      if (type === "L" || type === "K" || type === "x" || type === "g") {
        const data = await reader.read(size);
        await reader.skip(padding(size));
        if (type === "L") longName = field(data, 0, data.length);
        else if (type === "K") longLink = field(data, 0, data.length);
        else if (type === "x") pax = paxRecords(data);
        continue;
      }
      if (pax.has("path")) name = pax.get("path")!;
      if (pax.has("linkpath")) linkName = pax.get("linkpath")!;
      if (pax.has("size")) size = Number(pax.get("size"));
      if (longName !== null) name = longName;
      if (longLink !== null) linkName = longLink;
      longName = longLink = null;
      pax = new Map();

      const mode = numeric(header, 100, 8) & 0o777;
      await extractTarEntry(reader, dest, type, name, linkName, size, mode);
      await reader.skip(padding(size));
    }
  } finally {
    gunzip.destroy();
  }
}

function checkHeaderChecksum(header: Buffer): void {
  const stored = numeric(header, 148, 8);
  let sum = 0;
  for (let i = 0; i < block; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i]!;
  if (sum !== stored) throw new InvalidDataError("The archive has a damaged header (wrong checksum).");
}

/** TarEntry.ExtractRelativeToDirectory: one entry, never outside `dest`. */
async function extractTarEntry(reader: ByteReader, dest: string, type: string, name: string, linkName: string, size: number, mode: number): Promise<void> {
  // Path.Join (not Combine): an absolute name ends up inside the destination; ".." can still leave it.
  const full = resolve(join(dest, name));
  const isDirectory = type === "5";
  if (!isInside(full, dest, isDirectory))
    throw new IOError(`Extracting the Tar entry '${name}' would have resulted in a file outside the specified destination directory: '${dest}'`);

  switch (type) {
    case "5":
      await mkdir(full, { recursive: true });
      return;
    case "0":
    case "\0":
    case "7": {
      await mkdir(dirname(full), { recursive: true });
      let left = size;
      await writeNew(
        full,
        mode || 0o644,
        (async function* () {
          while (left > 0) {
            const chunk = await reader.readSome(Math.min(left, 1 << 20));
            left -= chunk.length;
            yield chunk;
          }
        })(),
      );
      return;
    }
    case "2": {
      // The link's target must be inside the destination too.
      const target = isAbsolute(linkName) ? resolve(linkName) : resolve(join(dirname(full), linkName));
      if (!isInside(target, dest, true))
        throw new IOError(`Extracting the Tar entry '${name}' would have resulted in a link target outside the specified destination directory: '${dest}'`);
      await mkdir(dirname(full), { recursive: true });
      await wrapIO(() => symlink(linkName, full));
      await reader.skip(size);
      return;
    }
    case "1": {
      const target = resolve(join(dest, linkName));
      if (!isInside(target, dest, false))
        throw new IOError(`Extracting the Tar entry '${name}' would have resulted in a link target outside the specified destination directory: '${dest}'`);
      await mkdir(dirname(full), { recursive: true });
      await wrapIO(() => link(target, full));
      await reader.skip(size);
      return;
    }
    default:
      // Devices, FIFOs and other special entries: nothing a portable package needs.
      await reader.skip(size);
  }
}

async function wrapIO(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (e) {
    throw new IOError(messageOf(e), { cause: e });
  }
}

// ---------- .zip ----------

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
  /** Unix permissions when the archive was made on Unix, else 0. */
  unixMode: number;
}

const u16 = (b: Buffer, o: number) => b.readUInt16LE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32LE(o);
const u64 = (b: Buffer, o: number) => Number(b.readBigUInt64LE(o));

/** ZipFile.ExtractToDirectory(file, destination) (overwriteFiles: false). */
export async function extractZip(file: string, destination: string): Promise<void> {
  const dest = resolve(destination);
  const handle = await open(file, "r");
  let entries: ZipEntry[];
  try {
    entries = await readCentralDirectory(handle);
  } finally {
    await handle.close();
  }
  for (const e of entries) {
    // Path.Combine: an absolute name is taken as it is, and then refused as outside the destination.
    const full = resolve(dest, e.name);
    if (!isInside(full, dest, false)) throw new IOError("Extracting Zip entry would have resulted in a file outside the specified destination directory.");
    if (e.name.endsWith("/") || (sep === "\\" && e.name.endsWith("\\"))) {
      await mkdir(full, { recursive: true });
      continue;
    }
    await mkdir(dirname(full), { recursive: true });
    const start = await dataOffset(file, e);
    if (e.method !== 0 && e.method !== 8) throw new InvalidDataError(`The archive entry ${e.name} uses an unsupported compression method (${e.method}).`);
    const input = e.compressedSize === 0 ? emptyStream() : createReadStream(file, { start, end: start + e.compressedSize - 1 });
    if (e.method === 0) await writeNew(full, e.unixMode || 0o666, input);
    else await writeNew(full, e.unixMode || 0o666, input, createInflateRaw());
  }
}

async function* emptyStream(): AsyncGenerator<Buffer> {}

async function readCentralDirectory(handle: Awaited<ReturnType<typeof open>>): Promise<ZipEntry[]> {
  const size = (await handle.stat()).size;
  const tailLength = Math.min(size, 22 + 0xffff);
  const tail = Buffer.alloc(tailLength);
  await handle.read(tail, 0, tailLength, size - tailLength);
  let eocd = -1;
  for (let i = tailLength - 22; i >= 0; i--)
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new InvalidDataError("End of Central Directory record could not be found.");
  let count = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    // ZIP64: the locator just before the record points at the 64-bit end record.
    const locator = eocd - 20;
    if (locator < 0 || u32(tail, locator) !== 0x07064b50) throw new InvalidDataError("The archive's ZIP64 locator is missing.");
    const end64Offset = u64(tail, locator + 8);
    const end64 = Buffer.alloc(56);
    await handle.read(end64, 0, 56, end64Offset);
    if (u32(end64, 0) !== 0x06064b50) throw new InvalidDataError("The archive's ZIP64 end record is damaged.");
    count = u64(end64, 32);
    cdSize = u64(end64, 40);
    cdOffset = u64(end64, 48);
  }
  const cd = Buffer.alloc(cdSize);
  await handle.read(cd, 0, cdSize, cdOffset);
  const entries: ZipEntry[] = [];
  let pos = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > cd.length || u32(cd, pos) !== 0x02014b50) throw new InvalidDataError("The archive's central directory is damaged.");
    const madeBy = u16(cd, pos + 4);
    const method = u16(cd, pos + 10);
    let compressedSize = u32(cd, pos + 20);
    let uncompressedSize = u32(cd, pos + 24);
    const nameLength = u16(cd, pos + 28);
    const extraLength = u16(cd, pos + 30);
    const commentLength = u16(cd, pos + 32);
    const external = u32(cd, pos + 38);
    let localHeaderOffset = u32(cd, pos + 42);
    // Names are UTF-8 (.NET's default for entry names).
    const name = cd.toString("utf8", pos + 46, pos + 46 + nameLength);
    // ZIP64 extra field: the 64-bit values of the fields that are 0xFFFFFFFF, in this order.
    let extra = pos + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = u16(cd, extra);
      const length = u16(cd, extra + 2);
      if (id === 0x0001) {
        let p = extra + 4;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = u64(cd, p);
          p += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(cd, p);
          p += 8;
        }
        if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(cd, p);
      }
      extra += 4 + length;
    }
    const unixMode = madeBy >> 8 === 3 ? (external >>> 16) & 0o777 : 0;
    entries.push({ name, method, compressedSize, localHeaderOffset, unixMode });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Where an entry's data starts: after its local header (whose name and extra field can differ in length). */
async function dataOffset(file: string, e: ZipEntry): Promise<number> {
  const handle = await open(file, "r");
  try {
    const local = Buffer.alloc(30);
    await handle.read(local, 0, 30, e.localHeaderOffset);
    if (u32(local, 0) !== 0x04034b50) throw new InvalidDataError("A local file header is damaged.");
    return e.localHeaderOffset + 30 + u16(local, 26) + u16(local, 28);
  } finally {
    await handle.close();
  }
}
