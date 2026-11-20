// The build's patch of velopack's Linux module (packaging/ts/velopack-glibc.mjs): its GLIBC_2.39 version need made
// optional – exactly that one entry, one byte – so that it loads on glibc 2.34–2.38, and a loud failure when a new
// velopack is not as expected. A small ELF file made here stands in for the module; the real one is checked too (with
// readelf where there is one). packaging/install-test.sh loads the patched module on Ubuntu 22.04.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { elfHash, makeGlibcNeedOptional, readVersionNeeds } from "../../../../packaging/ts/velopack-glibc.mjs";

interface Sym {
  name: string;
  version: string;
  weak?: boolean;
}

/**
 * A minimal 64-bit x86-64 shared object with the tables the patch reads: .dynstr, .dynsym (undefined functions),
 * .gnu.version and .gnu.version_r (one Verneed for libc.so.6 with `versions`). Returns it and where each Vernaux is.
 */
function fixture(versions: string[], symbols: Sym[], options: { badHash?: string } = {}): { elf: Buffer; aux: Map<string, number> } {
  const strings: string[] = [""];
  const str = (s: string) => {
    const at = strings.join("\0").length + 1;
    strings.push(s);
    return at;
  };
  const libc = str("libc.so.6");
  const versionName = new Map(versions.map((v) => [v, str(v)]));
  const symbolName = symbols.map((s) => str(s.name));
  const dynstr = Buffer.from(strings.join("\0") + "\0", "latin1");

  const dynsym = Buffer.alloc(24 * (symbols.length + 1));
  const versym = Buffer.alloc(2 * (symbols.length + 1));
  symbols.forEach((s, i) => {
    const o = 24 * (i + 1);
    dynsym.writeUInt32LE(symbolName[i]!, o);
    dynsym[o + 4] = ((s.weak ? 2 : 1) << 4) | 2; // STB_WEAK/STB_GLOBAL, STT_FUNC
    dynsym.writeUInt16LE(0, o + 6); // SHN_UNDEF
    versym.writeUInt16LE(versions.indexOf(s.version) + 2, 2 * (i + 1));
  });

  const verneed = Buffer.alloc(16 + 16 * versions.length);
  verneed.writeUInt16LE(1, 0); // vn_version
  verneed.writeUInt16LE(versions.length, 2);
  verneed.writeUInt32LE(libc, 4);
  verneed.writeUInt32LE(16, 8); // vn_aux
  verneed.writeUInt32LE(0, 12); // vn_next
  versions.forEach((v, i) => {
    const o = 16 + 16 * i;
    verneed.writeUInt32LE(elfHash(options.badHash === v ? v + "x" : v), o);
    verneed.writeUInt16LE(0, o + 4); // vna_flags
    verneed.writeUInt16LE(i + 2, o + 6); // vna_other: the version index
    verneed.writeUInt32LE(versionName.get(v)!, o + 8);
    verneed.writeUInt32LE(i === versions.length - 1 ? 0 : 16, o + 12);
  });
  const shstrtab = Buffer.from("\0.dynstr\0.dynsym\0.gnu.version\0.gnu.version_r\0.dynamic\0.shstrtab\0", "latin1");
  const dynamic = Buffer.alloc(16 * 8); // filled in below, once the tables' addresses are known

  // [type, data, link, info, entsize, name offset in .shstrtab]
  const sections: [number, Buffer, number, number, number, number][] = [
    [3, dynstr, 0, 0, 0, 1],
    [11, dynsym, 1, 1, 24, 9],
    [0x6fffffff, versym, 2, 0, 2, 17],
    [0x6ffffffe, verneed, 1, 1, 0, 30],
    [6, dynamic, 1, 0, 16, 45],
    [3, shstrtab, 0, 0, 0, 54],
  ];
  // The ELF header, two program headers (PT_LOAD: the whole file at address 0; PT_DYNAMIC), the sections, their headers.
  const parts: Buffer[] = [Buffer.alloc(64 + 2 * 56)];
  let at = 64 + 2 * 56;
  const offsets: number[] = [];
  for (const [, data] of sections) {
    offsets.push(at);
    parts.push(data, Buffer.alloc((8 - (data.length % 8)) % 8));
    at += data.length + ((8 - (data.length % 8)) % 8);
  }
  // The dynamic section, as the loader (and readelf) find the tables: DT_STRTAB, DT_SYMTAB, DT_STRSZ, DT_SYMENT,
  // DT_VERSYM, DT_VERNEED, DT_VERNEEDNUM, DT_NULL.
  [
    [5, offsets[0]!],
    [6, offsets[1]!],
    [10, dynstr.length],
    [11, 24],
    [0x6ffffff0, offsets[2]!],
    [0x6ffffffe, offsets[3]!],
    [0x6fffffff, 1],
    [0, 0],
  ].forEach(([tag, value], i) => {
    dynamic.writeBigUInt64LE(BigInt(tag!), 16 * i);
    dynamic.writeBigUInt64LE(BigInt(value!), 16 * i + 8);
  });
  const shoff = at;
  const headers = Buffer.alloc(64 * (sections.length + 1));
  sections.forEach(([type, data, link, info, entsize, name], i) => {
    const o = 64 * (i + 1);
    headers.writeUInt32LE(name, o);
    headers.writeUInt32LE(type, o + 4);
    headers.writeBigUInt64LE(BigInt(offsets[i]!), o + 0x10); // sh_addr: loaded where it is in the file
    headers.writeBigUInt64LE(BigInt(offsets[i]!), o + 0x18);
    headers.writeBigUInt64LE(BigInt(data.length), o + 0x20);
    headers.writeUInt32LE(link, o + 0x28);
    headers.writeUInt32LE(info, o + 0x2c);
    headers.writeBigUInt64LE(BigInt(entsize), o + 0x38);
  });
  parts.push(headers);
  const elf = Buffer.concat(parts);
  elf.writeUInt32BE(0x7f454c46, 0);
  elf[4] = 2; // ELFCLASS64
  elf[5] = 1; // little-endian
  elf[6] = 1;
  elf.writeUInt16LE(3, 0x10); // ET_DYN
  elf.writeUInt16LE(62, 0x12); // EM_X86_64
  elf.writeUInt32LE(1, 0x14);
  elf.writeBigUInt64LE(64n, 0x20); // e_phoff
  elf.writeBigUInt64LE(BigInt(shoff), 0x28);
  elf.writeUInt16LE(64, 0x34); // e_ehsize
  elf.writeUInt16LE(56, 0x36); // e_phentsize
  elf.writeUInt16LE(2, 0x38); // e_phnum
  elf.writeUInt16LE(64, 0x3a); // e_shentsize
  elf.writeUInt16LE(sections.length + 1, 0x3c);
  elf.writeUInt16LE(sections.length, 0x3e); // e_shstrndx
  const segment = (o: number, type: number, offset: number, size: number) => {
    elf.writeUInt32LE(type, o);
    elf.writeUInt32LE(4, o + 4); // PF_R
    elf.writeBigUInt64LE(BigInt(offset), o + 0x08);
    elf.writeBigUInt64LE(BigInt(offset), o + 0x10);
    elf.writeBigUInt64LE(BigInt(offset), o + 0x18);
    elf.writeBigUInt64LE(BigInt(size), o + 0x20);
    elf.writeBigUInt64LE(BigInt(size), o + 0x28);
    elf.writeBigUInt64LE(8n, o + 0x30);
  };
  segment(64, 1, 0, elf.length); // PT_LOAD
  segment(64 + 56, 2, offsets[4]!, dynamic.length); // PT_DYNAMIC
  return { elf, aux: new Map(versions.map((v, i) => [v, offsets[3]! + 16 + 16 * i])) };
}

