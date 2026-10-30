// Arkiv och komprimering: tar, gzip, gunzip, zcat, zip och unzip – samt du,
// som visar hur mycket plats filer och kataloger tar.
//
// Arkiven är vanliga strängar i det virtuella filsystemet:
//
//     MARKÖR NUL låtsasstorlek NUL kodat-innehåll
//
// Innehållet är JSON (sökvägar, typ, rättigheter, ägare, tid och filinnehåll)
// som kodats med base64 och ett utbytt alfabet, så att `cat arkiv.tar` ser ut
// som binärt skräp. Låtsasstorleken (som ls -l och du visar) räknas fram med
// en enkel uppskattning av hur bra deflate – algoritmen i gzip och zip – hade
// komprimerat innehållet. Markörerna känns igen av nodeSize() i vfs.ts.

import { globToRegex } from '../parser';
import type { CmdCtx, CommandDef } from '../types';
import { basename, dirname, FsError, hasPerm, makeFile, nodeSize, resolvePath, type FsNode, type User } from '../vfs';
import { fsMessage, humanSize, modeString, parseOpts, type Opts } from './util';

export const TAR_MAGIC = '\u0000SIMTAR1';
export const GZ_MAGIC = '\u001f\u008b\u0008SIMGZ1';
export const ZIP_MAGIC = 'PK\u0003\u0004SIMZIP1';

/** En fil eller katalog i ett tar- eller zip-arkiv. */
export interface ArchiveEntry {
  /** Relativ sökväg, utan avslutande /. */
  path: string;
  type: 'file' | 'dir';
  mode: number;
  owner: string;
  group: string;
  mtime: number;
  content?: string;
  /** Låtsasstorlek, för simulerade binärfiler (t.ex. /usr/bin/ls). */
  size?: number;
}

/** Det som gzip sparar: originalnamn, ev. låtsasstorlek och själva datat. */
export interface GzPayload {
  n?: string;
  s?: number;
  d: string;
}

// ---------------------------------------------------------------- kodning

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// 64 tecken ur Latin-1 (¡ ... á, utom mjukt bindestreck) – ser ut som binärdata.
const SCRAMBLED = (() => {
  let s = '';
  for (let c = 0xa1; s.length < 64; c++) if (c !== 0xad) s += String.fromCharCode(c);
  return s;
})();
const TO_SCRAMBLED: Record<string, string> = {};
const FROM_SCRAMBLED: Record<string, string> = {};
for (let i = 0; i < 64; i++) {
  TO_SCRAMBLED[B64[i]] = SCRAMBLED[i];
  FROM_SCRAMBLED[SCRAMBLED[i]] = B64[i];
}

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  let out = '';
  for (const ch of btoa(bin)) if (ch !== '=') out += TO_SCRAMBLED[ch];
  return out;
}

