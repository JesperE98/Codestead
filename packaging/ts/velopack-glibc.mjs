// velopack's Linux module (node_modules/velopack/lib/native/velopack_nodeffi_linux_x64_gnu.node) is built against
// glibc 2.39, but the only functions it takes from 2.39 (pidfd_spawnp, pidfd_getpid: Rust's standard library uses them
// when they exist) are weak symbols: the module works with older glibc. The dynamic loader still refuses to load it there
// ("version `GLIBC_2.39' not found": Ubuntu 22.04, Debian 12), because the version itself is required. This marks that
// one version need as optional (VER_FLG_WEAK in .gnu.version_r, one byte): the loader then accepts its absence and the
// weak symbols stay null, as Rust expects. Without it the apps would start but never update themselves there
// (ts/packages/ui/src/electron/VelopackUpdate.ts falls back to no self-update when the module does not load).
//
// It patches only the layout it was checked for and fails the build otherwise, so that a new velopack is looked at
// before it ships: the module must need exactly one libc version newer than NEWEST_REQUIRED_GLIBC, which is
// OPTIONAL_GLIBC, only weak, undefined symbols may use it, and nothing else may need a newer glibc. The release's
// install test on Ubuntu 22.04 loads the patched module (packaging/install-test.sh, packaging/ts/velopack-check.cjs).
// packaging/ts/package-app.mjs calls it; ts/packages/ui/test/VelopackGlibcTests.test.ts tests it.
import { readFileSync, writeFileSync } from "node:fs";

/** The glibc version whose need is made optional. */
export const OPTIONAL_GLIBC = "GLIBC_2.39";
/** The newest glibc the module may really need (RHEL 9; Ubuntu 22.04 has 2.35, Debian 12 2.36). */
export const NEWEST_REQUIRED_GLIBC = "GLIBC_2.34";

const SHT_DYNSYM = 11;
const SHT_GNU_VERNEED = 0x6ffffffe;
const SHT_GNU_VERSYM = 0x6fffffff;
const VER_FLG_WEAK = 2;
const STB_WEAK = 2;
const EM_X86_64 = 62;

/** The ELF hash of a version name (vna_hash). */
export function elfHash(name) {
  let h = 0;
  for (const c of Buffer.from(name, "latin1")) {
    h = ((h << 4) + c) >>> 0;
    const g = h & 0xf0000000;
    if (g !== 0) h ^= g >>> 24;
    h &= ~g >>> 0;
  }
  return h >>> 0;
}

/** "GLIBC_2.39" → [2, 39]. */
function glibcNumbers(name) {
  const m = /^GLIBC_(\d+(?:\.\d+)*)$/.exec(name);
  return m === null ? null : m[1].split(".").map(Number);
}