/** velopack 1.2.161's needs from glibc (readelf -V --dyn-syms), in short. */
const velopackLike = (): Sym[] => [
  { name: "memcpy", version: "GLIBC_2.14" },
  { name: "pthread_create", version: "GLIBC_2.34" },
  { name: "pidfd_spawnp", version: "GLIBC_2.39", weak: true },
  { name: "pidfd_getpid", version: "GLIBC_2.39", weak: true },
];
const versions = ["GLIBC_2.14", "GLIBC_2.34", "GLIBC_2.39"];

function differingBytes(a: Buffer, b: Buffer): number[] {
  const at: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) at.push(i);
  return at;
}

describe("VelopackGlibcTests", () => {
  it("läser versionsbehoven som readelf -V: bibliotek, version, hash och symbolerna som använder den", () => {
    const { elf } = fixture(versions, velopackLike());
    const needs = readVersionNeeds(elf);
    expect(needs.map((n) => `${n.file} ${n.name}`)).toEqual(["libc.so.6 GLIBC_2.14", "libc.so.6 GLIBC_2.34", "libc.so.6 GLIBC_2.39"]);
    expect(needs.every((n) => n.hash === elfHash(n.name))).toBe(true);
    expect(needs[2]!.symbols).toEqual([
      { name: "pidfd_spawnp", weak: true },
      { name: "pidfd_getpid", weak: true },
    ]);
    expect(elfHash("GLIBC_2.39")).toBe(0x069691b9);
    // readelf reads the fixture the same way.
    if (spawnSync("readelf", ["--version"]).status !== 0) return;
    const dir = mkdtempSync(join(tmpdir(), "velopack-glibc-"));
    try {
      writeFileSync(join(dir, "fixture.so"), elf);
      const syms = spawnSync("readelf", ["--dyn-syms", "-W", join(dir, "fixture.so")], { encoding: "utf8" }).stdout;
      expect(syms).toMatch(/FUNC\s+WEAK\s+DEFAULT\s+UND pidfd_spawnp@GLIBC_2\.39 \(4\)/);
      expect(syms).toMatch(/FUNC\s+GLOBAL\s+DEFAULT\s+UND pthread_create@GLIBC_2\.34 \(3\)/);
      const v = spawnSync("readelf", ["-V", "-W", join(dir, "fixture.so")], { encoding: "utf8" }).stdout;
      expect(v).toMatch(/000:\s+0 \(\*local\*\)\s+2 \(GLIBC_2\.14\)\s+3 \(GLIBC_2\.34\)\s+4 \(GLIBC_2\.39\)\s*\n\s*004:\s+4 \(GLIBC_2\.39\)/);
      expect(v).toMatch(/File: libc\.so\.6\s+Cnt: 3[\s\S]*Name: GLIBC_2\.39\s+Flags: none\s+Version: 4/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("gör exakt GLIBC_2.39-behovet valfritt: en byte (VER_FLG_WEAK), resten orört; en andra gång ändras inget", () => {
    const { elf, aux } = fixture(versions, velopackLike());
    const before = Buffer.from(elf);
    expect(makeGlibcNeedOptional(elf)).toEqual({ version: "GLIBC_2.39", symbols: ["pidfd_spawnp", "pidfd_getpid"], changed: true });
    expect(differingBytes(before, elf)).toEqual([aux.get("GLIBC_2.39")! + 4]);
    expect(elf.readUInt16LE(aux.get("GLIBC_2.39")! + 4)).toBe(2);
    const patched = Buffer.from(elf);
    expect(makeGlibcNeedOptional(elf).changed).toBe(false);
    expect(elf.equals(patched)).toBe(true);
  });

  it("stoppar bygget när modulen inte behöver GLIBC_2.39 (ny velopack: kontrollera och uppdatera)", () => {
    const { elf } = fixture(["GLIBC_2.14", "GLIBC_2.34"], velopackLike().slice(0, 2));
    const before = Buffer.from(elf);
    expect(() => makeGlibcNeedOptional(elf)).toThrow(/does not need GLIBC_2\.39/);
    expect(elf.equals(before)).toBe(true);
  });

  it("stoppar bygget när en symbol som inte är svag behöver GLIBC_2.39", () => {
    const symbols = velopackLike();
    symbols.push({ name: "pidfd_send_signal", version: "GLIBC_2.39" });
    const { elf } = fixture(versions, symbols);
    const before = Buffer.from(elf);
    expect(() => makeGlibcNeedOptional(elf)).toThrow(/not weak need GLIBC_2\.39: pidfd_send_signal/);
    expect(elf.equals(before)).toBe(true);
  });

  it("stoppar bygget när modulen kräver en nyare glibc än 2.34 på annat sätt", () => {
    const symbols = velopackLike();
    symbols.push({ name: "pthread_gettid_np", version: "GLIBC_2.38" });
    const { elf } = fixture(["GLIBC_2.14", "GLIBC_2.34", "GLIBC_2.38", "GLIBC_2.39"], symbols);
    expect(() => makeGlibcNeedOptional(elf)).toThrow(/needs GLIBC_2\.38 from libc\.so\.6 \(pthread_gettid_np\)/);
  });

  it("stoppar bygget när GLIBC_2.39 inte används av någon symbol, eller dess hash är fel", () => {
    expect(() => makeGlibcNeedOptional(fixture(versions, velopackLike().slice(0, 2)).elf)).toThrow(/no symbol uses GLIBC_2\.39/);
    expect(() => makeGlibcNeedOptional(fixture(versions, velopackLike(), { badHash: "GLIBC_2.39" }).elf)).toThrow(/hash of GLIBC_2\.39 is wrong/);
  });

  it("stoppar bygget för en fil som inte är en ELF-fil för x86-64 eller är avkortad", () => {
    expect(() => makeGlibcNeedOptional(Buffer.from("MZ not an ELF file, but long enough to have a header of sixty-four bytes"))).toThrow(/no ELF header/);
    const { elf } = fixture(versions, velopackLike());
    const arm = Buffer.from(elf);
    arm.writeUInt16LE(183, 0x12);
    expect(() => makeGlibcNeedOptional(arm)).toThrow(/not x86-64/);
    expect(() => makeGlibcNeedOptional(elf.subarray(0, elf.length - 100))).toThrow(/outside the file/);
  });

  it("velopacks riktiga Linux-modul: bara de svaga pidfd-funktionerna behöver 2.39, och patchen är en byte", () => {
    const requireTs = createRequire(import.meta.url);
    const file = join(dirname(requireTs.resolve("velopack/package.json")), "lib", "native", "velopack_nodeffi_linux_x64_gnu.node");
    const original = readFileSync(file);
    const elf = Buffer.from(original);
    const result = makeGlibcNeedOptional(elf);
    expect(result).toEqual({ version: "GLIBC_2.39", symbols: ["pidfd_spawnp", "pidfd_getpid"], changed: true });
    expect(differingBytes(original, elf)).toHaveLength(1);
    // readelf (binutils) reads the patched file the same way: the need is now WEAK, the others unchanged.
    if (spawnSync("readelf", ["--version"]).status !== 0) return;
    const dir = mkdtempSync(join(tmpdir(), "velopack-glibc-"));
    try {
      writeFileSync(join(dir, "module.node"), elf);
      const readelf = (f: string) => spawnSync("readelf", ["-V", "-W", f], { encoding: "utf8" }).stdout;
      expect(readelf(join(dir, "module.node"))).toMatch(/Name: GLIBC_2\.39\s+Flags: WEAK\s+Version: \d+/);
      expect(readelf(file)).toMatch(/Name: GLIBC_2\.39\s+Flags: none/);
      const strip = (s: string) => s.replace(/Name: GLIBC_2\.39\s+Flags: \w+/, "");
      expect(strip(readelf(join(dir, "module.node")))).toBe(strip(readelf(file)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