function decode(data: string): string | null {
  try {
    let b64 = '';
    for (const ch of data) {
      const m = FROM_SCRAMBLED[ch];
      if (m === undefined) return null;
      b64 += m;
    }
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function wrap(magic: string, size: number, payload: unknown): string {
  return `${magic}\u0000${size}\u0000${encode(JSON.stringify(payload))}`;
}

function unwrap(magic: string, content: string): unknown {
  if (!content.startsWith(magic + '\u0000')) return null;
  const rest = content.slice(magic.length + 1);
  const nul = rest.indexOf('\u0000');
  if (nul < 0) return null;
  const json = decode(rest.slice(nul + 1));
  if (json === null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- storlekar

const utf8Length = (s: string) => new TextEncoder().encode(s).length;

/** Storleken på innehållet som programmen ser det (arkiv har en låtsasstorlek). */
function logicalSize(content: string): number {
  return nodeSize({ type: 'file', mode: 0, owner: '', group: '', mtime: 0, content });
}

/**
 * Uppskattar hur många byte deflate (gzip/zip) komprimerar texten till: en
 * enkel LZ77 som letar upprepningar, där en upprepning kostar några få byte
 * och övriga tecken knappt en byte var. Små filer blir därför inte mindre.
 */
export function deflateSize(text: string): number {
  const b = new TextEncoder().encode(text);
  const n = b.length;
  if (n === 0) return 2;
  const last = new Map<number, number>();
  const key = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
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

const entrySize = (e: ArchiveEntry) => (e.type === 'dir' ? 0 : (e.size ?? logicalSize(e.content ?? '')));

/** Ungefär hur många byte deflate gör av innehållet. */
function packedSize(content: string, size?: number): number {
  if (size !== undefined) return Math.round(size * 0.45);
  const entries = readTar(content);
  // Ett tar-arkiv består mest av nollor och huvuden, som komprimeras till nästan ingenting.
  if (entries) return 2 + entries.reduce((s, e) => s + 24 + utf8Length(e.path) + compressedEntrySize(e), 0);
  // Redan komprimerat (.gz, .zip) blir inte mindre – snarare lite större.
  if (content.startsWith(GZ_MAGIC) || content.startsWith(ZIP_MAGIC)) return logicalSize(content) + 5;
  return deflateSize(content);
}

/** Komprimerad storlek för en fil i ett arkiv. Aldrig större än originalet (då lagras den okomprimerad). */
function compressedEntrySize(e: ArchiveEntry): number {
  if (e.type === 'dir') return 0;
  return Math.min(packedSize(e.content ?? '', e.size), entrySize(e));
}

/** Ett riktigt tar-arkiv: 512 byte huvud per fil, innehåll i block om 512, totalt en multipel av 10240. */
function tarSize(entries: ArchiveEntry[]): number {
  let n = 1024;
  for (const e of entries) n += 512 + Math.ceil(entrySize(e) / 512) * 512;
  return Math.ceil(n / 10240) * 10240;
}

function gzSize(p: GzPayload): number {
  return 18 + (p.n ? utf8Length(p.n) + 1 : 0) + packedSize(p.d, p.s);
}

function zipSize(entries: ArchiveEntry[]): number {
  return entries.reduce((s, e) => s + 76 + 2 * utf8Length(entryLabel(e)) + compressedEntrySize(e), 22);
}

// ---------------------------------------------------------------- format

export function makeTar(entries: ArchiveEntry[]): string {
  return wrap(TAR_MAGIC, tarSize(entries), { entries });
}

export function readTar(content: string): ArchiveEntry[] | null {
  const p = unwrap(TAR_MAGIC, content) as { entries?: unknown } | null;
  return p && Array.isArray(p.entries) ? (p.entries as ArchiveEntry[]) : null;
}

export function gzipString(data: string, name?: string, size?: number): string {
  const p: GzPayload = { d: data };
  if (name) p.n = name;
  if (size !== undefined) p.s = size;
  return wrap(GZ_MAGIC, gzSize(p), p);
}

export function gunzipString(content: string): GzPayload | null {
  const p = unwrap(GZ_MAGIC, content) as GzPayload | null;
  return p && typeof p.d === 'string' ? p : null;
}

export function makeZip(entries: ArchiveEntry[]): string {
  return wrap(ZIP_MAGIC, zipSize(entries), { entries });
}

export function readZip(content: string): ArchiveEntry[] | null {
  const p = unwrap(ZIP_MAGIC, content) as { entries?: unknown } | null;
  return p && Array.isArray(p.entries) ? (p.entries as ArchiveEntry[]) : null;
}

/** Läser ett arkiv oavsett format (används bl.a. av uppgifternas kontroller). */
export function readArchive(content: string): { format: 'tar' | 'tar.gz' | 'zip'; entries: ArchiveEntry[] } | null {
  const tar = readTar(content);
  if (tar) return { format: 'tar', entries: tar };
  const zip = readZip(content);
  if (zip) return { format: 'zip', entries: zip };
  const gz = gunzipString(content);
  const inner = gz ? readTar(gz.d) : null;
  return inner ? { format: 'tar.gz', entries: inner } : null;
}

// ---------------------------------------------------------------- hjälpfunktioner

function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

/** Så som tar och zip visar en post: kataloger får ett avslutande /. */
function entryLabel(e: ArchiveEntry): string {
  return e.type === 'dir' ? `${e.path}/` : e.path;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function entryNode(e: ArchiveEntry): FsNode {
  return { type: e.type, mode: e.mode, owner: e.owner, group: e.group, mtime: e.mtime };
}

interface WalkHandlers {
  add(e: ArchiveEntry): void;
  error(name: string, message: string): void;
  /** Sant = hoppa över (t.ex. arkivfilen själv). */
  skip?(abs: string, name: string): boolean;
}

/** Går igenom en fil eller katalog och gör om den till arkivposter. */
function walkTree(user: User, node: FsNode, abs: string, name: string, recursive: boolean, h: WalkHandlers): void {
  if (h.skip?.(abs, name)) return;
  const base = { mode: node.mode & 0o7777, owner: node.owner, group: node.group, mtime: node.mtime };
  if (node.type === 'file') {
    if (!hasPerm(node, user, 'r')) {
      h.error(name, 'Permission denied');
      return;
    }
    const e: ArchiveEntry = { path: name, type: 'file', ...base, content: node.content ?? '' };
    if (node.size !== undefined) e.size = node.size;
    h.add(e);
    return;
  }
  // Namnet '' betyder rotkatalogen (tar -cf x.tar /): den läggs inte till själv.
  if (name !== '') h.add({ path: name, type: 'dir', ...base });
  if (!recursive) return;
  if (!hasPerm(node, user, 'r') || !hasPerm(node, user, 'x')) {
    h.error(name || '/', 'Permission denied');
    return;
  }
  for (const child of Object.keys(node.children ?? {}).sort()) {
    walkTree(user, node.children![child], joinPath(abs, child), name === '' ? child : `${name}/${child}`, recursive, h);
  }
}

/** Gör om en sökväg i ett arkiv till säkra segment (inga .. eller absoluta sökvägar). */
function safeSegments(path: string): string[] | null {
  const segs = path.split('/').filter((s) => s !== '' && s !== '.');
  return segs.includes('..') ? null : segs;
}

interface ExtractOptions {
  /** Behåll ägaren från arkivet (bara root kan det). */
  keepOwner: boolean;
  /** Bitar som tas bort från rättigheterna (umask). */
  umask: number;
  /** Anropas innan en post packas upp (med det som redan finns där). Returnerar false för att hoppa över den. */
  before?(e: ArchiveEntry, existing: FsNode | null): boolean;
  error(e: ArchiveEntry, what: 'file' | 'dir', message: string): void;
}

/** Packar upp poster under katalogen base. Returnerar false om något gick fel. */
function extractEntries(ctx: CmdCtx, entries: ArchiveEntry[], base: string, opts: ExtractOptions): boolean {
  const sh = ctx.sh;
  const user = sh.currentUser();
  let ok = true;
  // Katalogernas rättigheter sätts sist, så att en skrivskyddad katalog ändå kan fyllas.
  const dirFixes: { node: FsNode; e: ArchiveEntry }[] = [];
  const owner = (e: ArchiveEntry) => (opts.keepOwner ? { owner: e.owner, group: e.group } : { owner: user.name, group: user.groups[0] });
  const mode = (e: ArchiveEntry) => e.mode & (user.uid === 0 ? 0o7777 : 0o777) & ~opts.umask;

  for (const e of entries) {
    const segs = safeSegments(e.path);
    if (!segs) {
      opts.error(e, e.type, 'Member name contains ..');
      ok = false;
      continue;
    }
    if (!segs.length) continue; // posten "./" – katalogen vi packar upp i
    const abs = segs.reduce(joinPath, base);
    const existing = sh.vfs.tryLookup(abs, user);
    if (opts.before && !opts.before(e, existing)) continue;
    try {
      // Föräldrakataloger som saknas skapas tyst, precis som i tar och unzip.
      let cur = base;
      for (const seg of segs.slice(0, -1)) {
        cur = joinPath(cur, seg);
        const n = sh.vfs.tryLookup(cur, user);
        if (!n) sh.vfs.mkdir(cur, user);
        else if (n.type !== 'dir') throw new FsError('ENOTDIR');
      }
      if (e.type === 'dir') {
        if (existing && existing.type !== 'dir') throw new FsError('EEXIST');
        if (!existing) sh.vfs.mkdir(abs, user);
        const node = sh.vfs.lookup(abs, user);
        if (!existing || user.uid === 0 || node.owner === user.name) dirFixes.push({ node, e });
      } else {
        if (existing?.type === 'dir') throw new FsError('EISDIR');
        const { owner: o, group: g } = owner(e);
        const node = makeFile(e.content ?? '', o, mode(e), g);
        node.mtime = e.mtime;
        if (e.size !== undefined) node.size = e.size;
        sh.vfs.insert(abs, node, user);
      }
    } catch (err) {
      opts.error(e, e.type, fsMessage(err));
      ok = false;
    }
  }
  for (const { node, e } of dirFixes.reverse()) {
    node.mode = mode(e);
    node.mtime = e.mtime;
    if (opts.keepOwner) Object.assign(node, owner(e));
  }
  return ok;
}

/** Filtrerar poster efter namn som eleven angett (exakta, kataloger eller jokertecken). */
function selectEntries(entries: ArchiveEntry[], patterns: string[]): { selected: ArchiveEntry[]; missing: string[] } {
  if (!patterns.length) return { selected: entries, missing: [] };
  const missing: string[] = [];
  const matchers = patterns.map((p) => {
    const clean = p.replace(/^(\.\/)+/, '').replace(/\/+$/, '');
    const re = globToRegex(clean);
    return (path: string) => path === clean || path.startsWith(clean + '/') || re.test(path);
  });
  matchers.forEach((m, i) => {
    if (!entries.some((e) => m(e.path))) missing.push(patterns[i]);
  });
  return { selected: entries.filter((e) => matchers.some((m) => m(e.path))), missing };
}

// ---------------------------------------------------------------- tar

const TAR_TRY = "Try 'tar --help' or 'tar --usage' for more information.\n";
const TAR_FATAL = 'tar: Error is not recoverable: exiting now\n';
const TAR_FAILED = 'tar: Exiting with failure status due to previous errors\n';

/** Tolkar tar-flaggor, även den gamla stilen utan bindestreck: tar czvf x.tar.gz katalog */
function parseTarArgs(args: string[]): Opts {
  let list = [...args];
  if (list.length && /^[a-zA-Z]+$/.test(list[0]) && !list[0].startsWith('-')) {
    const letters = list.shift()!;
    const expanded: string[] = [];
    for (const ch of letters) {
      expanded.push('-' + ch);
      if ((ch === 'f' || ch === 'C') && list.length) expanded.push(list.shift()!);
    }
    list = [...expanded, ...list];
  }
  return parseOpts(list, {
    flags: 'cxtvzp',
    values: 'fC',
    long: {
      create: 'c',
      extract: 'x',
      get: 'x',
      list: 't',
      verbose: 'v',
      gzip: 'z',
      gunzip: 'z',
      ungzip: 'z',
      file: 'f',
      directory: 'C',
      'preserve-permissions': 'p',
      'same-permissions': 'p',
    },
  });
}

function tarLong(e: ArchiveEntry): string {
  const ug = `${e.owner}/${e.group}`;
  const size = String(entrySize(e));
  return `${modeString(entryNode(e))} ${ug}${' '.repeat(Math.max(1, 19 - ug.length - size.length))}${size} ${isoDate(e.mtime)} ${entryLabel(e)}`;
}

function tarCreate(ctx: CmdCtx, o: Opts): number {
  const sh = ctx.sh;
  const user = sh.currentUser();
  if (!o.operands.length) {
    ctx.err('tar: Cowardly refusing to create an empty archive\n' + TAR_TRY);
    return 2;
  }
  const file = o.values.f;
  const toStdout = file === undefined || file === '-';
  if (toStdout && ctx.isTTY) {
    ctx.err('tar: Refusing to write archive contents to terminal (missing -f option?)\n' + TAR_FATAL);
    return 2;
  }
  let base = sh.cwd;
  if (o.values.C !== undefined) {
    base = sh.resolve(o.values.C);
    if (sh.vfs.tryLookup(base, user)?.type !== 'dir') {
      ctx.err(`tar: ${o.values.C}: Cannot chdir: No such file or directory\n` + TAR_FATAL);
      return 2;
    }
  }
  const archivePath = toStdout ? null : sh.resolve(file);
  if (archivePath) {
    // Precis som riktiga tar skapas (töms) arkivfilen innan något läses.
    try {
      sh.vfs.writeFile(archivePath, '', user);
    } catch (e) {
      ctx.err(`tar: ${file}: Cannot open: ${fsMessage(e)}\n` + TAR_FATAL);
      return 2;
    }
  }
  // När arkivet skrivs till stdout går listan från -v till stderr.
  const verbose = (s: string) => (toStdout ? ctx.err(s) : ctx.out(s));
  const entries: ArchiveEntry[] = [];
  const warned = new Set<string>();
  let failed = false;
  for (const op of o.operands) {
    const abs = resolvePath(base, op);
    // Arkivet ska gå att packa upp var som helst, så sökvägarna görs relativa.
    let name = op === '/' ? '/' : op.replace(/\/+$/, '');
    const strip = (re: RegExp, prefix: string) => {
      if (!re.test(name)) return;
      name = name.replace(re, '');
      if (!warned.has(prefix)) ctx.err(`tar: Removing leading \`${prefix}' from member names\n`);
      warned.add(prefix);
    };
    strip(/^\/+/, '/');
    strip(/^(\.\.(\/|$))+/, '../');
    let node: FsNode;
    try {
      node = sh.vfs.lookup(abs, user);
    } catch (e) {
      ctx.err(`tar: ${op}: Cannot stat: ${fsMessage(e)}\n`);
      failed = true;
      continue;
    }
    walkTree(user, node, abs, name, true, {
      add: (e) => {
        entries.push(e);
        if (o.flags.has('v')) verbose(entryLabel(e) + '\n');
      },
      error: (n, msg) => {
        ctx.err(`tar: ${n}: Cannot open: ${msg}\n`);
        failed = true;
      },
      skip: (a, n) => {
        if (a !== archivePath) return false;
        ctx.err(`tar: ${n}: file is the archive; not dumped\n`);
        return true;
      },
    });
  }
  let data = makeTar(entries);
  if (o.flags.has('z')) data = gzipString(data);
  if (archivePath) {
    try {
      sh.vfs.writeFile(archivePath, data, user);
    } catch (e) {
      ctx.err(`tar: ${file}: Cannot write: ${fsMessage(e)}\n` + TAR_FATAL);
      return 2;
    }
  } else {
    ctx.out(data);
  }
  if (failed) ctx.err(TAR_FAILED);
  return failed ? 2 : 0;
}

function tarRead(ctx: CmdCtx, o: Opts, extract: boolean): number {
  const sh = ctx.sh;
  const user = sh.currentUser();
  const file = o.values.f;
  let raw: string;
  if (file === undefined || file === '-') {
    if (ctx.stdin === null) {
      ctx.err('tar: Refusing to read archive contents from terminal (missing -f option?)\n' + TAR_FATAL);
      return 2;
    }
    raw = ctx.stdin;
  } else {
    try {
      raw = sh.vfs.readFile(sh.resolve(file), user);
    } catch (e) {
      const isDir = e instanceof FsError && e.code === 'EISDIR';
      ctx.err(`tar: ${file}: ${isDir ? 'Cannot read' : 'Cannot open'}: ${fsMessage(e)}\n` + TAR_FATAL);
      return 2;
    }
  }
  if (raw === '') return 0; // ett tomt arkiv innehåller ingenting
  const gz = gunzipString(raw);
  if (o.flags.has('z') && !gz) {
    ctx.err('gzip: stdin: not in gzip format\ntar: Child returned status 1\n' + TAR_FATAL);
    return 2;
  }
  // GNU tar känner själv igen komprimerade arkiv när det läser, även utan -z.
  const entries = readTar(gz ? gz.d : raw);
  if (!entries) {
    ctx.err('tar: This does not look like a tar archive\n' + TAR_FAILED);
    return 2;
  }
  const { selected, missing } = selectEntries(entries, o.operands);
  let failed = false;

  if (!extract) {
    for (const e of selected) ctx.out((o.flags.has('v') ? tarLong(e) : entryLabel(e)) + '\n');
  } else {
    let base = sh.cwd;
    if (o.values.C !== undefined) {
      base = sh.resolve(o.values.C);
      let dir: FsNode | null = null;
      let msg = 'No such file or directory';
      try {
        dir = sh.vfs.lookup(base, user);
        if (dir.type !== 'dir') msg = 'Not a directory';
      } catch (e) {
        msg = fsMessage(e);
      }
      if (dir?.type !== 'dir') {
        ctx.err(`tar: ${o.values.C}: Cannot chdir: ${msg}\n` + TAR_FATAL);
        return 2;
      }
    }
    const ok = extractEntries(ctx, selected, base, {
      keepOwner: user.uid === 0,
      umask: o.flags.has('p') || user.uid === 0 ? 0 : 0o022,
      before: (e) => {
        if (o.flags.has('v')) ctx.out(entryLabel(e) + '\n');
        return true;
      },
      error: (e, what, msg) => ctx.err(`tar: ${e.path}: ${what === 'dir' ? 'Cannot mkdir' : 'Cannot open'}: ${msg}\n`),
    });
    if (!ok) failed = true;
  }
  for (const m of missing) ctx.err(`tar: ${m}: Not found in archive\n`);
  if (missing.length) failed = true;
  if (failed) ctx.err(TAR_FAILED);
  return failed ? 2 : 0;
}

const tar: CommandDef = {
  name: 'tar',
  summary: 'Packar ihop filer till ett arkiv (.tar, .tar.gz) och packar upp dem',
  man: `NAMN
       tar - packa ihop filer till ett arkiv, och packa upp dem igen
             (tape archive)

SYNOPSIS
       tar -c [-v] [-z] -f ARKIV FIL...      skapa ett arkiv
       tar -t [-v] [-z] -f ARKIV             lista innehållet
       tar -x [-v] [-z] -f ARKIV [-C KAT]    packa upp

BESKRIVNING
       tar samlar många filer och kataloger i EN fil, ett arkiv. Rättigheter,
       ägare och tidsstämplar följer med. tar komprimerar inte själv – med
       -z skickas arkivet genom gzip, och då brukar filen heta .tar.gz
       eller .tgz.

       Flaggorna kan skrivas ihop, och bindestrecket kan utelämnas:
       tar -czvf, tar czvf och tar -c -z -v -f betyder samma sak.

FLAGGOR
       -c, --create       skapa ett nytt arkiv (create)
       -x, --extract      packa upp (extract)
       -t, --list         lista innehållet (table of contents)
       -v, --verbose      visa filerna som hanteras; med -t i ls -l-format
       -f, --file=ARKIV   arkivfilen. Lägg f sist bland ihopskrivna flaggor,
                          eftersom filnamnet ska komma direkt efter
       -z, --gzip         komprimera/dekomprimera med gzip
       -C, --directory=KAT  byt till katalogen KAT först (vid -x: packa
                          upp där i stället för i aktuell katalog)
       -p                 behåll rättigheterna exakt vid uppackning

EXEMPEL
       tar -czvf dokument.tar.gz dokument     packa ihop och komprimera
       tar -tzvf dokument.tar.gz              titta i arkivet
       tar -xzvf dokument.tar.gz -C /tmp      packa upp i /tmp

MINNESREGEL
       c = create, x = extract, t = list, z = gzip, v = verbose, f = file.
       "Create Zipped Verbose File" – czvf.`,
  run(ctx) {
    const o = parseTarArgs(ctx.args);
    if (o.error) {
      ctx.err(`tar: ${o.error}\n` + TAR_TRY);
      return 2;
    }
    const ops = ['c', 'x', 't'].filter((f) => o.flags.has(f));
    if (ops.length === 0) {
      ctx.err("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\n" + TAR_TRY);
      return 2;
    }
    if (ops.length > 1) {
      ctx.err("tar: You may not specify more than one '-Acdtrux', '--delete' or  '--test-label' option\n" + TAR_TRY);
      return 2;
    }
    if (ops[0] === 'c') return tarCreate(ctx, o);
    return tarRead(ctx, o, ops[0] === 'x');
  },
};

// ---------------------------------------------------------------- gzip, gunzip, zcat

function ratio(compressed: number, uncompressed: number): string {
  const r = uncompressed === 0 ? 0 : (1 - compressed / uncompressed) * 100;
  return `${r.toFixed(1).padStart(5)}%`;
}

const GZ_SUFFIXES: [string, string][] = [
  ['.tgz', '.tar'],
  ['.gz', ''],
];

function gzipLike(mode: 'gzip' | 'gunzip' | 'zcat'): (ctx: CmdCtx) => number {
  return (ctx) => {
    const o = parseOpts(ctx.args, {
      flags: 'cdfklqrtv123456789',
      long: {
        stdout: 'c',
        'to-stdout': 'c',
        decompress: 'd',
        uncompress: 'd',
        force: 'f',
        keep: 'k',
        list: 'l',
        quiet: 'q',
        recursive: 'r',
        test: 't',
        verbose: 'v',
        fast: '1',
        best: '9',
      },
    });
    if (o.error) {
      ctx.err(`gzip: ${o.error}\nTry \`gzip --help' for more information.\n`);
      return 1;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    const has = (f: string) => o.flags.has(f);
    const decompress = mode !== 'gzip' || has('d') || has('l') || has('t');
    const toStdout = mode === 'zcat' || has('c');
    const verbose = has('v') && !has('q');
    let code = 0;
    const warn = () => (code = Math.max(code, 2));
    const fail = () => (code = 1);
    const notToTerminal = () => {
      ctx.err('gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h\n');
      return 1;
    };
    const listRows: { c: number; u: number; name: string }[] = [];

    const handleStdin = (): void => {
      const input = ctx.stdin ?? '';
      if (!decompress) {
        if (ctx.isTTY && !has('f')) {
          code = notToTerminal();
          return;
        }
        ctx.out(gzipString(input));
        return;
      }
      if (input === '') {
        ctx.err('gzip: stdin: unexpected end of file\n');
        fail();
        return;
      }
      const gz = gunzipString(input);
      if (!gz) {
        ctx.err('gzip: stdin: not in gzip format\n');
        fail();
        return;
      }
      if (has('l')) listRows.push({ c: logicalSize(input), u: gz.s ?? logicalSize(gz.d), name: 'stdout' });
      else if (!has('t')) ctx.out(gz.d);
    };

    const handleFile = (label: string, abs: string, node: FsNode): void => {
      let content: string;
      try {
        content = sh.vfs.readFile(abs, user);
      } catch (e) {
        ctx.err(`gzip: ${label}: ${fsMessage(e)}\n`);
        fail();
        return;
      }

      // Skapar utfilen med samma rättigheter och tid som originalet, och tar bort originalet.
      const replace = (outLabel: string, data: string, size?: number): boolean => {
        const outAbs = joinPath(dirname(abs), basename(outLabel));
        if (sh.vfs.tryLookup(outAbs, user) && !has('f')) {
          ctx.err(`gzip: ${outLabel} already exists; not overwritten\n`);
          warn();
          return false;
        }
        try {
          const out = makeFile(data, user.uid === 0 ? node.owner : user.name, node.mode, user.uid === 0 ? node.group : user.groups[0]);
          out.mtime = node.mtime;
          if (size !== undefined) out.size = size;
          sh.vfs.insert(outAbs, out, user);
          if (!has('k')) sh.vfs.remove(abs, user);
        } catch (e) {
          ctx.err(`gzip: ${outLabel}: ${fsMessage(e)}\n`);
          fail();
          return false;
        }
        return true;
      };

      if (decompress) {
        const suffix = GZ_SUFFIXES.find(([s]) => label.endsWith(s) && label.length > s.length);
        if (!suffix && !toStdout && !has('l') && !has('t')) {
          ctx.err(`gzip: ${label}: unknown suffix -- ignored\n`);
          warn();
          return;
        }
        const gz = gunzipString(content);
        if (!gz) {
          ctx.err(`gzip: ${label}: not in gzip format\n`);
          fail();
          return;
        }
        const outLabel = suffix ? label.slice(0, -suffix[0].length) + suffix[1] : label;
        const uncompressed = gz.s ?? logicalSize(gz.d);
        if (has('l')) {
          listRows.push({ c: nodeSize(node), u: uncompressed, name: outLabel });
        } else if (has('t')) {
          if (verbose) ctx.err(`${label}:\t OK\n`);
        } else if (toStdout) {
          ctx.out(gz.d);
        } else if (replace(outLabel, gz.d, gz.s)) {
          if (verbose) ctx.err(`${label}:\t${ratio(nodeSize(node), uncompressed)} -- ${has('k') ? 'created' : 'replaced with'} ${outLabel}\n`);
        }
        return;
      }

      if (GZ_SUFFIXES.some(([s]) => label.endsWith(s)) && !toStdout) {
        ctx.err(`gzip: ${label} already has ${label.endsWith('.tgz') ? '.tgz' : '.gz'} suffix -- unchanged\n`);
        warn();
        return;
      }
      const data = gzipString(content, basename(label), node.size);
      if (toStdout) {
        if (ctx.isTTY && !has('f')) {
          code = notToTerminal();
          return;
        }
        ctx.out(data);
      } else if (replace(`${label}.gz`, data)) {
        if (verbose) ctx.err(`${label}:\t${ratio(logicalSize(data), nodeSize(node))} -- ${has('k') ? 'created' : 'replaced with'} ${label}.gz\n`);
      }
    };

    const visit = (label: string, abs: string): void => {
      let node: FsNode;
      try {
        node = sh.vfs.lookup(abs, user);
      } catch (e) {
        ctx.err(`gzip: ${label}: ${fsMessage(e)}\n`);
        fail();
        return;
      }
      if (node.type === 'dir') {
        if (!has('r')) {
          ctx.err(`gzip: ${label} is a directory -- ignored\n`);
          warn();
          return;
        }
        if (!hasPerm(node, user, 'r')) {
          ctx.err(`gzip: ${label}: Permission denied\n`);
          fail();
          return;
        }
        for (const child of Object.keys(node.children ?? {}).sort()) {
          visit(label.endsWith('/') ? label + child : `${label}/${child}`, joinPath(abs, child));
        }
        return;
      }
      handleFile(label, abs, node);
    };

    const operands = o.operands.length ? o.operands : ['-'];
    for (const op of operands) {
      if (op === '-') handleStdin();
      else visit(op, sh.resolve(op));
    }

    if (listRows.length) {
      const row = (c: number, u: number, name: string) =>
        `${String(c).padStart(19)} ${String(u).padStart(19)} ${ratio(c, u)} ${name}\n`;
      ctx.out(`${'compressed'.padStart(19)} ${'uncompressed'.padStart(19)}  ratio uncompressed_name\n`);
      for (const r of listRows) ctx.out(row(r.c, r.u, r.name));
      if (listRows.length > 1) {
        const c = listRows.reduce((s, r) => s + r.c, 0);
        const u = listRows.reduce((s, r) => s + r.u, 0);
        ctx.out(row(c, u, '(totals)'));
      }
    }
    return code;
  };
}

const GZIP_MAN = `NAMN
       gzip, gunzip, zcat - komprimera och dekomprimera filer

SYNOPSIS
       gzip [-k] [-v] [-d] [-c] [-l] FIL...
       gunzip FIL.gz...
       zcat FIL.gz...

BESKRIVNING
       gzip komprimerar EN fil i taget: fil.txt ersätts med den mindre
       filen fil.txt.gz. Rättigheter och tidsstämpel följer med. Vill du
       komprimera en hel katalog packar du först ihop den med tar (eller
       använder tar -z direkt).

       gunzip är samma sak som gzip -d och zcat samma sak som gzip -dc:
       zcat skriver ut innehållet utan att packa upp filen.

       Mycket små filer blir ofta STÖRRE av att komprimeras, eftersom
       gzip lägger till ett huvud med bland annat filnamnet.

FLAGGOR
       -k, --keep         behåll originalfilen
       -d, --decompress   dekomprimera (som gunzip)
       -c, --stdout       skriv resultatet till standard output
       -l, --list         visa storlek före och efter komprimering
       -v, --verbose      berätta hur mycket mindre filen blev
       -r, --recursive    komprimera alla filer i kataloger, var för sig
       -f, --force        skriv över filer som redan finns
       -1 ... -9          snabbare (-1) eller bättre (-9) komprimering

EXEMPEL
       gzip -kv server.log         komprimera, men behåll originalet
       gzip -l server.log.gz       hur mycket sparade vi?
       zcat server.log.gz | grep ERROR`;

const gzip: CommandDef = { name: 'gzip', summary: 'Komprimerar filer (fil → fil.gz)', man: GZIP_MAN, run: gzipLike('gzip') };
const gunzip: CommandDef = { name: 'gunzip', summary: 'Packar upp .gz-filer (samma som gzip -d)', man: GZIP_MAN, run: gzipLike('gunzip') };
const zcat: CommandDef = { name: 'zcat', summary: 'Visar innehållet i .gz-filer utan att packa upp dem', man: GZIP_MAN, run: gzipLike('zcat') };

// ---------------------------------------------------------------- zip och unzip

function zipMethod(e: ArchiveEntry): string {
  const size = entrySize(e);
  if (e.type === 'dir' || size === 0) return 'stored 0%';
  const pct = Math.round((1 - compressedEntrySize(e) / size) * 100);
  return pct > 0 ? `deflated ${pct}%` : 'stored 0%';
}

const zip: CommandDef = {
  name: 'zip',
  summary: 'Packar ihop och komprimerar filer till en .zip-fil',
  man: `NAMN
       zip - packa ihop och komprimera filer till ett zip-arkiv

SYNOPSIS
       zip [-r] [-q] [-j] ARKIV.zip FIL...

BESKRIVNING
       zip gör både det som tar och gzip gör: packar ihop flera filer till
       ett arkiv och komprimerar dem. Formatet kommer från Windows-världen,
       så välj zip när du ska skicka filer till någon som inte kör Linux.

       Finns arkivet redan läggs filerna till (eller uppdateras) i det.
       Saknar ARKIV filändelse läggs .zip till.

FLAGGOR
       -r    ta med kataloger och allt deras innehåll (recursive). Utan -r
             läggs bara den tomma katalogen till!
       -q    tyst – skriv inte ut något
       -j    spara bara filnamnen, inte katalogerna (junk paths)

EXEMPEL
       zip -r dokument.zip dokument
       zip bilder.zip bild1.png bild2.png

SE ÄVEN
       unzip(1), tar(1)`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'rqj0123456789', long: { 'recurse-paths': 'r', quiet: 'q', 'junk-paths': 'j' } });
    if (o.error) {
      const m = /-- '(.)'/.exec(o.error);
      ctx.err(`zip error: Invalid command arguments (${m ? `short option '${m[1]}' not supported` : o.error})\n`);
      return 16;
    }
    if (!o.operands.length) {
      ctx.out(
        'Usage: zip [-options] zipfile list\n' +
          '  The default action is to add or replace zipfile entries from list.\n' +
          '  -r   recurse into directories     -q   quiet operation\n' +
          "  -j   junk (don't record) directory names\n",
      );
      return 0;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    let archive = o.operands[0];
    if (!basename(archive).includes('.')) archive += '.zip';
    const archivePath = sh.resolve(archive);
    const files = o.operands.slice(1);
    if (!files.length) {
      ctx.err(`\nzip error: Nothing to do! (${archive})\n`);
      return 12;
    }
    let entries: ArchiveEntry[] = [];
    const existing = sh.vfs.tryLookup(archivePath, user);
    if (existing) {
      let content: string;
      try {
        content = sh.vfs.readFile(archivePath, user);
      } catch (e) {
        ctx.err(`zip I/O error: ${fsMessage(e)}\n\nzip error: Could not open input file (${archive})\n`);
        return 15;
      }
      const old = content === '' ? [] : readZip(content);
      if (!old) {
        ctx.err(`\nzip error: Zip file structure invalid (${archive})\n`);
        return 3;
      }
      entries = old;
    }
    let added = 0;
    for (const op of files) {
      const abs = sh.resolve(op);
      let node: FsNode;
      try {
        node = sh.vfs.lookup(abs, user);
      } catch {
        ctx.err(`\tzip warning: name not matched: ${op}\n`);
        continue;
      }
      // zip sparar alltid relativa sökvägar: inledande / och ./ tas bort.
      const name = op.replace(/\/+$/, '').replace(/^\/+/, '').replace(/^(\.\/)+/, '');
      walkTree(user, node, abs, name === '.' ? '' : name, o.flags.has('r'), {
        add: (e) => {
          if (o.flags.has('j')) {
            if (e.type === 'dir') return;
            e.path = basename(e.path);
          }
          const idx = entries.findIndex((x) => x.path === e.path);
          if (idx >= 0) entries[idx] = e;
          else entries.push(e);
          added++;
          if (!o.flags.has('q')) ctx.out(`  ${idx >= 0 ? 'updating' : 'adding'}: ${entryLabel(e)} (${zipMethod(e)})\n`);
        },
        error: (n) => ctx.err(`\tzip warning: could not open for reading: ${n}\n`),
        skip: (a) => a === archivePath,
      });
    }
    if (!added && !existing) {
      ctx.err(`\nzip error: Nothing to do! (${archive})\n`);
      return 12;
    }
    try {
      sh.vfs.writeFile(archivePath, makeZip(entries), user);
    } catch (e) {
      ctx.err(`zip I/O error: ${fsMessage(e)}\n\nzip error: Could not create output file (${archive})\n`);
      return 15;
    }
    return 0;
  },
};

const unzip: CommandDef = {
  name: 'unzip',
  summary: 'Packar upp .zip-filer',
  man: `NAMN
       unzip - lista och packa upp filer från ett zip-arkiv

SYNOPSIS
       unzip [-l] [-o] [-n] [-q] ARKIV.zip [FIL...] [-d KATALOG]

BESKRIVNING
       Packar upp alla filer (eller bara de angivna) i aktuell katalog.
       Rättigheterna följer med, men filerna ägs av dig.

       Filer som redan finns hoppas över. Använd -o för att skriva över dem.

FLAGGOR
       -l            lista innehållet, packa inte upp
       -d KATALOG    packa upp i KATALOG (skapas om den saknas)
       -o            skriv över befintliga filer utan att fråga
       -n            skriv aldrig över befintliga filer
       -q            tyst – skriv inte ut något

EXEMPEL
       unzip -l dokument.zip
       unzip dokument.zip -d uppackat`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'lonq', values: 'd' });
    if (o.error) {
      ctx.err(`unzip: ${o.error}\n`);
      return 10;
    }
    if (!o.operands.length) {
      ctx.out(
        'UnZip 6.00 of 20 April 2009. Original by Info-ZIP.\n\n' +
          'Usage: unzip [-opts] file[.zip] [list] [-d exdir]\n' +
          '  -l  list files (short format)     -d  extract files into exdir\n' +
          '  -o  overwrite files WITHOUT prompting\n' +
          '  -n  never overwrite existing files  -q  quiet mode\n',
      );
      return 0;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    const archive = o.operands[0];
    let content: string | null = null;
    for (const candidate of [archive, `${archive}.zip`]) {
      try {
        content = sh.vfs.readFile(sh.resolve(candidate), user);
        break;
      } catch {
        /* prova nästa namn */
      }
    }
    if (content === null) {
      ctx.err(`unzip:  cannot find or open ${archive}, ${archive}.zip or ${archive}.ZIP.\n`);
      return 9;
    }
    const entries = readZip(content);
    if (!entries) {
      ctx.out(`Archive:  ${archive}\n`);
      ctx.err(
        '  End-of-central-directory signature not found.  Either this file is not\n' +
          '  a zipfile, or it constitutes one disk of a multi-part archive.  In the\n' +
          '  latter case the central directory and zipfile comment will be found on\n' +
          '  the last disk(s) of this archive.\n' +
          `unzip:  cannot find zipfile directory in one of ${archive} or\n` +
          `        ${archive}.zip, and cannot find ${archive}.ZIP, period.\n`,
      );
      return 9;
    }
    const { selected, missing } = selectEntries(entries, o.operands.slice(1));
    const quiet = o.flags.has('q');
    let code = 0;

    if (o.flags.has('l')) {
      ctx.out(`Archive:  ${archive}\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n`);
      let total = 0;
      for (const e of selected) {
        total += entrySize(e);
        ctx.out(`${String(entrySize(e)).padStart(9)}  ${isoDate(e.mtime)}   ${entryLabel(e)}\n`);
      }
      const n = selected.length;
      ctx.out(`---------                     -------\n${String(total).padStart(9)}                     ${n} file${n === 1 ? '' : 's'}\n`);
    } else {
      let base = sh.cwd;
      let prefix = '';
      if (o.values.d !== undefined) {
        base = sh.resolve(o.values.d);
        prefix = o.values.d.replace(/\/+$/, '') + '/';
        try {
          let cur = '';
          for (const seg of base.split('/').filter(Boolean)) {
            cur += '/' + seg;
            const n = sh.vfs.tryLookup(cur, user);
            if (!n) sh.vfs.mkdir(cur, user);
            else if (n.type !== 'dir') throw new FsError('ENOTDIR');
          }
        } catch (e) {
          ctx.err(`checkdir:  cannot create extraction directory: ${o.values.d}\n           ${fsMessage(e)}\n`);
          return 3;
        }
      }
      if (!quiet) ctx.out(`Archive:  ${archive}\n`);
      const ok = extractEntries(ctx, selected, base, {
        keepOwner: false,
        umask: 0,
        before: (e, existing) => {
          const label = prefix + entryLabel(e);
          if (existing?.type === 'file' && !o.flags.has('o')) {
            if (!o.flags.has('n') && !quiet) ctx.out(`  skipping: ${label}  (already exists; use -o to overwrite)\n`);
            return false;
          }
          if (!quiet) {
            if (e.type === 'dir') {
              if (!existing) ctx.out(`   creating: ${label}\n`);
            } else {
              ctx.out(`${zipMethod(e).startsWith('stored') ? ' extracting' : '  inflating'}: ${label}\n`);
            }
          }
          return true;
        },
        error: (e, what, msg) => {
          ctx.err(`${what === 'dir' ? 'checkdir error' : 'error'}:  cannot create ${prefix}${e.path}\n        ${msg}\n`);
        },
      });
      if (!ok) code = 50;
    }
    for (const m of missing) ctx.err(`caution: filename not matched:  ${m}\n`);
    if (missing.length && !code) code = 11;
    return code;
  },
};

// ---------------------------------------------------------------- du

const du: CommandDef = {
  name: 'du',
  summary: 'Visar hur mycket diskutrymme filer och kataloger tar',
  man: `NAMN
       du - visa hur mycket diskutrymme filer och kataloger använder
            (disk usage)

SYNOPSIS
       du [FLAGGA]... [FIL]...

BESKRIVNING
       Visar storleken för varje katalog (och underkatalog) i kilobyte.
       Utan FIL visas aktuell katalog.

       Disken delas in i block om 4 KiB, så även en fil på 10 byte tar
       4.0K på disken. Den verkliga storleken visar du med --apparent-size
       eller med ls -l.

FLAGGOR
       -h, --human-readable   läsbara storlekar (4.0K, 12M, 1.5G)
       -s, --summarize        visa bara en summa per argument
       -a, --all              visa även filer, inte bara kataloger
       -c, --total            lägg till en rad med totalsumman
       -d, --max-depth=N      visa bara N nivåer ner
       -b, --bytes            verklig storlek i byte (--apparent-size)
           --apparent-size    verklig storlek i stället för diskutrymme

EXEMPEL
       du -sh dokument                 hur stor är katalogen?
       du -h -d 1 ~                    storleken på allt i hemkatalogen
       du -h dokument.tar dokument.tar.gz`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'hsacb',
      values: 'd',
      long: { 'human-readable': 'h', summarize: 's', all: 'a', total: 'c', bytes: 'b', 'apparent-size': 'A', 'max-depth': 'd' },
    });
    if (o.error) {
      ctx.err(`du: ${o.error}\nTry 'du --help' for more information.\n`);
      return 1;
    }
    const has = (f: string) => o.flags.has(f);
    if (has('s') && has('a')) {
      ctx.err("du: cannot both summarize and show all entries\nTry 'du --help' for more information.\n");
      return 1;
    }
    let maxDepth = Infinity;
    if (o.values.d !== undefined) {
      if (!/^\d+$/.test(o.values.d)) {
        ctx.err(`du: invalid maximum depth '${o.values.d}'\nTry 'du --help' for more information.\n`);
        return 1;
      }
      maxDepth = Number(o.values.d);
    }
    if (has('s')) maxDepth = 0;
    const apparent = has('b') || has('A');
    const sh = ctx.sh;
    const user = sh.currentUser();
    const usage = (n: FsNode) => (apparent ? nodeSize(n) : Math.ceil(nodeSize(n) / 4096) * 4096);
    const fmt = (bytes: number) => (has('h') ? humanSize(bytes) : has('b') ? String(bytes) : String(Math.ceil(bytes / 1024)));
    let code = 0;
    let total = 0;

    const walk = (label: string, node: FsNode, depth: number): number => {
      let size = usage(node);
      if (node.type === 'dir') {
        if (!hasPerm(node, user, 'r') || !hasPerm(node, user, 'x')) {
          ctx.err(`du: cannot read directory '${label}': Permission denied\n`);
          code = 1;
        } else {
          for (const child of Object.keys(node.children ?? {}).sort()) {
            size += walk(label.endsWith('/') ? label + child : `${label}/${child}`, node.children![child], depth + 1);
          }
        }
      }
      if (depth <= maxDepth && (node.type === 'dir' || has('a') || depth === 0)) ctx.out(`${fmt(size)}\t${label}\n`);
      return size;
    };

    for (const op of o.operands.length ? o.operands : ['.']) {
      try {
        total += walk(op, sh.vfs.lookup(sh.resolve(op), user), 0);
      } catch (e) {
        ctx.err(`du: cannot access '${op}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    if (has('c')) ctx.out(`${fmt(total)}\ttotal\n`);
    return code;
  },
};

export const ARCHIVE_COMMANDS: CommandDef[] = [tar, gzip, gunzip, zcat, zip, unzip, du];
