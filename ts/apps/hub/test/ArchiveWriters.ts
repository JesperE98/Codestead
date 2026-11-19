import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateRawSync, gzipSync } from "node:zlib";

// What the C# tests get from TarFile.CreateFromDirectory and ZipFile.CreateFromDirectory / ZipArchive.CreateEntry:
// small writers for the test packages (ustar .tar.gz and .zip), so the tests need no tools of the system.

export interface ArchiveEntry {
  name: string;
  /** null for a directory. */
  data: Buffer | null;
  mode: number;
}

/** The files and folders under `dir`, relative, with "/" (includeBaseDirectory: false). */
export function entriesOf(dir: string, prefix = ""): ArchiveEntry[] {
  const out: ArchiveEntry[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push({ name: prefix + name + "/", data: null, mode: st.mode & 0o777 });
      out.push(...entriesOf(full, prefix + name + "/"));
    } else {
      out.push({ name: prefix + name, data: readFileSync(full), mode: st.mode & 0o777 });
    }
  }
  return out;
}

function octal(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, "0") + "\0";
}

/** A POSIX ustar archive, gzipped. */
export function writeTarGz(file: string, entries: readonly ArchiveEntry[]): void {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const header = Buffer.alloc(512);
    header.write(e.name, 0, 100, "utf8");
    header.write(octal(e.mode, 8), 100, "latin1");
    header.write(octal(0, 8), 108, "latin1");
    header.write(octal(0, 8), 116, "latin1");
    header.write(octal(e.data?.length ?? 0, 12), 124, "latin1");
    header.write(octal(Math.floor(Date.now() / 1000), 12), 136, "latin1");
    header.write("        ", 148, "latin1");
    header.write(e.data === null ? "5" : "0", 156, "latin1");
    header.write("ustar\0", 257, "latin1");
    header.write("00", 263, "latin1");
    let sum = 0;
    for (const b of header) sum += b;
    header.write(octal(sum, 7) + " ", 148, "latin1");
    blocks.push(header);
    if (e.data !== null && e.data.length > 0) {
      blocks.push(e.data);
      const pad = (512 - (e.data.length % 512)) % 512;
      if (pad > 0) blocks.push(Buffer.alloc(pad));
    }
  }
  blocks.push(Buffer.alloc(1024));
  writeFileSync(file, gzipSync(Buffer.concat(blocks)));
}

/** A .zip (deflated, or stored when `store`), made on Unix (so the permissions are in it). */
export function writeZip(file: string, entries: readonly ArchiveEntry[], store = false): void {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = e.data ?? Buffer.alloc(0);
    const method = store || data.length === 0 ? 0 : 8;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4); // made by Unix
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE((((e.data === null ? 0o040000 : 0o100000) | e.mode) << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + compressed.length;
  }
  const cdBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(file, Buffer.concat([...locals, cdBuffer, end]));
}