function newer(a, b) {
  const x = glibcNumbers(a), y = glibcNumbers(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/**
 * What the module needs from glibc, read from its ELF dynamic section tables (the same as `readelf -V --dyn-syms`):
 * every version need of every library, with the undefined dynamic symbols that use it.
 */
export function readVersionNeeds(b) {
  const fail = (why) => {
    throw new Error(`not the ELF layout expected: ${why}`);
  };
  const need = (offset, length) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + length > b.length) fail(`offset ${offset} is outside the file`);
  };
  need(0, 64);
  if (b.readUInt32BE(0) !== 0x7f454c46) fail("no ELF header");
  if (b[4] !== 2 || b[5] !== 1) fail("not a 64-bit little-endian ELF file");
  if (b.readUInt16LE(0x12) !== EM_X86_64) fail("not x86-64");
  const shoff = Number(b.readBigUInt64LE(0x28));
  const shentsize = b.readUInt16LE(0x3a);
  const shnum = b.readUInt16LE(0x3c);
  if (shentsize < 64) fail("bad section header size");
  need(shoff, shnum * shentsize);
  const sections = Array.from({ length: shnum }, (_, i) => {
    const o = shoff + i * shentsize;
    const s = {
      type: b.readUInt32LE(o + 4),
      offset: Number(b.readBigUInt64LE(o + 0x18)),
      size: Number(b.readBigUInt64LE(o + 0x20)),
      link: b.readUInt32LE(o + 0x28),
      info: b.readUInt32LE(o + 0x2c),
      entsize: Number(b.readBigUInt64LE(o + 0x38)),
    };
    if (s.type !== 0 && s.type !== 8 /* SHT_NOBITS */) need(s.offset, s.size);
    return s;
  });
  const one = (type, what) => {
    const found = sections.filter((s) => s.type === type);
    if (found.length !== 1) fail(`${found.length} ${what} sections`);
    return found[0];
  };
  const dynsym = one(SHT_DYNSYM, ".dynsym");
  const versym = one(SHT_GNU_VERSYM, ".gnu.version");
  const verneed = one(SHT_GNU_VERNEED, ".gnu.version_r");
  if (dynsym.entsize !== 24) fail(".dynsym entries are not 24 bytes");
  const count = dynsym.size / 24;
  if (!Number.isInteger(count) || versym.size !== count * 2) fail(".gnu.version does not match .dynsym");
  const stringsOf = (s) => {
    const t = sections[s.link];
    if (t === undefined || t.type !== 3 /* SHT_STRTAB */) fail("a string table is missing");
    return (off) => {
      need(t.offset + off, 1);
      const end = b.indexOf(0, t.offset + off);
      if (end < 0 || end >= t.offset + t.size) fail("a string runs past its table");
      return b.toString("latin1", t.offset + off, end);
    };
  };
  const symName = stringsOf(dynsym);
  const verName = stringsOf(verneed);

  // Version index → the undefined symbols that need it.
  const users = new Map();
  for (let i = 1; i < count; i++) {
    const sym = dynsym.offset + i * 24;
    if (b.readUInt16LE(sym + 6) !== 0) continue; // defined here (st_shndx), not needed from a library
    const index = b.readUInt16LE(versym.offset + i * 2) & 0x7fff;
    if (index < 2) continue; // local or global: no version
    if (!users.has(index)) users.set(index, []);
    users.get(index).push({ name: symName(b.readUInt32LE(sym)), weak: b[sym + 4] >> 4 === STB_WEAK });
  }

  const needs = [];
  let vn = verneed.offset;
  for (let n = 0; n < verneed.info; n++) {
    need(vn, 16);
    if (b.readUInt16LE(vn) !== 1) fail("unknown Verneed version");
    const file = verName(b.readUInt32LE(vn + 4));
    const cnt = b.readUInt16LE(vn + 2);
    let aux = vn + b.readUInt32LE(vn + 8);
    for (let a = 0; a < cnt; a++) {
      need(aux, 16);
      const name = verName(b.readUInt32LE(aux + 8));
      const index = b.readUInt16LE(aux + 6);
      needs.push({
        file,
        name,
        hash: b.readUInt32LE(aux),
        flagsOffset: aux + 4,
        flags: b.readUInt16LE(aux + 4),
        index,
        symbols: users.get(index) ?? [],
      });
      const next = b.readUInt32LE(aux + 12);
      if (next === 0 && a < cnt - 1) fail("Vernaux chain ends early");
      aux += next;
    }
    const next = b.readUInt32LE(vn + 12);
    if (next === 0 && n < verneed.info - 1) fail("Verneed chain ends early");
    vn += next;
  }
  return needs;
}

/**
 * Checks the module's glibc needs and marks OPTIONAL_GLIBC as optional in `b` (in place). Throws when the module is not
 * as expected. Returns the weak symbols that use the version and whether a byte was changed (false: already optional).
 */
export function makeGlibcNeedOptional(b) {
  const needs = readVersionNeeds(b);
  const glibc = needs.filter((n) => glibcNumbers(n.name) !== null);
  const problems = [];
  const optional = glibc.filter((n) => n.name === OPTIONAL_GLIBC);
  if (optional.length !== 1 || optional[0].file !== "libc.so.6")
    problems.push(`${optional.length === 0 ? "it does not need" : "it needs more than one"} ${OPTIONAL_GLIBC} from libc.so.6`);
  for (const n of glibc) {
    if (n.name === OPTIONAL_GLIBC) continue;
    if (newer(n.name, NEWEST_REQUIRED_GLIBC)) problems.push(`it needs ${n.name} from ${n.file} (${n.symbols.map((s) => s.name).join(", ") || "no symbol"})`);
  }
  const entry = optional[0];
  if (optional.length === 1) {
    if (entry.hash !== elfHash(entry.name)) problems.push(`the hash of ${entry.name} is wrong`);
    const strong = entry.symbols.filter((s) => !s.weak);
    if (strong.length > 0) problems.push(`symbols that are not weak need ${OPTIONAL_GLIBC}: ${strong.map((s) => s.name).join(", ")}`);
    if (entry.symbols.length === 0) problems.push(`no symbol uses ${OPTIONAL_GLIBC}`);
  }
  if (problems.length > 0)
    throw new Error(
      `velopack's Linux module is not as expected (packaging/ts/velopack-glibc.mjs): ${problems.join("; ")}. ` +
        `Check whether it still loads on glibc ${NEWEST_REQUIRED_GLIBC.slice(6)}–2.38 (Ubuntu 22.04: packaging/install-test.sh) and update the check.`,
    );
  const changed = (entry.flags & VER_FLG_WEAK) === 0;
  if (changed) b.writeUInt16LE(entry.flags | VER_FLG_WEAK, entry.flagsOffset);
  return { version: entry.name, symbols: entry.symbols.map((s) => s.name), changed };
}

/** {@link makeGlibcNeedOptional} on a file. */
export function makeGlibcNeedOptionalInFile(file) {
  const b = readFileSync(file);
  let result;
  try {
    result = makeGlibcNeedOptional(b);
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (result.changed) writeFileSync(file, b);
  return result;
}
