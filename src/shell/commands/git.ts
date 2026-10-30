// git – en liten men riktig versionshantering som arbetar mot det virtuella filsystemet.
//
// Repot sparas i .git/ som vanliga filer: objekt (blob, tree, commit, tag) under
// .git/objects/xx/…, grenar under .git/refs/heads/, HEAD, index, config och en
// enkel reflog i .git/logs/HEAD. Allt är text, så repot följer med när terminalen
// sparas som JSON. Objekten hashas med SHA-1 som i riktiga git – en blob får samma
// id som på en riktig dator. Träd sparas förenklat som en platt lista med sökvägar.

import type { Shell } from '../shell';
import type { CmdCtx, CommandDef } from '../types';
import { dirname, FsError, hasPerm, normalizePath, resolvePath, type FsNode, type User } from '../vfs';
import { aurClone } from './repos';
import { COLOR } from './util';

// ---------- SHA-1 ----------

const encoder = new TextEncoder();
const utf8len = (s: string) => encoder.encode(s).length;

export function sha1(text: string): string {
  const bytes = encoder.encode(text);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 4, (len * 8) >>> 0);
  view.setUint32(total - 8, Math.floor((len * 8) / 2 ** 32));
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let [a, b, c, d, e] = h;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** Samma id som `git hash-object` ger för en fil med innehållet `data`. */
export const blobHash = (data: string) => sha1(`blob ${utf8len(data)}\0${data}`);

const ZERO = '0'.repeat(40);
const short = (h: string) => h.slice(0, 7);

// ---------- Fel och utskrifter ----------

/** Avbryter git-kommandot med en text på stderr och en slutstatus. */
class GitExit extends Error {
  constructor(
    public text: string,
    public code: number,
  ) {
    super(text);
  }
}

const fatal = (msg: string): never => {
  throw new GitExit(`fatal: ${msg}\n`, 128);
};
const fail = (text: string, code = 1): never => {
  throw new GitExit(text.endsWith('\n') || text === '' ? text : text + '\n', code);
};

const C = {
  reset: '\x1b[m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  boldRed: '\x1b[1;31m',
  boldGreen: '\x1b[1;32m',
  boldYellow: '\x1b[1;33m',
  boldCyan: '\x1b[1;36m',
  blue: '\x1b[34m',
};

interface G {
  ctx: CmdCtx;
  sh: Shell;
  user: User;
  cwd: string;
  tty: boolean;
  out(s: string): void;
  err(s: string): void;
  /** Färgar texten om utdata går till terminalen. */
  c(color: string, s: string): string;
  note(sv: string, en: string): void;
  hint(text: string): void;
}

function makeG(ctx: CmdCtx): G {
  const tty = ctx.isTTY;
  return {
    ctx,
    sh: ctx.sh,
    user: ctx.sh.currentUser(),
    cwd: ctx.sh.cwd,
    tty,
    out: (s) => ctx.out(s),
    err: (s) => ctx.err(s),
    c: (color, s) => (tty && s ? `${color}${s}${C.reset}` : s),
    note: (sv, en) => ctx.err(`${COLOR.dim}${ctx.sh.msg({ sv, en })}${COLOR.reset}\n`),
    hint: (text) =>
      ctx.err(
        text
          .split('\n')
          .map((l) => (tty ? `${C.yellow}hint:${l ? ' ' + l : ''}${C.reset}` : `hint:${l ? ' ' + l : ''}`))
          .join('\n') + '\n',
      ),
  };
}

// ---------- Filsystemet ----------

const join = (a: string, b: string) => (b === '' ? a : a === '/' ? `/${b}` : `${a}/${b}`);

function readText(g: G, path: string): string | null {
  try {
    const node = g.sh.vfs.lookup(path, g.user);
    if (node.type !== 'file') return null;
    return g.sh.vfs.readFile(path, g.user);
  } catch (e) {
    if (e instanceof FsError && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return null;
    throw e;
  }
}

function mkdirp(g: G, path: string): void {
  let cur = '';
  for (const seg of normalizePath(path).split('/').filter(Boolean)) {
    cur += '/' + seg;
    const node = g.sh.vfs.tryLookup(cur, g.user);
    if (!node) g.sh.vfs.mkdir(cur, g.user);
    else if (node.type !== 'dir') throw new FsError('ENOTDIR');
  }
}

function writeText(g: G, path: string, content: string): void {
  mkdirp(g, dirname(path));
  g.sh.vfs.writeFile(path, content, g.user);
}

function removeFile(g: G, path: string): void {
  if (g.sh.vfs.tryLookup(path, g.user)) g.sh.vfs.remove(path, g.user);
}

/** Tar bort tomma kataloger uppåt från `dir` (men aldrig `stop`). */
function pruneDirs(g: G, dir: string, stop: string): void {
  while (dir !== stop && dir.startsWith(stop + '/')) {
    const node = g.sh.vfs.tryLookup(dir, g.user);
    if (!node || node.type !== 'dir' || Object.keys(node.children ?? {}).length) return;
    g.sh.vfs.remove(dir, g.user);
    dir = dirname(dir);
  }
}

const isDirAt = (g: G, p: string) => g.sh.vfs.tryLookup(p, g.user)?.type === 'dir';
const existsAt = (g: G, p: string) => g.sh.vfs.tryLookup(p, g.user) !== null;

/** Sökväg från katalogen `from` till `to` (båda absoluta). */
function relPath(from: string, to: string): string {
  const a = from.split('/').filter(Boolean);
  const b = to.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const parts = [...a.slice(i).map(() => '..'), ...b.slice(i)];
  return parts.join('/') || '.';
}

// ---------- Repot ----------

interface Repo {
  g: G;
  gitDir: string;
  /** Arbetskatalogen, eller null för ett "bare" repo (bara historiken, som på en server). */
  root: string | null;
  /** Innehåll för blobbar som bara finns i arbetskatalogen (inte sparade som objekt). */
  blobs: Map<string, string>;
}

function looksLikeGitDir(g: G, dir: string): boolean {
  return readText(g, `${dir}/HEAD`) !== null && isDirAt(g, `${dir}/objects`) && isDirAt(g, `${dir}/refs`);
}

function openRepo(g: G, gitDir: string, root: string | null): Repo {
  return { g, gitDir, root, blobs: new Map() };
}

function discover(g: G, start: string): Repo | null {
  let dir = normalizePath(start);
  for (;;) {
    if (isDirAt(g, join(dir, '.git')) && looksLikeGitDir(g, join(dir, '.git'))) return openRepo(g, join(dir, '.git'), dir);
    if (looksLikeGitDir(g, dir)) return openRepo(g, dir, null);
    if (dir === '/') return null;
    dir = dirname(dir);
  }
}

function needRepo(g: G): Repo {
  return discover(g, g.cwd) ?? fatal('not a git repository (or any of the parent directories): .git');
}

function needWork(r: Repo): string {
  return r.root ?? fatal('this operation must be run in a work tree');
}

const gpath = (r: Repo, rel: string) => `${r.gitDir}/${rel}`;

// ---------- Objekt ----------

type ObjType = 'blob' | 'tree' | 'commit' | 'tag';

function objPath(r: Repo, h: string) {
  return gpath(r, `objects/${h.slice(0, 2)}/${h.slice(2)}`);
}

function writeObj(r: Repo, type: ObjType, data: string): string {
  const raw = `${type} ${utf8len(data)}\0${data}`;
  const h = sha1(raw);
  const p = objPath(r, h);
  if (!existsAt(r.g, p)) writeText(r.g, p, raw);
  return h;
}

function readObj(r: Repo, h: string): { type: ObjType; data: string } | null {
  if (r.blobs.has(h)) return { type: 'blob', data: r.blobs.get(h)! };
  const raw = readText(r.g, objPath(r, h));
  if (raw === null) return null;
  const nul = raw.indexOf('\0');
  return { type: raw.slice(0, nul).split(' ')[0] as ObjType, data: raw.slice(nul + 1) };
}

function readBlob(r: Repo, h: string): string {
  const o = readObj(r, h);
  if (!o) return fatal(`unable to read ${h}`);
  return o.data;
}

/** Alla objekt-id i repot. */
function allObjects(r: Repo): string[] {
  const dir = r.g.sh.vfs.tryLookup(gpath(r, 'objects'), r.g.user);
  const ids: string[] = [];
  for (const [pre, node] of Object.entries(dir?.children ?? {})) {
    if (!/^[0-9a-f]{2}$/.test(pre) || node.type !== 'dir') continue;
    for (const rest of Object.keys(node.children ?? {})) ids.push(pre + rest);
  }
  return ids;
}

/** Sökväg → blob-id. Riktiga git har ett träd per katalog; här räcker en platt lista. */
type Tree = Record<string, string>;

function writeTree(r: Repo, t: Tree): string {
  const data = Object.keys(t)
    .sort()
    .map((p) => `100644 blob ${t[p]}\t${p}\n`)
    .join('');
  return writeObj(r, 'tree', data);
}

function readTree(r: Repo, h: string): Tree {
  const o = readObj(r, h);
  if (!o || o.type !== 'tree') return fatal(`not a tree object: ${h}`);
  const t: Tree = {};
  for (const line of o.data.split('\n')) {
    const m = /^\d+ blob ([0-9a-f]{40})\t(.*)$/.exec(line);
    if (m) t[m[2]] = m[1];
  }
  return t;
}

interface Ident {
  name: string;
  email: string;
  time: number;
  tz: string;
}

interface Commit {
  hash: string;
  tree: string;
  parents: string[];
  author: Ident;
  committer: Ident;
  message: string;
}

const fmtIdent = (i: Ident) => `${i.name} <${i.email}> ${i.time} ${i.tz}`;

function parseIdent(s: string): Ident {
  const m = /^(.*) <(.*)> (\d+) ([+-]\d{4})$/.exec(s);
  if (!m) return { name: s, email: '', time: 0, tz: '+0000' };
  return { name: m[1], email: m[2], time: Number(m[3]), tz: m[4] };
}

function writeCommit(r: Repo, c: Omit<Commit, 'hash'>): string {
  let data = `tree ${c.tree}\n`;
  for (const p of c.parents) data += `parent ${p}\n`;
  data += `author ${fmtIdent(c.author)}\ncommitter ${fmtIdent(c.committer)}\n\n${c.message}`;
  return writeObj(r, 'commit', data);
}

const commitCache = new WeakMap<Repo, Map<string, Commit>>();

function readCommit(r: Repo, h: string): Commit {
  let cache = commitCache.get(r);
  if (!cache) commitCache.set(r, (cache = new Map()));
  const hit = cache.get(h);
  if (hit) return hit;
  const o = readObj(r, h);
  if (!o || o.type !== 'commit') return fatal(`bad object ${h}`);
  const end = o.data.indexOf('\n\n');
  const head = end < 0 ? o.data : o.data.slice(0, end);
  const c: Commit = { hash: h, tree: '', parents: [], author: parseIdent(''), committer: parseIdent(''), message: end < 0 ? '' : o.data.slice(end + 2) };
  for (const line of head.split('\n')) {
    const sp = line.indexOf(' ');
    const key = line.slice(0, sp);
    const val = line.slice(sp + 1);
    if (key === 'tree') c.tree = val;
    else if (key === 'parent') c.parents.push(val);
    else if (key === 'author') c.author = parseIdent(val);
    else if (key === 'committer') c.committer = parseIdent(val);
  }
  cache.set(h, c);
  return c;
}

const commitTree = (r: Repo, h: string | undefined): Tree => (h ? readTree(r, readCommit(r, h).tree) : {});
const subject = (c: Commit) => c.message.split('\n')[0];

/** Följer annoterade taggar till det objekt de pekar på. */
function peel(r: Repo, h: string): string {
  for (let i = 0; i < 10; i++) {
    const o = readObj(r, h);
    if (!o || o.type !== 'tag') return h;
    h = /^object ([0-9a-f]{40})/.exec(o.data)?.[1] ?? h;
  }
  return h;
}

// ---------- Referenser ----------

function readRef(r: Repo, name: string, depth = 0): string | undefined {
  const text = readText(r.g, gpath(r, name));
  if (text === null) return undefined;
  const t = text.trim();
  if (t.startsWith('ref: ')) return depth > 5 ? undefined : readRef(r, t.slice(5), depth + 1);
  return /^[0-9a-f]{40}$/.test(t) ? t : undefined;
}

function writeRef(r: Repo, name: string, h: string): void {
  writeText(r.g, gpath(r, name), h + '\n');
}

function deleteRef(r: Repo, name: string): void {
  removeFile(r.g, gpath(r, name));
  pruneDirs(r.g, dirname(gpath(r, name)), gpath(r, 'refs'));
}

/** Namnen på alla referenser under t.ex. "refs/heads/" (utan prefixet), sorterade. */
function listRefs(r: Repo, prefix: string): string[] {
  const names: string[] = [];
  const walk = (node: FsNode, rel: string) => {
    for (const [name, child] of Object.entries(node.children ?? {})) {
      const p = rel ? `${rel}/${name}` : name;
      if (child.type === 'dir') walk(child, p);
      else names.push(p);
    }
  };
  const dir = r.g.sh.vfs.tryLookup(gpath(r, prefix.replace(/\/$/, '')), r.g.user);
  if (dir?.type === 'dir') walk(dir, '');
  return names.sort();
}

interface Head {
  /** Grenen HEAD pekar på, eller null om HEAD är frikopplat (detached). */
  branch: string | null;
  /** Commit som HEAD pekar på (saknas i ett tomt repo). */
  hash: string | undefined;
}

function readHead(r: Repo): Head {
  const text = (readText(r.g, gpath(r, 'HEAD')) ?? '').trim();
  if (text.startsWith('ref: refs/heads/')) {
    const branch = text.slice('ref: refs/heads/'.length);
    return { branch, hash: readRef(r, `refs/heads/${branch}`) };
  }
  return { branch: null, hash: /^[0-9a-f]{40}$/.test(text) ? text : undefined };
}

function setHeadBranch(r: Repo, branch: string): void {
  writeText(r.g, gpath(r, 'HEAD'), `ref: refs/heads/${branch}\n`);
}

function setHeadDetached(r: Repo, h: string): void {
  writeText(r.g, gpath(r, 'HEAD'), h + '\n');
}

/** Flyttar grenen som HEAD pekar på (eller HEAD själv om den är frikopplad). */
function moveHead(r: Repo, h: string, reflogMsg: string): void {
  const head = readHead(r);
  if (head.branch) writeRef(r, `refs/heads/${head.branch}`, h);
  else setHeadDetached(r, h);
  reflog(r, head.hash, h, reflogMsg);
}

function reflog(r: Repo, from: string | undefined, to: string, msg: string): void {
  const id = identity(r.g, r, false) ?? { name: r.g.user.name, email: `${r.g.user.name}@${r.g.sh.distro.hostname}`, time: now(), tz: tzNow() };
  const path = gpath(r, 'logs/HEAD');
  const old = readText(r.g, path) ?? '';
  writeText(r.g, path, old + `${from ?? ZERO} ${to} ${fmtIdent(id)}\t${msg}\n`);
}

function readReflog(r: Repo): { to: string; msg: string }[] {
  return (readText(r.g, gpath(r, 'logs/HEAD')) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => ({ to: l.split(' ')[1], msg: l.slice(l.indexOf('\t') + 1) }));
}

/** Grenen man stod på innan senaste bytet (för `git switch -`). */
function previousBranch(r: Repo): string | null {
  const log = readReflog(r);
  for (let i = log.length - 1; i >= 0; i--) {
    const m = /^checkout: moving from (\S+) to /.exec(log[i].msg);
    if (m) return m[1];
  }
  return null;
}

function validBranchName(name: string): boolean {
  return (
    !!name &&
    !name.startsWith('-') &&
    !name.startsWith('/') &&
    !name.endsWith('/') &&
    !name.endsWith('.') &&
    !name.endsWith('.lock') &&
    name !== 'HEAD' &&
    name !== '@' &&
    !/\.\.|@\{|\/\/|\/\.|^\.|[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)
  );
}

function checkBranchName(g: G, name: string): void {
  if (validBranchName(name)) return;
  g.err(`fatal: '${name}' is not a valid branch name\n`);
  g.hint("See `man git check-ref-format`\nDisable this message with \"git config set advice.refSyntax false\"");
  throw new GitExit('', 128);
}

const branchExists = (r: Repo, b: string) => readRef(r, `refs/heads/${b}`) !== undefined;

// ---------- Revisioner ----------

/** Slår upp t.ex. HEAD, main, origin/main, v1.0, a1b2c3d, HEAD~2 och main^2. Returnerar objekt-id. */
function resolveRev(r: Repo, rev: string): string | null {
  const m = /^(.*?)((?:[~^]\d*)*)$/.exec(rev);
  if (!m) return null;
  let base = m[1];
  const suffix = m[2];
  if (base === '' || base === '@') base = 'HEAD';
  let h: string | undefined;
  if (/^(HEAD|ORIG_HEAD|MERGE_HEAD|FETCH_HEAD)$/.test(base)) {
    h = base === 'HEAD' ? readHead(r).hash : readText(r.g, gpath(r, base))?.trim().split(/\s/)[0];
  } else if (base === '@{-1}' || base === '-') {
    const prev = previousBranch(r);
    h = prev ? (readRef(r, `refs/heads/${prev}`) ?? (/^[0-9a-f]{40}$/.test(prev) ? prev : undefined)) : undefined;
  } else {
    const refs = base.startsWith('refs/') ? [base] : [`refs/${base}`, `refs/tags/${base}`, `refs/heads/${base}`, `refs/remotes/${base}`, `refs/remotes/${base}/HEAD`];
    for (const ref of refs) {
      h = readRef(r, ref);
      if (h) break;
    }
    if (!h && /^[0-9a-f]{4,40}$/.test(base)) {
      const hits = allObjects(r).filter((id) => id.startsWith(base));
      if (hits.length === 1) h = hits[0];
      else if (hits.length > 1) fatal(`short object ID ${base} is ambiguous`);
    }
  }
  if (!h || !/^[0-9a-f]{40}$/.test(h)) return null;
  for (const op of suffix.match(/[~^]\d*/g) ?? []) {
    const n = op.length > 1 ? Number(op.slice(1)) : 1;
    let c = readCommit(r, peel(r, h));
    if (op[0] === '~') {
      for (let i = 0; i < n; i++) {
        if (!c.parents[0]) return null;
        c = readCommit(r, c.parents[0]);
      }
      h = c.hash;
    } else {
      if (n === 0) {
        h = c.hash;
        continue;
      }
      const p = c.parents[n - 1];
      if (!p) return null;
      h = p;
    }
  }
  return h;
}

function resolveCommit(r: Repo, rev: string): string | null {
  const h = resolveRev(r, rev);
  if (!h) return null;
  const p = peel(r, h);
  return readObj(r, p)?.type === 'commit' ? p : null;
}

function needCommit(r: Repo, rev: string): string {
  return resolveCommit(r, rev) ?? fatal(`not a valid object name: '${rev}'`);
}

/** Ett träd från t.ex. "HEAD", en commit eller ett träd-id. */
function revTree(r: Repo, rev: string): Tree | null {
  const h = resolveRev(r, rev);
  if (!h) return null;
  const p = peel(r, h);
  const o = readObj(r, p);
  if (o?.type === 'commit') return readTree(r, readCommit(r, p).tree);
  if (o?.type === 'tree') return readTree(r, p);
  return null;
}

function ancestors(r: Repo, h: string | undefined): Set<string> {
  const seen = new Set<string>();
  const stack = h ? [h] : [];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...readCommit(r, x).parents);
  }
  return seen;
}

const isAncestor = (r: Repo, a: string, b: string) => ancestors(r, b).has(a);

function mergeBase(r: Repo, a: string, b: string): string | null {
  const A = ancestors(r, a);
  const common = [...ancestors(r, b)].filter((x) => A.has(x));
  const best = common.filter((x) => !common.some((y) => y !== x && isAncestor(r, x, y)));
  best.sort((x, y) => readCommit(r, y).committer.time - readCommit(r, x).committer.time);
  return best[0] ?? null;
}

// ---------- Index ----------

interface Unmerged {
  base?: string;
  ours?: string;
  theirs?: string;
}

interface Index {
  entries: Tree;
  /** Filer med konflikt efter en merge, med de tre versionerna. */
  unmerged: Record<string, Unmerged>;
}

function readIndex(r: Repo): Index {
  const text = readText(r.g, gpath(r, 'index'));
  if (!text) return { entries: {}, unmerged: {} };
  try {
    const j = JSON.parse(text) as Partial<Index>;
    return { entries: j.entries ?? {}, unmerged: j.unmerged ?? {} };
  } catch {
    return fatal('index file corrupt');
  }
}

function writeIndex(r: Repo, idx: Index): void {
  const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  writeText(r.g, gpath(r, 'index'), JSON.stringify({ version: 1, entries: sorted(idx.entries), unmerged: sorted(idx.unmerged) }, null, 1) + '\n');
}

// ---------- Konfiguration ----------

interface ConfigEntry {
  key: string;
  value: string;
}

function parseConfig(text: string): ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const head = /^\[\s*([A-Za-z0-9.-]+)(?:\s+"((?:[^"\\]|\\.)*)")?\s*\]/.exec(line);
    if (head) {
      section = head[1].toLowerCase() + (head[2] !== undefined ? '.' + head[2].replace(/\\(.)/g, '$1') : '');
      continue;
    }
    const kv = /^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*(.*))?$/.exec(line);
    if (!kv || !section) continue;
    entries.push({ key: `${section}.${kv[1].toLowerCase()}`, value: kv[2] === undefined ? 'true' : unquote(kv[2]) });
  }
  return entries;
}

function unquote(v: string): string {
  let out = '';
  let q = false;
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch === '"') q = !q;
    else if (ch === '\\' && i + 1 < v.length) {
      const n = v[++i];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
    } else if (!q && (ch === '#' || ch === ';')) break;
    else out += ch;
  }
  return q ? out : out.trim();
}

function quoteValue(v: string): string {
  const esc = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  return /^\s|\s$|[#;"\\\n\t]/.test(v) ? `"${esc}"` : esc;
}

interface KeyParts {
  section: string;
  sub?: string;
  name: string;
}

function splitKey(key: string): KeyParts | null {
  const first = key.indexOf('.');
  const last = key.lastIndexOf('.');
  if (first < 0) return null;
  const name = key.slice(last + 1);
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) return null;
  return { section: key.slice(0, first).toLowerCase(), sub: first === last ? undefined : key.slice(first + 1, last), name };
}

const normKey = (k: KeyParts) => `${k.section}${k.sub !== undefined ? '.' + k.sub : ''}.${k.name.toLowerCase()}`;

/** Sätter (eller tar bort, med value null) en nyckel i konfigurationstexten. */
function setConfigText(text: string, key: KeyParts, value: string | null): string {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  let inSection = false;
  let sectionEnd = -1;
  let keyLine = -1;
  const toRemove: number[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const head = /^\[\s*([A-Za-z0-9.-]+)(?:\s+"((?:[^"\\]|\\.)*)")?\s*\]/.exec(line);
    if (head) {
      const sub = head[2] !== undefined ? head[2].replace(/\\(.)/g, '$1') : undefined;
      inSection = head[1].toLowerCase() === key.section && sub === key.sub;
      if (inSection) sectionEnd = i + 1;
      return;
    }
    if (!inSection) return;
    sectionEnd = i + 1;
    const kv = /^([A-Za-z][A-Za-z0-9-]*)\s*(=|$)/.exec(line);
    if (kv && kv[1].toLowerCase() === key.name.toLowerCase()) {
      keyLine = i;
      toRemove.push(i);
    }
  });
  if (value === null) {
    return lines.filter((_, i) => !toRemove.includes(i)).map((l) => l + '\n').join('');
  }
  const formatted = `\t${key.name} = ${quoteValue(value)}`;
  if (keyLine >= 0) lines[keyLine] = formatted;
  else if (sectionEnd >= 0) lines.splice(sectionEnd, 0, formatted);
  else lines.push(key.sub !== undefined ? `[${key.section} "${key.sub.replace(/(["\\])/g, '\\$1')}"]` : `[${key.section}]`, formatted);
  return lines.map((l) => l + '\n').join('');
}

const globalConfigPath = (g: G) => `${g.sh.home}/.gitconfig`;

/** Alla konfigurationsfiler som gäller, i ordning (senare vinner). */
function configFiles(g: G, r: Repo | null): { scope: string; path: string }[] {
  const files = [
    { scope: 'system', path: '/etc/gitconfig' },
    { scope: 'global', path: globalConfigPath(g) },
  ];
  if (r) files.push({ scope: 'local', path: gpath(r, 'config') });
  return files;
}

function configAll(g: G, r: Repo | null): (ConfigEntry & { scope: string; path: string })[] {
  return configFiles(g, r).flatMap((f) => parseConfig(readText(g, f.path) ?? '').map((e) => ({ ...e, ...f })));
}

function getConfig(g: G, r: Repo | null, key: string): string | undefined {
  const k = splitKey(key);
  if (!k) return undefined;
  const nk = normKey(k);
  return configAll(g, r)
    .filter((e) => e.key === nk)
    .at(-1)?.value;
}

const configBool = (v: string | undefined, def: boolean) => (v === undefined ? def : /^(true|yes|on|1)$/i.test(v));

function setConfig(g: G, path: string, key: string, value: string | null): void {
  const k = splitKey(key);
  if (!k) fail(`error: key does not contain a section: ${key}`, 2);
  const text = readText(g, path) ?? '';
  writeText(g, path, setConfigText(text, k!, value));
}

// ---------- Identitet och tid ----------

const now = () => Math.floor(Date.now() / 1000);

function tzNow(): string {
  const off = -new Date().getTimezoneOffset();
  const a = Math.abs(off);
  return `${off < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}${String(a % 60).padStart(2, '0')}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(i: Ident): string {
  const sign = i.tz[0] === '-' ? -1 : 1;
  const off = sign * (Number(i.tz.slice(1, 3)) * 60 + Number(i.tz.slice(3, 5)));
  const d = new Date((i.time + off * 60) * 1000);
  const t = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${t} ${d.getUTCFullYear()} ${i.tz}`;
}

/** Namnet ur /etc/passwd (GECOS), som riktiga git använder om user.name saknas. */
function gecosName(g: G): string {
  const passwd = g.sh.vfs.tryLookup('/etc/passwd', g.sh.rootUser())?.content ?? '';
  const line = passwd.split('\n').find((l) => l.startsWith(g.user.name + ':'));
  return line?.split(':')[4]?.split(',')[0] || g.user.name;
}

function identity(g: G, r: Repo | null, strict = true): Ident | null {
  const email = getConfig(g, r, 'user.email') ?? g.sh.env.EMAIL;
  const name = getConfig(g, r, 'user.name') || gecosName(g);
  if (!email) {
    if (!strict) return null;
    fail(
      `Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account's default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got '${g.user.name}@${g.sh.distro.hostname}.(none)')`,
      128,
    );
  }
  return { name, email: email!, time: now(), tz: tzNow() };
}

// ---------- Arbetskatalogen och .gitignore ----------

interface IgnoreRule {
  base: string;
  re: RegExp;
  neg: boolean;
  dirOnly: boolean;
  anchored: boolean;
}

function globToRegex(glob: string, slashStar: boolean): string {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += slashStar ? '.*' : '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else if (ch === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end < 0) re += '\\[';
      else {
        let cls = glob.slice(i + 1, end);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        re += `[${cls.replace(/\\/g, '\\\\')}]`;
        i = end;
      }
    } else if (ch === '\\' && i + 1 < glob.length) re += '\\' + glob[++i];
    else re += ch.replace(/[.+^${}()|\]\\/]/g, '\\$&');
  }
  return re;
}

function parseIgnore(text: string, base: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (let line of text.split('\n')) {
    line = line.replace(/(?<!\\)\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    let neg = false;
    if (line.startsWith('!')) {
      neg = true;
      line = line.slice(1);
    } else if (line.startsWith('\\!') || line.startsWith('\\#')) line = line.slice(1);
    let dirOnly = false;
    if (line.endsWith('/')) {
      dirOnly = true;
      line = line.replace(/\/+$/, '');
    }
    if (!line) continue;
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ base, re: new RegExp(`^${globToRegex(line, false)}$`), neg, dirOnly, anchored });
  }
  return rules;
}

class Ignores {
  constructor(private rules: IgnoreRule[]) {}

  private match(path: string, isDir: boolean): boolean {
    let result = false;
    for (const rule of this.rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.base && !path.startsWith(rule.base + '/')) continue;
      const rel = rule.base ? path.slice(rule.base.length + 1) : path;
      const subject = rule.anchored ? rel : rel.slice(rel.lastIndexOf('/') + 1);
      if (rule.re.test(subject)) result = !rule.neg;
    }
    return result;
  }

  ignored(path: string, isDir = false): boolean {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) if (this.match(parts.slice(0, i).join('/'), true)) return true;
    return this.match(path, isDir);
  }
}

interface WorkFile {
  content: string;
  ignored: boolean;
  hash: string;
}

interface Work {
  files: Map<string, WorkFile>;
  ignores: Ignores;
}

/** Läser alla filer i arbetskatalogen (utom .git) och reglerna i .gitignore. */
function scanWork(r: Repo): Work {
  const root = needWork(r);
  const g = r.g;
  const found: [string, string][] = [];
  const ignoreFiles: [string, string][] = [];
  const walk = (node: FsNode, rel: string) => {
    if (!hasPerm(node, g.user, 'r') || !hasPerm(node, g.user, 'x')) return;
    for (const name of Object.keys(node.children ?? {}).sort()) {
      if (name === '.git') continue;
      const child = node.children![name];
      const p = rel ? `${rel}/${name}` : name;
      if (child.type === 'dir') walk(child, p);
      else if (hasPerm(child, g.user, 'r')) {
        found.push([p, child.content ?? '']);
        if (name === '.gitignore') ignoreFiles.push([rel, child.content ?? '']);
      }
    }
  };
  walk(g.sh.vfs.lookup(root, g.user), '');
  ignoreFiles.sort((a, b) => (a[0] ? a[0].split('/').length : 0) - (b[0] ? b[0].split('/').length : 0));
  const rules = [...parseIgnore(readText(g, gpath(r, 'info/exclude')) ?? '', ''), ...ignoreFiles.flatMap(([base, text]) => parseIgnore(text, base))];
  const ignores = new Ignores(rules);
  const files = new Map<string, WorkFile>();
  for (const [p, content] of found) {
    const hash = blobHash(content);
    r.blobs.set(hash, content);
    files.set(p, { content, hash, ignored: ignores.ignored(p) });
  }
  return { files, ignores };
}

function writeWorkFile(r: Repo, path: string, content: string): void {
  const abs = join(needWork(r), path);
  const node = r.g.sh.vfs.tryLookup(abs, r.g.user);
  if (node?.type === 'dir') throw new FsError('EISDIR');
  writeText(r.g, abs, content);
}

function removeWorkFile(r: Repo, path: string): void {
  const root = needWork(r);
  const abs = join(root, path);
  removeFile(r.g, abs);
  pruneDirs(r.g, dirname(abs), root);
}

// ---------- Sökvägar (pathspec) ----------

interface Spec {
  raw: string;
  rel: string;
  glob: RegExp | null;
}

function toSpec(r: Repo, raw: string): Spec {
  const root = needWork(r);
  const abs = resolvePath(r.g.cwd, raw === '' ? '.' : raw);
  let rel: string;
  if (abs === root) rel = '';
  else if (abs.startsWith(root + '/')) rel = abs.slice(root.length + 1);
  else return fatal(`${raw}: '${raw}' is outside repository at '${root}'`);
  const glob = /[*?[]/.test(rel) ? new RegExp(`^${globToRegex(rel, true)}(/.*)?$`) : null;
  return { raw, rel, glob };
}

const specMatch = (s: Spec, path: string) => s.rel === '' || path === s.rel || path.startsWith(s.rel + '/') || !!s.glob?.test(path);

/** Hur sökvägen i repot ska visas, relativt den aktuella katalogen. */
function show(r: Repo, path: string): string {
  const root = needWork(r);
  const dir = path.endsWith('/');
  const p = relPath(r.g.cwd, join(root, path.replace(/\/$/, '')));
  return dir ? p + '/' : p;
}

// ---------- Diff ----------

type Op = { t: ' ' | '-' | '+'; s: string };

const NOEOL = '\u0000';

function diffLinesOf(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  else lines[lines.length - 1] += NOEOL;
  return lines;
}

/** Radvis diff (längsta gemensamma delsekvens). */
function diffOps(a: string[], b: string[]): Op[] {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf);
  const B = b.slice(pre, b.length - suf);
  const mid: Op[] = [];
  const n = A.length;
  const m = B.length;
  if (n * m > 4_000_000) {
    for (const s of A) mid.push({ t: '-', s });
    for (const s of B) mid.push({ t: '+', s });
  } else {
    const dp = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i * (m + 1) + j] = A[i] === B[j] ? dp[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) {
        mid.push({ t: ' ', s: A[i] });
        i++;
        j++;
      } else if (j < m && (i === n || dp[i * (m + 1) + j + 1] >= dp[(i + 1) * (m + 1) + j])) {
        if (i < n && dp[i * (m + 1) + j + 1] === dp[(i + 1) * (m + 1) + j]) {
          mid.push({ t: '-', s: A[i++] });
        } else mid.push({ t: '+', s: B[j++] });
      } else mid.push({ t: '-', s: A[i++] });
    }
  }
  return [...a.slice(0, pre).map((s): Op => ({ t: ' ', s })), ...mid, ...b.slice(b.length - suf).map((s): Op => ({ t: ' ', s }))];
}

function countChanges(oldText: string, newText: string): { ins: number; del: number } {
  let ins = 0;
  let del = 0;
  for (const op of diffOps(diffLinesOf(oldText), diffLinesOf(newText))) {
    if (op.t === '+') ins++;
    else if (op.t === '-') del++;
  }
  return { ins, del };
}

function hunkLines(g: G, oldText: string, newText: string, context = 3): string[] {
  const ops = diffOps(diffLinesOf(oldText), diffLinesOf(newText));
  const aPos: number[] = [];
  const bPos: number[] = [];
  let a = 0;
  let b = 0;
  for (const op of ops) {
    aPos.push(a);
    bPos.push(b);
    if (op.t !== '+') a++;
    if (op.t !== '-') b++;
  }
  const changes = ops.map((op, i) => (op.t === ' ' ? -1 : i)).filter((i) => i >= 0);
  const ranges: [number, number][] = [];
  for (const i of changes) {
    const start = Math.max(0, i - context);
    const end = Math.min(ops.length - 1, i + context);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  const fmt = (start: number, count: number) => (count === 0 ? `${start},0` : count === 1 ? `${start + 1}` : `${start + 1},${count}`);
  const out: string[] = [];
  for (const [s, e] of ranges) {
    const slice = ops.slice(s, e + 1);
    const aCount = slice.filter((o) => o.t !== '+').length;
    const bCount = slice.filter((o) => o.t !== '-').length;
    out.push(g.c(C.cyan, `@@ -${fmt(aPos[s], aCount)} +${fmt(bPos[s], bCount)} @@`));
    for (const op of slice) {
      const noEol = op.s.endsWith(NOEOL);
      const text = op.t + (noEol ? op.s.slice(0, -1) : op.s);
      out.push(op.t === '-' ? g.c(C.red, text) : op.t === '+' ? g.c(C.green, text) : text);
      if (noEol) out.push('\\ No newline at end of file');
    }
  }
  return out;
}

interface Change {
  status: 'A' | 'M' | 'D' | 'R';
  path: string;
  oldPath?: string;
  oldHash?: string;
  newHash?: string;
}

/** Skillnaderna mellan två träd, med enkel upptäckt av namnbyten (samma innehåll). */
function treeChanges(A: Tree, B: Tree, filter?: (p: string) => boolean): Change[] {
  const changes: Change[] = [];
  for (const p of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (filter && !filter(p)) continue;
    if (A[p] === B[p]) continue;
    if (!(p in A)) changes.push({ status: 'A', path: p, newHash: B[p] });
    else if (!(p in B)) changes.push({ status: 'D', path: p, oldHash: A[p] });
    else changes.push({ status: 'M', path: p, oldHash: A[p], newHash: B[p] });
  }
  for (const add of changes.filter((c) => c.status === 'A')) {
    const del = changes.find((c) => c.status === 'D' && c.oldHash === add.newHash);
    if (!del) continue;
    changes.splice(changes.indexOf(del), 1);
    add.status = 'R';
    add.oldPath = del.path;
    add.oldHash = del.oldHash;
  }
  return changes.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
}

function printPatch(r: Repo, changes: Change[], mode: 'patch' | 'stat' | 'name-only' | 'name-status' = 'patch'): void {
  const g = r.g;
  if (mode === 'stat') {
    g.out(statText(r, changes, false));
    return;
  }
  for (const ch of changes) {
    if (mode === 'name-only') {
      g.out(ch.path + '\n');
      continue;
    }
    if (mode === 'name-status') {
      g.out(ch.status === 'R' ? `R100\t${ch.oldPath}\t${ch.path}\n` : `${ch.status}\t${ch.path}\n`);
      continue;
    }
    const oldP = ch.oldPath ?? ch.path;
    const lines = [`diff --git a/${oldP} b/${ch.path}`];
    if (ch.status === 'A') lines.push('new file mode 100644');
    if (ch.status === 'D') lines.push('deleted file mode 100644');
    if (ch.status === 'R') lines.push('similarity index 100%', `rename from ${oldP}`, `rename to ${ch.path}`);
    if (ch.status !== 'R') lines.push(`index ${short(ch.oldHash ?? ZERO)}..${short(ch.newHash ?? ZERO)}${ch.status === 'M' ? ' 100644' : ''}`);
    const oldText = ch.oldHash ? readBlob(r, ch.oldHash) : '';
    const newText = ch.newHash ? readBlob(r, ch.newHash) : '';
    const hunks = oldText === newText ? [] : hunkLines(g, oldText, newText);
    if (hunks.length) lines.push(ch.status === 'A' ? '--- /dev/null' : `--- a/${oldP}`, ch.status === 'D' ? '+++ /dev/null' : `+++ b/${ch.path}`);
    g.out(lines.map((l) => g.c(C.bold, l)).join('\n') + '\n');
    if (hunks.length) g.out(hunks.join('\n') + '\n');
  }
}

function summaryLine(files: number, ins: number, del: number): string {
  let s = ` ${files} file${files === 1 ? '' : 's'} changed`;
  if (ins || !del) s += `, ${ins} insertion${ins === 1 ? '' : 's'}(+)`;
  if (del || !ins) s += `, ${del} deletion${del === 1 ? '' : 's'}(-)`;
  return s + '\n';
}

/** Diffstat som efter `git merge` (stapeldiagram) eller `git commit` (bara summering, short=true). */
function statText(r: Repo, changes: Change[], short: boolean): string {
  const g = r.g;
  const rows = changes.map((ch) => {
    const { ins, del } = countChanges(ch.oldHash ? readBlob(r, ch.oldHash) : '', ch.newHash ? readBlob(r, ch.newHash) : '');
    const name = ch.status === 'R' ? `${ch.oldPath} => ${ch.path}` : ch.path;
    return { ch, ins, del, name };
  });
  const ins = rows.reduce((s, x) => s + x.ins, 0);
  const del = rows.reduce((s, x) => s + x.del, 0);
  let out = '';
  if (!short) {
    const nameW = Math.max(0, ...rows.map((x) => x.name.length));
    const numW = Math.max(1, ...rows.map((x) => String(x.ins + x.del).length));
    const maxBar = Math.max(1, ...rows.map((x) => x.ins + x.del));
    const scale = maxBar > 50 ? 50 / maxBar : 1;
    for (const x of rows) {
      const plus = Math.round(x.ins * scale) || (x.ins ? 1 : 0);
      const minus = Math.round(x.del * scale) || (x.del ? 1 : 0);
      const bar = g.c(C.green, '+'.repeat(plus)) + g.c(C.red, '-'.repeat(minus));
      out += ` ${x.name.padEnd(nameW)} | ${String(x.ins + x.del).padStart(numW)}${bar ? ' ' + bar : ''}\n`;
    }
  }
  if (rows.length) out += summaryLine(rows.length, ins, del);
  for (const x of rows) {
    if (x.ch.status === 'A') out += ` create mode 100644 ${x.ch.path}\n`;
    else if (x.ch.status === 'D') out += ` delete mode 100644 ${x.ch.path}\n`;
    else if (x.ch.status === 'R' && short) out += ` rename ${x.ch.oldPath} => ${x.ch.path} (100%)\n`;
  }
  return out;
}

// ---------- Trevägssammanfogning ----------

/** Vilka rader i a som matchar rader i b (index i b, eller -1). */
function matches(a: string[], b: string[]): number[] {
  const res = new Array<number>(a.length).fill(-1);
  let i = 0;
  let j = 0;
  for (const op of diffOps(a, b)) {
    if (op.t === ' ') res[i++] = j++;
    else if (op.t === '-') i++;
    else j++;
  }
  return res;
}

/** Radbaserad trevägsmerge (diff3). Returnerar texten och om det blev konflikt. */
function merge3(base: string, ours: string, theirs: string, oursLabel: string, theirsLabel: string): { text: string; conflict: boolean } {
  const B = diffLinesOf(base);
  const O = diffLinesOf(ours);
  const T = diffLinesOf(theirs);
  const mo = matches(B, O);
  const mt = matches(B, T);
  const out: string[] = [];
  let conflict = false;
  let i = 0;
  let j = 0;
  let k = 0;
  const eq = (x: string[], y: string[]) => x.length === y.length && x.every((s, n) => s === y[n]);
  while (i < B.length || j < O.length || k < T.length) {
    if (i < B.length && mo[i] === j && mt[i] === k) {
      out.push(B[i]);
      i++;
      j++;
      k++;
      continue;
    }
    let t = i;
    while (t < B.length && !(mo[t] >= j && mt[t] >= k)) t++;
    const oj = t < B.length ? mo[t] : O.length;
    const tk = t < B.length ? mt[t] : T.length;
    const b = B.slice(i, t);
    const o = O.slice(j, oj);
    const th = T.slice(k, tk);
    if (eq(o, b)) out.push(...th);
    else if (eq(th, b) || eq(o, th)) out.push(...o);
    else {
      conflict = true;
      const strip = (xs: string[]) => xs.map((s) => s.replace(NOEOL, ''));
      out.push(`<<<<<<< ${oursLabel}`, ...strip(o), '=======', ...strip(th), `>>>>>>> ${theirsLabel}`);
    }
    i = t;
    j = oj;
    k = tk;
  }
  const last = out[out.length - 1];
  const text = out.map((l) => l.replace(NOEOL, '')).join('\n') + (out.length && !last.endsWith(NOEOL) ? '\n' : '');
  return { text, conflict };
}

// ---------- Byta träd i arbetskatalogen ----------

/**
 * Gör arbetskatalogen och indexet lika med trädet `target` (från HEAD-trädet `from`).
 * Lokala ändringar i filer som inte berörs följer med. Om en ändring skulle skrivas
 * över avbryts allt med samma fel som riktiga git.
 */
function switchTree(r: Repo, from: Tree, target: Tree, verb: 'checkout' | 'merge', force = false, alsoCheck: string[] = []): Index {
  const work = scanWork(r);
  const idx = readIndex(r);
  const paths = [...new Set([...Object.keys(from), ...Object.keys(target)])].filter((p) => from[p] !== target[p]).sort();
  const local: string[] = [];
  const untracked: string[] = [];
  if (!force) {
    for (const p of [...new Set([...paths, ...alsoCheck])].sort()) {
      const w = work.files.get(p);
      if (p in idx.entries || p in from) {
        const indexDirty = idx.entries[p] !== from[p] || p in idx.unmerged;
        const workDirty = w ? w.hash !== idx.entries[p] : p in idx.entries;
        const alreadyTarget = idx.entries[p] === target[p] && (w ? w.hash === target[p] : target[p] === undefined);
        if ((indexDirty || workDirty) && !alreadyTarget) local.push(p);
      } else if (w && !w.ignored && w.hash !== target[p]) untracked.push(p);
    }
  }
  if (local.length) {
    const what = verb === 'checkout' ? 'switch branches' : 'merge';
    fail(
      `error: Your local changes to the following files would be overwritten by ${verb}:\n${local.map((p) => `\t${show(r, p)}\n`).join('')}Please commit your changes or stash them before you ${what}.\nAborting`,
    );
  }
  if (untracked.length) {
    fail(
      `error: The following untracked working tree files would be overwritten by ${verb}:\n${untracked.map((p) => `\t${show(r, p)}\n`).join('')}Please move or remove them before you ${verb === 'checkout' ? 'switch branches' : 'merge'}.\nAborting`,
    );
  }
  for (const p of paths) {
    if (target[p] === undefined) {
      removeWorkFile(r, p);
      delete idx.entries[p];
    } else {
      writeWorkFile(r, p, readBlob(r, target[p]));
      idx.entries[p] = target[p];
    }
    delete idx.unmerged[p];
  }
  if (force) {
    for (const p of Object.keys(idx.entries)) {
      if (!(p in target)) {
        removeWorkFile(r, p);
        delete idx.entries[p];
      } else if (work.files.get(p)?.hash !== target[p] || idx.entries[p] !== target[p]) {
        writeWorkFile(r, p, readBlob(r, target[p]));
        idx.entries[p] = target[p];
      }
    }
    for (const p of Object.keys(target)) {
      if (!(p in idx.entries)) {
        writeWorkFile(r, p, readBlob(r, target[p]));
        idx.entries[p] = target[p];
      }
    }
    idx.unmerged = {};
  }
  writeIndex(r, idx);
  return idx;
}

// ---------- Status ----------

interface StatusInfo {
  head: Head;
  headTree: Tree;
  index: Index;
  work: Work;
  staged: Change[];
  unstaged: Change[];
  unmerged: { path: string; code: string; label: string }[];
  untracked: string[];
  merging: boolean;
}

function collapseUntracked(paths: string[], tracked: string[]): string[] {
  const trackedDirs = new Set<string>();
  for (const t of tracked) {
    const parts = t.split('/');
    for (let i = 1; i < parts.length; i++) trackedDirs.add(parts.slice(0, i).join('/'));
  }
  const units = new Set<string>();
  for (const p of paths) {
    const parts = p.split('/');
    let unit = p;
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/');
      if (!trackedDirs.has(d)) {
        unit = d + '/';
        break;
      }
    }
    units.add(unit);
  }
  return [...units].sort();
}

function computeStatus(r: Repo, all = false): StatusInfo {
  const head = readHead(r);
  const headTree = commitTree(r, head.hash);
  const index = readIndex(r);
  const work = scanWork(r);
  const clean: Tree = {};
  for (const [p, h] of Object.entries(index.entries)) if (!(p in index.unmerged)) clean[p] = h;
  const headClean: Tree = {};
  for (const [p, h] of Object.entries(headTree)) if (!(p in index.unmerged)) headClean[p] = h;
  const staged = treeChanges(headClean, clean);
  const unstaged: Change[] = [];
  for (const [p, h] of Object.entries(clean)) {
    const w = work.files.get(p);
    if (!w) unstaged.push({ status: 'D', path: p, oldHash: h });
    else if (w.hash !== h) unstaged.push({ status: 'M', path: p, oldHash: h, newHash: w.hash });
  }
  unstaged.sort((a, b) => (a.path < b.path ? -1 : 1));
  const unmerged = Object.entries(index.unmerged)
    .map(([path, u]) => {
      if (!u.base && u.ours && u.theirs) return { path, code: 'AA', label: 'both added:' };
      if (!u.ours) return { path, code: 'DU', label: 'deleted by us:' };
      if (!u.theirs) return { path, code: 'UD', label: 'deleted by them:' };
      return { path, code: 'UU', label: 'both modified:' };
    })
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const untrackedFiles = [...work.files.entries()].filter(([p, w]) => !(p in index.entries) && !(p in index.unmerged) && !w.ignored).map(([p]) => p);
  const untracked = all ? untrackedFiles.sort() : collapseUntracked(untrackedFiles, Object.keys(index.entries));
  return { head, headTree, index, work, staged, unstaged, unmerged, untracked, merging: existsAt(r.g, gpath(r, 'MERGE_HEAD')) };
}

/** Upstream-grenen för en lokal gren, t.ex. "origin/main". */
function upstreamOf(r: Repo, branch: string): { remote: string; ref: string; name: string } | null {
  const remote = getConfig(r.g, r, `branch.${branch}.remote`);
  const merge = getConfig(r.g, r, `branch.${branch}.merge`);
  if (!remote || !merge) return null;
  const b = merge.replace(/^refs\/heads\//, '');
  return { remote, ref: `refs/remotes/${remote}/${b}`, name: `${remote}/${b}` };
}

function trackingText(r: Repo, branch: string, hash: string | undefined): string {
  const up = upstreamOf(r, branch);
  if (!up) return '';
  const upHash = readRef(r, up.ref);
  if (!upHash) return `Your branch is based on '${up.name}', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)\n`;
  const mine = ancestors(r, hash);
  const theirs = ancestors(r, upHash);
  const ahead = [...mine].filter((x) => !theirs.has(x)).length;
  const behind = [...theirs].filter((x) => !mine.has(x)).length;
  const commits = (n: number) => `${n} commit${n === 1 ? '' : 's'}`;
  if (!ahead && !behind) return `Your branch is up to date with '${up.name}'.\n`;
  if (ahead && !behind) return `Your branch is ahead of '${up.name}' by ${commits(ahead)}.\n  (use "git push" to publish your local commits)\n`;
  if (!ahead) return `Your branch is behind '${up.name}' by ${commits(behind)}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)\n`;
  return `Your branch and '${up.name}' have diverged,\nand have ${ahead} and ${behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)\n`;
}

function printLongStatus(r: Repo, s: StatusInfo): void {
  const g = r.g;
  let out = s.head.branch ? `On branch ${s.head.branch}\n` : `HEAD detached at ${short(s.head.hash ?? ZERO)}\n`;
  if (s.head.branch && s.head.hash) {
    const t = trackingText(r, s.head.branch, s.head.hash);
    if (t) out += t + '\n';
  }
  if (s.merging) {
    out += s.unmerged.length
      ? 'You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n\n'
      : 'All conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n\n';
  }
  if (!s.head.hash) out += '\nNo commits yet\n\n';
  // Varje avsnitt avslutas med en tom rad, precis som i riktiga git.
  const section = (title: string, hints: string[], lines: string[]) => {
    out += `${title}\n${hints.map((h) => `  (${h})\n`).join('')}${lines.join('')}\n`;
  };
  const label = (ch: Change) => ({ A: 'new file:', M: 'modified:', D: 'deleted:', R: 'renamed:' })[ch.status].padEnd(12);
  const name = (ch: Change) => (ch.status === 'R' ? `${show(r, ch.oldPath!)} -> ${show(r, ch.path)}` : show(r, ch.path));
  if (s.staged.length) {
    const hint = s.merging ? [] : [s.head.hash ? 'use "git restore --staged <file>..." to unstage' : 'use "git rm --cached <file>..." to unstage'];
    section('Changes to be committed:', hint, s.staged.map((ch) => `\t${g.c(C.green, label(ch) + name(ch))}\n`));
  }
  if (s.unmerged.length) {
    section(
      'Unmerged paths:',
      [s.unmerged.some((u) => u.code !== 'UU' && u.code !== 'AA') ? 'use "git add/rm <file>..." as appropriate to mark resolution' : 'use "git add <file>..." to mark resolution'],
      s.unmerged.map((u) => `\t${g.c(C.red, u.label.padEnd(17) + show(r, u.path))}\n`),
    );
  }
  if (s.unstaged.length) {
    const del = s.unstaged.some((c) => c.status === 'D');
    section(
      'Changes not staged for commit:',
      [del ? 'use "git add/rm <file>..." to update what will be committed' : 'use "git add <file>..." to update what will be committed', 'use "git restore <file>..." to discard changes in working directory'],
      s.unstaged.map((ch) => `\t${g.c(C.red, label(ch) + name(ch))}\n`),
    );
  }
  if (s.untracked.length) {
    section('Untracked files:', ['use "git add <file>..." to include in what will be committed'], s.untracked.map((p) => `\t${g.c(C.red, show(r, p))}\n`));
  }
  if (!s.staged.length) {
    if (s.unstaged.length || s.unmerged.length) out += 'no changes added to commit (use "git add" and/or "git commit -a")\n';
    else if (s.untracked.length) out += 'nothing added to commit but untracked files present (use "git add" to track)\n';
    else if (!s.head.hash) out += 'nothing to commit (create/copy files and use "git add" to track)\n';
    else out += 'nothing to commit, working tree clean\n';
  }
  g.out(out);
}

function printShortStatus(r: Repo, s: StatusInfo, branch: boolean, color: boolean): void {
  const g = r.g;
  const c = (col: string, t: string) => (color ? g.c(col, t) : t);
  let out = '';
  if (branch) {
    if (!s.head.branch) out += `## ${c(C.red, 'HEAD (no branch)')}\n`;
    else if (!s.head.hash) out += `## No commits yet on ${c(C.green, s.head.branch)}\n`;
    else {
      const up = upstreamOf(r, s.head.branch);
      let extra = '';
      if (up) {
        const upHash = readRef(r, up.ref);
        if (upHash) {
          const mine = ancestors(r, s.head.hash);
          const theirs = ancestors(r, upHash);
          const ahead = [...mine].filter((x) => !theirs.has(x)).length;
          const behind = [...theirs].filter((x) => !mine.has(x)).length;
          const parts = [ahead ? `ahead ${ahead}` : '', behind ? `behind ${behind}` : ''].filter(Boolean);
          extra = `...${c(C.red, up.name)}${parts.length ? ` [${parts.join(', ')}]` : ''}`;
        } else extra = `...${c(C.red, up.name)} [gone]`;
      }
      out += `## ${c(C.green, s.head.branch)}${extra}\n`;
    }
  }
  const rows = new Map<string, { x: string; y: string; name: string }>();
  for (const ch of s.staged) rows.set(ch.path, { x: ch.status, y: ' ', name: ch.status === 'R' ? `${show(r, ch.oldPath!)} -> ${show(r, ch.path)}` : show(r, ch.path) });
  for (const ch of s.unstaged) {
    const row = rows.get(ch.path) ?? { x: ' ', y: ' ', name: show(r, ch.path) };
    row.y = ch.status;
    rows.set(ch.path, row);
  }
  for (const u of s.unmerged) rows.set(u.path, { x: u.code[0], y: u.code[1], name: show(r, u.path) });
  for (const p of [...rows.keys()].sort()) {
    const row = rows.get(p)!;
    const unmerged = s.unmerged.some((u) => u.path === p);
    out += unmerged ? `${c(C.red, row.x + row.y)} ${row.name}\n` : `${c(C.green, row.x.trim()) || ' '}${c(C.red, row.y.trim()) || ' '} ${row.name}\n`;
  }
  for (const p of s.untracked) out += `${c(C.red, '??')} ${show(r, p)}\n`;
  g.out(out);
}

// ---------- Argument ----------

interface Parsed {
  opts: Map<string, string[]>;
  operands: string[];
  /** Det som stod efter "--" (null om "--" inte fanns). */
  paths: string[] | null;
  has(name: string): boolean;
  get(name: string): string | undefined;
}

/**
 * Tolkar flaggor enligt en lista som ["a|all", "m|message=", "amend"]:
 * kort|långt namn, "=" betyder att flaggan tar ett värde. Flaggor kan upprepas.
 */
function parseArgs(args: string[], spec: string[], cmd: string): Parsed {
  const short = new Map<string, { name: string; value: boolean }>();
  const long = new Map<string, { name: string; value: boolean }>();
  for (const s of spec) {
    const value = s.endsWith('=');
    const names = s.replace(/=$/, '').split('|');
    const name = names.find((n) => n.length > 1) ?? names[0];
    for (const n of names) (n.length === 1 ? short : long).set(n, { name, value });
  }
  const opts = new Map<string, string[]>();
  const add = (name: string, v: string) => opts.set(name, [...(opts.get(name) ?? []), v]);
  const operands: string[] = [];
  let paths: string[] | null = null;
  const bad = (what: string): never => {
    throw new GitExit(`error: unknown ${what}\nusage: git ${cmd} [<options>]\n`, 129);
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      paths = args.slice(i + 1);
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      let key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      let def = long.get(key);
      let negated = false;
      if (!def && key.startsWith('no-') && long.has(key.slice(3))) {
        def = long.get(key.slice(3));
        key = key.slice(3);
        negated = true;
      }
      if (!def) {
        // Förkortningar som --stag för --staged.
        const hits = [...long.keys()].filter((k) => k.startsWith(key));
        if (hits.length === 1) def = long.get(hits[0]);
      }
      if (!def) bad(`option '${a.slice(2)}'`);
      if (negated) {
        opts.delete(def!.name);
        add('no-' + def!.name, '');
      } else if (def!.value) {
        const v = eq >= 0 ? a.slice(eq + 1) : args[++i];
        if (v === undefined) throw new GitExit(`error: option \`${key}' requires a value\n`, 129);
        add(def!.name, v);
      } else add(def!.name, '');
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const def = short.get(a[j]);
        if (!def) bad(`switch \`${a[j]}'`);
        if (def!.value) {
          const v = a.slice(j + 1) || args[++i];
          if (v === undefined) throw new GitExit(`error: switch \`${a[j]}' requires a value\n`, 129);
          add(def!.name, v);
          break;
        }
        add(def!.name, '');
      }
      continue;
    }
    operands.push(a);
  }
  return {
    opts,
    operands,
    paths,
    has: (n) => opts.has(n),
    get: (n) => opts.get(n)?.at(-1),
  };
}

// ---------- Underkommandon ----------

type Sub = (g: G, args: string[]) => number;

// init

const DEFAULT_BRANCH_HINT = `Using 'main' as the name for the initial branch. Older versions of git
use 'master' instead. To choose the initial branch name to use in all
of your new repositories, which will suppress this warning, call:

\tgit config --global init.defaultBranch <name>

Names commonly chosen are 'main', 'master', 'trunk' and 'development'.
The just-created branch can be renamed via this command:

\tgit branch -m <name>

Disable this message with "git config set advice.defaultBranchName false"`;

const EXCLUDE = `# git ls-files --others --exclude-from=.git/info/exclude
# Lines that start with '#' are comments.
# For a project mostly in C, the following would be a good set of
# exclude patterns (uncomment them if you want to use them):
# *.[oa]
# *~
`;

/** Skapar ett nytt repo. Returnerar sant om det redan fanns. */
function initRepo(g: G, dir: string, bare: boolean, branch: string): { gitDir: string; existed: boolean } {
  const gitDir = bare ? dir : join(dir, '.git');
  mkdirp(g, dir);
  if (looksLikeGitDir(g, gitDir)) return { gitDir, existed: true };
  mkdirp(g, gitDir);
  for (const d of ['objects/info', 'objects/pack', 'refs/heads', 'refs/tags', 'hooks', 'info']) mkdirp(g, `${gitDir}/${d}`);
  writeText(g, `${gitDir}/HEAD`, `ref: refs/heads/${branch}\n`);
  writeText(
    g,
    `${gitDir}/config`,
    `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = ${bare}\n${bare ? '' : '\tlogallrefupdates = true\n'}`,
  );
  writeText(g, `${gitDir}/description`, "Unnamed repository; edit this file 'description' to name the repository.\n");
  writeText(g, `${gitDir}/info/exclude`, EXCLUDE);
  return { gitDir, existed: false };
}

const cmdInit: Sub = (g, args) => {
  const o = parseArgs(args, ['q|quiet', 'bare', 'b|initial-branch='], 'init');
  if (o.operands.length > 1) fail('usage: git init [-q | --quiet] [--bare] [-b <branch-name> | --initial-branch=<branch-name>] [<directory>]', 129);
  const dir = resolvePath(g.cwd, o.operands[0] ?? '.');
  const configured = getConfig(g, null, 'init.defaultBranch');
  const branch = o.get('initial-branch') ?? configured ?? 'main';
  checkBranchName(g, branch);
  const { gitDir, existed } = initRepo(g, dir, o.has('bare'), branch);
  if (!existed && !o.has('initial-branch') && !configured && configBool(getConfig(g, null, 'advice.defaultBranchName'), true)) {
    g.hint(DEFAULT_BRANCH_HINT);
  }
  if (!o.has('quiet')) g.out(`${existed ? 'Reinitialized existing' : 'Initialized empty'} Git repository in ${gitDir}/\n`);
  return 0;
};

// config

const cmdConfig: Sub = (g, args) => {
  // Nya syntaxen (git 2.46+): git config list|get|set|unset ...
  type Action = 'get' | 'set' | 'unset' | 'list';
  let action: Action | null = null;
  if (['list', 'get', 'set', 'unset'].includes(args[0] ?? '')) {
    action = args[0] as Action;
    args = args.slice(1);
  }
  const o = parseArgs(args, ['global', 'local', 'system', 'l|list', 'get', 'get-all', 'unset', 'unset-all', 'show-origin', 'e|edit', 'add', 'all'], 'config');
  const scope = o.has('global') ? 'global' : o.has('system') ? 'system' : o.has('local') ? 'local' : null;
  if (o.has('edit')) {
    g.note(
      '(Simulatorn har ingen editor för git config -e. Använd git config <nyckel> <värde>, eller ändra filen med t.ex. echo.)',
      '(The simulator has no editor for git config -e. Use git config <key> <value>, or change the file with e.g. echo.)',
    );
    return 1;
  }
  if (o.has('list')) action = 'list';
  else if (o.has('get') || o.has('get-all')) action = 'get';
  else if (o.has('unset') || o.has('unset-all')) action = 'unset';
  if (!action) action = o.operands.length >= 2 ? 'set' : o.operands.length === 1 ? 'get' : null;
  if (!action) fail('usage: git config [<options>]\n\n    git config list [<file-option>] [<display-option>] [--includes]\n    git config get [<file-option>] [<display-option>] [--includes] [--all] <name>\n    git config set [<file-option>] [--type=<type>] [--all] [--value=<value>] [--fixed-value] <name> <value>\n    git config unset [<file-option>] [--all] [--value=<value>] [--fixed-value] <name>', 129);
  const r = discover(g, g.cwd);
  const pathFor = (s: string) => (s === 'global' ? globalConfigPath(g) : s === 'system' ? '/etc/gitconfig' : r ? gpath(r, 'config') : fatal('not in a git directory'));
  if (action === 'list') {
    const entries = scope ? parseConfig(readText(g, pathFor(scope)) ?? '').map((e) => ({ ...e, path: pathFor(scope) })) : configAll(g, r);
    if (scope && readText(g, pathFor(scope)) === null) fatal(`unable to read config file '${pathFor(scope)}': No such file or directory`);
    for (const e of entries) g.out(`${o.has('show-origin') ? `file:${e.path}\t` : ''}${e.key}=${e.value}\n`);
    return 0;
  }
  const key = o.operands[0];
  const parts = splitKey(key ?? '');
  if (!parts) {
    if (key && !key.includes('.')) fail(`error: key does not contain a section: ${key}`, 2);
    fail(`error: invalid key: ${key ?? ''}`, 1);
  }
  if (action === 'get') {
    const nk = normKey(parts!);
    const entries = (scope ? parseConfig(readText(g, pathFor(scope)) ?? '') : configAll(g, r)).filter((e) => e.key === nk);
    if (!entries.length) return 1;
    for (const e of o.has('get-all') || o.has('all') ? entries : entries.slice(-1)) g.out(e.value + '\n');
    return 0;
  }
  const path = pathFor(scope ?? 'local');
  if (action === 'unset') {
    const text = readText(g, path) ?? '';
    if (!parseConfig(text).some((e) => e.key === normKey(parts!))) return 5;
    writeText(g, path, setConfigText(text, parts!, null));
    return 0;
  }
  const value = o.operands[1];
  if (value === undefined) fail('error: wrong number of arguments, should be 2', 129);
  setConfig(g, path, key, value);
  return 0;
};

// status

const cmdStatus: Sub = (g, args) => {
  const o = parseArgs(args, ['s|short', 'b|branch', 'porcelain', 'long', 'u|untracked-files=', 'z'], 'status');
  const r = needRepo(g);
  needWork(r);
  const all = o.get('untracked-files') === 'all';
  const s = computeStatus(r, all);
  if (o.get('untracked-files') === 'no') s.untracked = [];
  if (o.has('porcelain')) printShortStatus(r, s, o.has('branch'), false);
  else if (o.has('short') && !o.has('long')) printShortStatus(r, s, o.has('branch'), true);
  else printLongStatus(r, s);
  return 0;
};

// add

const cmdAdd: Sub = (g, args) => {
  const o = parseArgs(args, ['A|all', 'u|update', 'f|force', 'v|verbose', 'n|dry-run', 'no-all'], 'add');
  const r = needRepo(g);
  needWork(r);
  const specsRaw = [...o.operands, ...(o.paths ?? [])];
  if (!specsRaw.length) {
    if (!o.has('all') && !o.has('update')) {
      g.out('Nothing specified, nothing added.\n');
      g.hint("Maybe you wanted to say 'git add .'?\nDisable this message with \"git config set advice.addEmptyPathspec false\"");
      return 0;
    }
    specsRaw.push(r.root!);
  }
  const specs = specsRaw.map((s) => toSpec(r, s));
  const work = scanWork(r);
  const idx = readIndex(r);
  const candidates = [...new Set([...work.files.keys(), ...Object.keys(idx.entries), ...Object.keys(idx.unmerged)])].sort();
  const ignoredHits: string[] = [];
  const log: string[] = [];
  for (const spec of specs) {
    let matched = false;
    let ignoredOnly = false;
    for (const p of candidates) {
      if (!specMatch(spec, p)) continue;
      const w = work.files.get(p);
      const tracked = p in idx.entries || p in idx.unmerged;
      if (w) {
        if (w.ignored && !tracked && !o.has('force')) {
          ignoredOnly = true;
          continue;
        }
        if (o.has('update') && !tracked) continue;
        matched = true;
        if (idx.entries[p] !== w.hash || p in idx.unmerged) {
          if (!o.has('dry-run')) {
            writeObj(r, 'blob', w.content);
            idx.entries[p] = w.hash;
            delete idx.unmerged[p];
          }
          log.push(`add '${show(r, p)}'`);
        }
      } else if (tracked) {
        matched = true;
        if (!o.has('dry-run')) {
          delete idx.entries[p];
          delete idx.unmerged[p];
        }
        log.push(`remove '${show(r, p)}'`);
      }
    }
    if (!matched) {
      if (ignoredOnly) ignoredHits.push(spec.raw);
      else if (!(spec.rel === '' || isDirAt(g, join(r.root!, spec.rel)))) fatal(`pathspec '${spec.raw}' did not match any files`);
    }
  }
  if (!o.has('dry-run')) writeIndex(r, idx);
  if (o.has('verbose') || o.has('dry-run')) g.out(log.map((l) => l + '\n').join(''));
  if (ignoredHits.length) {
    g.err(`The following paths are ignored by one of your .gitignore files:\n${ignoredHits.join('\n')}\n`);
    g.hint('Use -f if you really want to add them.\nDisable this message with "git config set advice.addIgnoredFile false"');
    return 1;
  }
  return 0;
};

// commit

function cleanMessage(msg: string): string {
  const lines = msg.split('\n').filter((l) => !l.startsWith('#')).map((l) => l.replace(/\s+$/, ''));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const out: string[] = [];
  for (const l of lines) if (!(l === '' && out[out.length - 1] === '')) out.push(l);
  return out.length ? out.join('\n') + '\n' : '';
}

const cmdCommit: Sub = (g, args) => {
  const o = parseArgs(args, ['m|message=', 'a|all', 'amend', 'allow-empty', 'q|quiet', 'no-edit', 'v|verbose', 'F|file=', 'e|edit'], 'commit');
  const r = needRepo(g);
  needWork(r);
  const id = identity(g, r)!;
  const head = readHead(r);
  let idx = readIndex(r);
  const mergeHead = readText(g, gpath(r, 'MERGE_HEAD'))?.trim();
  if (Object.keys(idx.unmerged).length) {
    fail(
      "error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
      128,
    );
  }
  if (o.has('amend') && !head.hash) fatal('You have nothing to amend.');
  if (o.has('amend') && mergeHead) fatal('You are in the middle of a merge -- cannot amend.');
  const paths = [...o.operands, ...(o.paths ?? [])];
  if (o.has('all') || paths.length) {
    if (o.has('all') && paths.length) fatal('paths with -a does not make sense.');
    if (mergeHead && paths.length) fatal('cannot do a partial commit during a merge.');
    const work = scanWork(r);
    const specs = paths.map((p) => toSpec(r, p));
    const used = new Set<Spec>();
    for (const p of Object.keys(idx.entries)) {
      const hit = specs.filter((s) => specMatch(s, p));
      if (specs.length && !hit.length) continue;
      hit.forEach((s) => used.add(s));
      const w = work.files.get(p);
      if (w) {
        writeObj(r, 'blob', w.content);
        idx.entries[p] = w.hash;
      } else delete idx.entries[p];
    }
    for (const s of specs) if (!used.has(s)) fail(`error: pathspec '${s.raw}' did not match any file(s) known to git`);
  }
  let message: string | undefined;
  const ms = o.opts.get('message');
  if (ms) message = ms.join('\n\n');
  else if (o.get('file') !== undefined) {
    const f = o.get('file')!;
    message = f === '-' ? (g.ctx.stdin ?? '') : (readText(g, resolvePath(g.cwd, f)) ?? fatal(`could not read log file '${f}': No such file or directory`));
  } else if (o.has('amend')) message = readCommit(r, head.hash!).message;
  else if (mergeHead) {
    message = readText(g, gpath(r, 'MERGE_MSG')) ?? `Merge commit '${mergeHead}'\n`;
    g.note(
      '(Simulatorn har ingen editor, så det föreslagna meddelandet från .git/MERGE_MSG används.)',
      '(The simulator has no editor, so the suggested message from .git/MERGE_MSG is used.)',
    );
  } else {
    g.note(
      '(Riktiga git öppnar nu en texteditor för commit-meddelandet. Simulatorn har ingen – skriv meddelandet direkt: git commit -m "Vad ändringen gör")',
      '(Real git now opens a text editor for the commit message. The simulator has none – give the message directly: git commit -m "What the change does")',
    );
    g.err('Aborting commit due to empty commit message.\n');
    return 1;
  }
  message = cleanMessage(message);
  if (!message) {
    g.err('Aborting commit due to empty commit message.\n');
    return 1;
  }
  const parents = o.has('amend') ? readCommit(r, head.hash!).parents : head.hash ? [head.hash] : [];
  if (mergeHead) parents.push(mergeHead);
  const tree = writeTree(r, idx.entries);
  const parentTree = parents[0] ? readCommit(r, parents[0]).tree : writeTree(r, {});
  if (tree === (head.hash ? readCommit(r, head.hash).tree : '') && !o.has('allow-empty') && !mergeHead && !o.has('amend')) {
    writeIndex(r, idx);
    printLongStatus(r, computeStatus(r));
    return 1;
  }
  if (!head.hash && !Object.keys(idx.entries).length && !o.has('allow-empty')) {
    printLongStatus(r, computeStatus(r));
    return 1;
  }
  writeIndex(r, idx);
  const author = o.has('amend') ? readCommit(r, head.hash!).author : id;
  const h = writeCommit(r, { tree, parents, author, committer: id, message });
  const kind = o.has('amend') ? ' (amend)' : mergeHead ? ' (merge)' : !parents.length ? ' (initial)' : '';
  moveHead(r, h, `commit${kind}: ${subject({ message } as Commit)}`);
  removeFile(g, gpath(r, 'MERGE_HEAD'));
  removeFile(g, gpath(r, 'MERGE_MSG'));
  removeFile(g, gpath(r, 'MERGE_MODE'));
  if (o.has('quiet')) return 0;
  const where = head.branch ?? 'detached HEAD';
  let out = `[${where}${parents.length ? '' : ' (root-commit)'} ${short(h)}] ${message.split('\n')[0]}\n`;
  if (o.has('amend')) out += ` Date: ${fmtDate(author)}\n`;
  out += statText(r, treeChanges(readTree(r, parentTree), idx.entries), true);
  g.out(out);
  return 0;
};

// log

function decorations(r: Repo): Map<string, { text: string; color: string }[]> {
  const map = new Map<string, { text: string; color: string }[]>();
  const add = (h: string | undefined, text: string, color: string) => {
    if (!h) return;
    map.set(h, [...(map.get(h) ?? []), { text, color }]);
  };
  const head = readHead(r);
  if (head.branch) add(head.hash, `HEAD -> ${head.branch}`, 'head');
  else add(head.hash, 'HEAD', C.boldCyan);
  for (const b of listRefs(r, 'refs/heads/')) if (b !== head.branch) add(readRef(r, `refs/heads/${b}`), b, C.boldGreen);
  for (const b of listRefs(r, 'refs/remotes/')) add(readRef(r, `refs/remotes/${b}`), b, C.boldRed);
  for (const t of listRefs(r, 'refs/tags/')) {
    const h = readRef(r, `refs/tags/${t}`);
    add(h ? peel(r, h) : undefined, `tag: ${t}`, C.boldYellow);
  }
  return map;
}

function decorate(g: G, map: Map<string, { text: string; color: string }[]> | null, h: string): string {
  const list = map?.get(h);
  if (!list?.length) return '';
  const parts = list.map((d) => {
    if (d.color === 'head') {
      const [, b] = d.text.split(' -> ');
      return `${g.c(C.boldCyan, 'HEAD')}${g.c(C.yellow, ' -> ')}${g.c(C.boldGreen, b)}`;
    }
    return g.c(d.color, d.text);
  });
  return ` ${g.c(C.yellow, '(')}${parts.join(g.c(C.yellow, ', '))}${g.c(C.yellow, ')')}`;
}

/** Commits som nås från `starts` (men inte från `exclude`), nyast först och barn före föräldrar. */
function walkCommits(r: Repo, starts: string[], exclude: string[] = [], firstParent = false): Commit[] {
  const hidden = new Set<string>();
  for (const e of exclude) for (const h of ancestors(r, e)) hidden.add(h);
  const all = new Map<string, Commit>();
  const order = new Map<string, number>();
  const queue = [...starts];
  while (queue.length) {
    const h = queue.shift()!;
    if (all.has(h) || hidden.has(h)) continue;
    const c = readCommit(r, h);
    all.set(h, c);
    order.set(h, order.size);
    queue.push(...(firstParent ? c.parents.slice(0, 1) : c.parents));
  }
  const pending = new Map<string, number>();
  for (const c of all.values()) for (const p of firstParent ? c.parents.slice(0, 1) : c.parents) if (all.has(p)) pending.set(p, (pending.get(p) ?? 0) + 1);
  const ready = [...all.keys()].filter((h) => !pending.get(h));
  const out: Commit[] = [];
  while (ready.length) {
    ready.sort((a, b) => all.get(b)!.committer.time - all.get(a)!.committer.time || order.get(a)! - order.get(b)!);
    const h = ready.shift()!;
    const c = all.get(h)!;
    out.push(c);
    for (const p of firstParent ? c.parents.slice(0, 1) : c.parents) {
      if (!all.has(p)) continue;
      const n = pending.get(p)! - 1;
      pending.set(p, n);
      if (n === 0) ready.push(p);
    }
  }
  return out;
}

/** Ritar en enkel graf (som `git log --graph`) till vänster om varje commit. */
function graphLines(commits: Commit[], render: (c: Commit) => string[]): string[] {
  const inSet = new Set(commits.map((c) => c.hash));
  let cols: string[] = [];
  const out: string[] = [];
  const draw = (width: number, set: (arr: string[]) => void) => {
    const arr = new Array<string>(width).fill(' ');
    set(arr);
    return arr.join('').replace(/\s+$/, '');
  };
  for (const c of commits) {
    let idx = cols.indexOf(c.hash);
    if (idx < 0) {
      cols.push(c.hash);
      idx = cols.length - 1;
    }
    const parents = c.parents.filter((p) => inSet.has(p));
    const next = [...cols];
    next.splice(idx, 1, ...(parents.length ? [parents[0]] : []));
    const extra = parents.slice(1).filter((p) => !next.includes(p));
    next.splice(idx + 1, 0, ...extra);
    const width = Math.max(cols.length, next.length) * 2;
    const row = cols.map((_, i) => (i === idx ? '*' : '|')).join(' ');
    const prefixes: string[] = [];
    if (parents.length > 1) {
      if (extra.length) {
        prefixes.push(
          draw(next.length * 2, (arr) => {
            for (let k = 0; k <= idx; k++) arr[2 * k] = '|';
            arr[2 * idx + 1] = '\\';
            for (let k = idx + 1; k < cols.length; k++) arr[2 * k + 1] = '\\';
          }),
        );
      } else {
        const q = next.indexOf(parents[1]);
        prefixes.push(
          draw(next.length * 2, (arr) => {
            for (let k = 0; k < next.length; k++) arr[2 * k] = '|';
            if (q < idx) arr[2 * idx - 1] = '/';
            else arr[2 * idx + 1] = '\\';
          }),
        );
      }
    } else if (!parents.length && idx < cols.length - 1) {
      prefixes.push(
        draw(cols.length * 2, (arr) => {
          for (let k = 0; k < idx; k++) arr[2 * k] = '|';
          for (let k = idx + 1; k < cols.length; k++) arr[2 * k - 1] = '/';
        }),
      );
    }
    cols = next;
    const bars = cols.map(() => '|').join(' ');
    const body = render(c);
    out.push(row.padEnd(width) + body[0]);
    const rest = body.slice(1);
    for (let i = 0; i < Math.max(rest.length, prefixes.length); i++) {
      const pre = prefixes[i] ?? bars;
      out.push(rest[i] ? pre.padEnd(width) + rest[i] : pre);
    }
    // Två kolumner som väntar på samma commit slås ihop.
    for (let j = 0; j < cols.length; j++) {
      const i = cols.indexOf(cols[j]);
      if (i === j) continue;
      out.push(
        draw(cols.length * 2, (arr) => {
          for (let k = 0; k < j; k++) arr[2 * k] = '|';
          arr[2 * j - 1] = '/';
          for (let k = j + 1; k < cols.length; k++) arr[2 * k - 1] = '/';
        }),
      );
      cols.splice(j, 1);
      j--;
    }
  }
  return out;
}

function commitHeader(r: Repo, c: Commit, deco: Map<string, { text: string; color: string }[]> | null): string[] {
  const g = r.g;
  const lines = [`${g.c(C.yellow, `commit ${c.hash}`)}${decorate(g, deco, c.hash)}`];
  if (c.parents.length > 1) lines.push(`Merge: ${c.parents.map(short).join(' ')}`);
  lines.push(`Author: ${c.author.name} <${c.author.email}>`, `Date:   ${fmtDate(c.author)}`, '');
  for (const l of c.message.replace(/\n$/, '').split('\n')) lines.push(l ? `    ${l}` : '');
  return lines;
}

/** Delar upp argumenten i revisioner och sökvägar, som riktiga git. */
function revsAndPaths(r: Repo, o: Parsed): { revs: string[]; paths: string[] } {
  const revs: string[] = [];
  const paths = [...(o.paths ?? [])];
  for (const a of o.operands) {
    const range = a.includes('..') ? a.split(/\.{2,3}/) : [a];
    const isRev = range.every((x) => x === '' || resolveRev(r, x) !== null);
    if (isRev && !paths.length) revs.push(a);
    else if (r.root && existsAt(r.g, resolvePath(r.g.cwd, a))) paths.push(a);
    else if (r.root && o.paths === null && Object.keys(readIndex(r).entries).some((p) => specMatch(toSpec(r, a), p))) paths.push(a);
    else
      fail(
        `fatal: ambiguous argument '${a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`,
        128,
      );
  }
  return { revs, paths };
}

const cmdLog: Sub = (g, args) => {
  let limit = Infinity;
  args = args.filter((a) => {
    const m = /^-(\d+)$/.exec(a);
    if (m) limit = Number(m[1]);
    return !m;
  });
  const o = parseArgs(
    args,
    ['oneline', 'n|max-count=', 'graph', 'all', 'decorate', 'p|patch', 'stat', 'reverse', 'first-parent', 'name-only', 'name-status', 'pretty=', 'format=', 'abbrev-commit'],
    'log',
  );
  if (o.get('max-count')) limit = Number(o.get('max-count'));
  const r = needRepo(g);
  const { revs, paths } = revsAndPaths(r, o);
  const head = readHead(r);
  const starts: string[] = [];
  const exclude: string[] = [];
  for (const rev of revs) {
    if (rev.includes('..')) {
      const [a, b] = rev.split(/\.{2,3}/);
      exclude.push(needCommit(r, a || 'HEAD'));
      starts.push(needCommit(r, b || 'HEAD'));
    } else if (rev.startsWith('^')) exclude.push(needCommit(r, rev.slice(1)));
    else starts.push(needCommit(r, rev));
  }
  if (o.has('all')) {
    if (head.hash) starts.push(head.hash);
    for (const prefix of ['refs/heads/', 'refs/remotes/', 'refs/tags/'])
      for (const n of listRefs(r, prefix)) {
        const h = readRef(r, prefix + n);
        if (h && readObj(r, peel(r, h))?.type === 'commit') starts.push(peel(r, h));
      }
  }
  if (!starts.length && !o.has('all')) {
    if (!head.hash) fatal(head.branch ? `your current branch '${head.branch}' does not have any commits yet` : 'bad default revision \'HEAD\'');
    starts.push(head.hash!);
  }
  let commits = walkCommits(r, [...new Set(starts)], exclude, o.has('first-parent'));
  if (paths.length) {
    const specs = paths.map((p) => toSpec(r, p));
    const touches = (c: Commit) => treeChanges(commitTree(r, c.parents[0]), readTree(r, c.tree), (p) => specs.some((s) => specMatch(s, p))).length > 0;
    commits = commits.filter(touches);
  }
  commits = commits.slice(0, limit);
  if (o.has('reverse')) commits.reverse();
  const pretty = o.get('pretty') ?? o.get('format');
  const oneline = o.has('oneline') || pretty === 'oneline';
  const deco = o.has('no-decorate') ? null : o.has('decorate') || g.tty ? decorations(r) : null;
  const render = (c: Commit): string[] => {
    let lines: string[];
    if (oneline) lines = [`${g.c(C.yellow, o.has('oneline') || o.has('abbrev-commit') ? short(c.hash) : c.hash)}${decorate(g, deco, c.hash)} ${subject(c)}`];
    else if (pretty === 'short') lines = [`${g.c(C.yellow, `commit ${c.hash}`)}${decorate(g, deco, c.hash)}`, `Author: ${c.author.name} <${c.author.email}>`, '', `    ${subject(c)}`];
    else lines = commitHeader(r, c, deco);
    const mode = o.has('patch') ? 'patch' : o.has('stat') ? 'stat' : o.has('name-only') ? 'name-only' : o.has('name-status') ? 'name-status' : null;
    if (mode && c.parents.length < 2) {
      let text = '';
      const saved = g.out;
      g.out = (s) => (text += s);
      try {
        printPatch(r, treeChanges(commitTree(r, c.parents[0]), readTree(r, c.tree)), mode);
      } finally {
        g.out = saved;
      }
      if (text) lines.push(...(oneline ? [] : ['']), ...text.replace(/\n$/, '').split('\n'));
    }
    return lines;
  };
  const blocks: string[] = [];
  if (o.has('graph')) {
    const sep = !oneline;
    blocks.push(
      ...graphLines(commits, (c) => {
        const lines = render(c);
        return sep && c !== commits[commits.length - 1] ? [...lines, ''] : lines;
      }),
    );
  } else {
    commits.forEach((c, i) => {
      blocks.push(...render(c));
      if (!oneline && i < commits.length - 1) blocks.push('');
    });
  }
  if (blocks.length) g.out(blocks.join('\n') + '\n');
  return 0;
};

// diff

const cmdDiff: Sub = (g, args) => {
  const o = parseArgs(args, ['staged', 'cached', 'stat', 'name-only', 'name-status', 'exit-code', 'quiet', 'no-index'], 'diff');
  const r = needRepo(g);
  const { revs, paths } = revsAndPaths(r, o);
  const specs = paths.map((p) => toSpec(r, p));
  const filter = (p: string) => !specs.length || specs.some((s) => specMatch(s, p));
  const staged = o.has('staged') || o.has('cached');
  let A: Tree;
  let B: Tree;
  const worktreeTree = (base: Tree): Tree => {
    const work = scanWork(r);
    const t: Tree = {};
    for (const p of Object.keys(base)) {
      const w = work.files.get(p);
      if (w) t[p] = w.hash;
    }
    return t;
  };
  const range = revs.find((x) => x.includes('..'));
  if (range || revs.length === 2) {
    const [a, b] = range ? range.split(/\.{2,3}/) : revs;
    A = commitTree(r, needCommit(r, a || 'HEAD'));
    B = commitTree(r, needCommit(r, b || 'HEAD'));
  } else if (revs.length === 1) {
    A = revTree(r, revs[0]) ?? fatal(`bad revision '${revs[0]}'`);
    const idx = readIndex(r);
    B = staged ? idx.entries : worktreeTree({ ...A, ...idx.entries });
  } else if (staged) {
    A = commitTree(r, readHead(r).hash);
    B = readIndex(r).entries;
  } else {
    needWork(r);
    const idx = readIndex(r);
    A = { ...idx.entries };
    for (const p of Object.keys(idx.unmerged)) delete A[p];
    B = worktreeTree(A);
    const unmerged = Object.keys(idx.unmerged).filter(filter);
    if (unmerged.length && !o.has('quiet')) {
      // Visa konfliktfilerna jämfört med "vår" version (riktiga git visar en kombinerad diff).
      for (const p of unmerged) {
        const ours = idx.unmerged[p].ours;
        const w = scanWork(r).files.get(p);
        g.out(`${g.c(C.bold, `diff --cc ${p}`)}\n`);
        if (ours && w) {
          const lines = hunkLines(g, readBlob(r, ours), w.content);
          if (lines.length) g.out(`${g.c(C.bold, `--- a/${p}`)}\n${g.c(C.bold, `+++ b/${p}`)}\n${lines.join('\n')}\n`);
        }
      }
    }
  }
  const changes = treeChanges(A, B, filter);
  if (!o.has('quiet')) printPatch(r, changes, o.has('stat') ? 'stat' : o.has('name-only') ? 'name-only' : o.has('name-status') ? 'name-status' : 'patch');
  return (o.has('exit-code') || o.has('quiet')) && changes.length ? 1 : 0;
};

// restore / checkout av filer

function restorePaths(
  r: Repo,
  pathspecs: string[],
  opts: { staged: boolean; worktree: boolean; source?: string; ours?: boolean; theirs?: boolean; checkoutStyle?: boolean },
): number {
  const g = r.g;
  const specs = pathspecs.map((p) => toSpec(r, p));
  const idx = readIndex(r);
  const head = readHead(r);
  let source: Tree | null = null;
  if (opts.source) source = revTree(r, opts.source) ?? fatal(`could not resolve ${opts.source}`);
  else if (opts.staged) source = commitTree(r, head.hash);
  const work = scanWork(r);
  const known = new Set([...Object.keys(idx.entries), ...Object.keys(idx.unmerged), ...Object.keys(source ?? {})]);
  let count = 0;
  for (const spec of specs) {
    const hits = [...known].filter((p) => specMatch(spec, p));
    if (!hits.length) fail(`error: pathspec '${spec.raw}' did not match any file(s) known to git`);
    for (const p of hits.sort()) {
      const u = idx.unmerged[p];
      if (opts.worktree) {
        if (u && !opts.source) {
          const side = opts.ours ? u.ours : opts.theirs ? u.theirs : undefined;
          if (!opts.ours && !opts.theirs) fail(`error: path '${show(r, p)}' is unmerged`);
          if (!side) fail(`error: path '${show(r, p)}' does not have ${opts.ours ? 'our' : 'their'} version`);
          writeWorkFile(r, p, readBlob(r, side!));
          count++;
          continue;
        }
        const want = source ? source[p] : idx.entries[p];
        if (want === undefined) {
          if (source && p in idx.entries && work.files.has(p)) {
            removeWorkFile(r, p);
            count++;
          }
        } else if (work.files.get(p)?.hash !== want) {
          writeWorkFile(r, p, readBlob(r, want));
          count++;
        } else count++;
      }
      if (opts.staged) {
        const want = source![p];
        if (want === undefined) delete idx.entries[p];
        else idx.entries[p] = want;
        delete idx.unmerged[p];
      }
    }
  }
  writeIndex(r, idx);
  if (opts.checkoutStyle) g.err(`Updated ${count} path${count === 1 ? '' : 's'} from ${opts.source ? 'the tree' : 'the index'}\n`);
  return 0;
}

const cmdRestore: Sub = (g, args) => {
  const o = parseArgs(args, ['S|staged', 'W|worktree', 's|source=', 'ours', 'theirs', 'q|quiet'], 'restore');
  const r = needRepo(g);
  needWork(r);
  const paths = [...o.operands, ...(o.paths ?? [])];
  if (!paths.length) fatal('you must specify path(s) to restore');
  const staged = o.has('staged');
  const worktree = o.has('worktree') || !staged;
  return restorePaths(r, paths, { staged, worktree, source: o.get('source'), ours: o.has('ours'), theirs: o.has('theirs') });
};

// rm / mv

const cmdRm: Sub = (g, args) => {
  const o = parseArgs(args, ['cached', 'r', 'f|force', 'q|quiet', 'n|dry-run'], 'rm');
  const r = needRepo(g);
  needWork(r);
  const raw = [...o.operands, ...(o.paths ?? [])];
  if (!raw.length) fail('usage: git rm [-f | --force] [-n] [-r] [--cached] [--ignore-unmatch]\n              [--quiet] [--pathspec-from-file=<file> [--pathspec-file-nul]]\n              [--] [<pathspec>...]', 129);
  const idx = readIndex(r);
  const head = commitTree(r, readHead(r).hash);
  const work = scanWork(r);
  const targets: string[] = [];
  for (const s of raw.map((x) => toSpec(r, x))) {
    const hits = Object.keys(idx.entries).filter((p) => specMatch(s, p));
    if (!hits.length) fatal(`pathspec '${s.raw}' did not match any files`);
    if (!o.has('r') && hits.some((p) => p !== s.rel) && !s.glob) fatal(`not removing '${s.raw}' recursively without -r`);
    targets.push(...hits);
  }
  if (!o.has('force')) {
    const staged = targets.filter((p) => idx.entries[p] !== head[p] && work.files.get(p)?.hash === idx.entries[p]);
    const local = targets.filter((p) => work.files.has(p) && work.files.get(p)!.hash !== idx.entries[p]);
    const both = local.filter((p) => idx.entries[p] !== head[p]);
    if (both.length && !o.has('cached'))
      fail(`error: the following file${both.length > 1 ? 's have' : ' has'} staged content different from both the\nfile and the HEAD:\n${both.map((p) => `    ${show(r, p)}\n`).join('')}(use -f to force removal)`);
    if (!o.has('cached')) {
      if (staged.length)
        fail(`error: the following file${staged.length > 1 ? 's have' : ' has'} changes staged in the index:\n${staged.map((p) => `    ${show(r, p)}\n`).join('')}(use --cached to keep the file, or -f to force removal)`);
      if (local.length)
        fail(`error: the following file${local.length > 1 ? 's have' : ' has'} local modifications:\n${local.map((p) => `    ${show(r, p)}\n`).join('')}(use --cached to keep the file, or -f to force removal)`);
    }
  }
  for (const p of [...new Set(targets)].sort()) {
    if (!o.has('quiet')) g.out(`rm '${p}'\n`);
    if (o.has('dry-run')) continue;
    delete idx.entries[p];
    delete idx.unmerged[p];
    if (!o.has('cached')) removeWorkFile(r, p);
  }
  if (!o.has('dry-run')) writeIndex(r, idx);
  return 0;
};

const cmdMv: Sub = (g, args) => {
  const o = parseArgs(args, ['f|force', 'v|verbose', 'n|dry-run', 'k'], 'mv');
  const r = needRepo(g);
  const root = needWork(r);
  const ops = [...o.operands, ...(o.paths ?? [])];
  if (ops.length < 2) fail('usage: git mv [-v] [-f] [-n] [-k] <source> <destination>\n   or: git mv [-v] [-f] [-n] [-k] <source>... <destination-directory>', 129);
  const destRaw = ops.pop()!;
  const destSpec = toSpec(r, destRaw);
  const destIsDir = ops.length > 1 || isDirAt(g, join(root, destSpec.rel));
  if (ops.length > 1 && !isDirAt(g, join(root, destSpec.rel))) fatal(`destination '${destRaw}' is not a directory`);
  const idx = readIndex(r);
  const moves: [string, string][] = [];
  for (const srcRaw of ops) {
    const src = toSpec(r, srcRaw);
    const target = destIsDir ? (destSpec.rel ? `${destSpec.rel}/` : '') + src.rel.split('/').pop() : destSpec.rel;
    const desc = `source=${srcRaw}, destination=${destIsDir ? relPath(g.cwd, join(root, target)) : destRaw}`;
    if (!existsAt(g, join(root, src.rel))) fatal(`bad source, ${desc}`);
    const inside = Object.keys(idx.entries).filter((p) => p === src.rel || p.startsWith(src.rel + '/'));
    if (!inside.length) fatal(`not under version control, ${desc}`);
    if (target === src.rel || target.startsWith(src.rel + '/')) fatal(`can not move directory into itself, ${desc}`);
    if (existsAt(g, join(root, target)) && !o.has('force')) fatal(`destination exists, ${desc}`);
    for (const p of inside) moves.push([p, target + p.slice(src.rel.length)]);
    if (o.has('verbose') || o.has('dry-run')) g.out(`Renaming ${src.rel} to ${target}\n`);
    if (o.has('dry-run')) continue;
    const node = g.sh.vfs.lookup(join(root, src.rel), g.user);
    mkdirp(g, dirname(join(root, target)));
    if (existsAt(g, join(root, target))) g.sh.vfs.remove(join(root, target), g.user);
    g.sh.vfs.insert(join(root, target), node, g.user);
    g.sh.vfs.remove(join(root, src.rel), g.user);
  }
  if (!o.has('dry-run')) {
    for (const [from, to] of moves) {
      idx.entries[to] = idx.entries[from];
      delete idx.entries[from];
    }
    writeIndex(r, idx);
  }
  return 0;
};

// branch

const cmdBranch: Sub = (g, args) => {
  const o = parseArgs(args, ['d|delete', 'D', 'm|move', 'M', 'l|list', 'a|all', 'r|remotes', 'v|verbose', 'show-current', 'f|force', 'u|set-upstream-to=', 'unset-upstream', 'c|copy'], 'branch');
  const r = needRepo(g);
  const head = readHead(r);
  if (o.has('show-current')) {
    if (head.branch) g.out(head.branch + '\n');
    return 0;
  }
  if (o.has('delete') || o.has('D')) {
    if (!o.operands.length) fatal('branch name required');
    const force = o.has('D') || o.has('force');
    let code = 0;
    for (const b of o.operands) {
      const ref = o.has('remotes') ? `refs/remotes/${b}` : `refs/heads/${b}`;
      const h = readRef(r, ref);
      if (!h) {
        g.err(`error: ${o.has('remotes') ? 'remote-tracking ' : ''}branch '${b}' not found\n`);
        code = 1;
        continue;
      }
      if (b === head.branch && !o.has('remotes')) {
        g.err(`error: cannot delete branch '${b}' used by worktree at '${r.root ?? r.gitDir}'\n`);
        code = 1;
        continue;
      }
      if (!force && !o.has('remotes')) {
        const up = upstreamOf(r, b);
        const upHash = up ? readRef(r, up.ref) : undefined;
        const base = upHash ?? head.hash;
        if (!base || !isAncestor(r, h, base)) {
          g.err(`error: the branch '${b}' is not fully merged\n`);
          g.hint(`If you are sure you want to delete it, run 'git branch -D ${b}'\nDisable this message with "git config set advice.forceDeleteBranch false"`);
          code = 1;
          continue;
        }
      }
      deleteRef(r, ref);
      if (!o.has('remotes')) {
        const cfg = gpath(r, 'config');
        let text = readText(g, cfg) ?? '';
        text = setConfigText(text, { section: 'branch', sub: b, name: 'remote' }, null);
        text = setConfigText(text, { section: 'branch', sub: b, name: 'merge' }, null);
        writeText(g, cfg, text.replace(new RegExp(`\\[branch "${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]\\n(?=\\[|$)`), ''));
      }
      g.out(`Deleted ${o.has('remotes') ? 'remote-tracking branch' : 'branch'} ${b} (was ${short(h)}).\n`);
    }
    return code;
  }
  if (o.has('move') || o.has('M')) {
    const [a, b] = o.operands.length === 1 ? [head.branch ?? fatal('cannot rename the current branch while not on any'), o.operands[0]] : o.operands;
    if (!a || !b) fatal('branch name required');
    checkBranchName(g, b);
    const h = readRef(r, `refs/heads/${a}`);
    const isCurrent = a === head.branch;
    if (!h && !isCurrent) fatal(`no branch named '${a}'`);
    if (branchExists(r, b) && !o.has('M') && a !== b) fatal(`a branch named '${b}' already exists`);
    if (h) {
      deleteRef(r, `refs/heads/${a}`);
      writeRef(r, `refs/heads/${b}`, h);
    }
    if (isCurrent) setHeadBranch(r, b);
    return 0;
  }
  if (o.has('set-upstream-to')) {
    const up = o.get('set-upstream-to')!;
    const b = o.operands[0] ?? head.branch ?? fatal('could not set upstream of HEAD to ' + up + ' when it does not point to any branch.');
    const m = /^([^/]+)\/(.+)$/.exec(up);
    if (!m || !readRef(r, `refs/remotes/${up}`)) fatal(`the requested upstream branch '${up}' does not exist`);
    setConfig(g, gpath(r, 'config'), `branch.${b}.remote`, m![1]);
    setConfig(g, gpath(r, 'config'), `branch.${b}.merge`, `refs/heads/${m![2]}`);
    g.out(`branch '${b}' set up to track '${up}'.\n`);
    return 0;
  }
  if (o.has('unset-upstream')) {
    const b = o.operands[0] ?? head.branch!;
    const cfg = gpath(r, 'config');
    let text = readText(g, cfg) ?? '';
    text = setConfigText(text, { section: 'branch', sub: b, name: 'remote' }, null);
    text = setConfigText(text, { section: 'branch', sub: b, name: 'merge' }, null);
    writeText(g, cfg, text);
    return 0;
  }
  if (o.operands.length && !o.has('list')) {
    const [name, start] = o.operands;
    checkBranchName(g, name);
    if (branchExists(r, name) && !o.has('force')) fatal(`a branch named '${name}' already exists`);
    if (name === head.branch && o.has('force')) fatal(`cannot force update the branch '${name}' used by worktree at '${r.root}'`);
    if (!start && !head.hash) fatal(`not a valid object name: '${head.branch ?? 'HEAD'}'`);
    const h = start ? needCommit(r, start) : head.hash!;
    writeRef(r, `refs/heads/${name}`, h);
    if (start && readRef(r, `refs/remotes/${start}`) && /^[^/]+\/.+$/.test(start)) {
      const [remote, ...rest] = start.split('/');
      setConfig(g, gpath(r, 'config'), `branch.${name}.remote`, remote);
      setConfig(g, gpath(r, 'config'), `branch.${name}.merge`, `refs/heads/${rest.join('/')}`);
      g.out(`branch '${name}' set up to track '${start}'.\n`);
    }
    return 0;
  }
  // Lista grenar.
  const rows: { name: string; current: boolean; remote: boolean; hash: string }[] = [];
  if (!o.has('remotes')) {
    if (!head.branch && head.hash) rows.push({ name: `(HEAD detached at ${short(head.hash)})`, current: true, remote: false, hash: head.hash });
    for (const b of listRefs(r, 'refs/heads/')) rows.push({ name: b, current: b === head.branch, remote: false, hash: readRef(r, `refs/heads/${b}`)! });
  }
  if (o.has('all') || o.has('remotes')) {
    for (const b of listRefs(r, 'refs/remotes/')) {
      const raw = (readText(g, gpath(r, `refs/remotes/${b}`)) ?? '').trim();
      const name = (o.has('all') ? 'remotes/' : '') + b + (raw.startsWith('ref: refs/remotes/') ? ` -> ${raw.slice('ref: refs/remotes/'.length)}` : '');
      rows.push({ name, current: false, remote: true, hash: readRef(r, `refs/remotes/${b}`) ?? '' });
    }
  }
  const nameW = Math.max(0, ...rows.map((x) => x.name.length));
  for (const row of rows) {
    const color = row.current ? C.green : row.remote ? C.red : '';
    let line = `${row.current ? '* ' : '  '}${color ? g.c(color, row.name) : row.name}`;
    if (o.has('verbose') && row.hash) {
      line += ' '.repeat(nameW - row.name.length) + ` ${g.c(C.yellow, short(row.hash))} `;
      if (!row.remote && !row.name.startsWith('(')) {
        const up = upstreamOf(r, row.name);
        if (up && o.opts.get('verbose')!.length > 1) line += `[${g.c(C.blue, up.name)}] `;
      }
      line += subject(readCommit(r, row.hash));
    }
    g.out(line + '\n');
  }
  return 0;
};

// switch / checkout

function detachedAdvice(g: G, r: Repo, h: string, rev: string): void {
  if (configBool(getConfig(g, r, 'advice.detachedHead'), true)) {
    g.err(
      `Note: switching to '${rev}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nOr undo this operation with:\n\n  git switch -\n\nTurn off this advice by setting config variable advice.detachedHead to false\n\n`,
    );
  }
  g.err(`HEAD is now at ${short(h)} ${subject(readCommit(r, h))}\n`);
}

/** Byter gren (eller till en frikopplad commit) och uppdaterar arbetskatalogen. */
function doSwitch(r: Repo, target: { branch?: string; create?: string; detach?: string; force?: boolean; startRev?: string; track?: string }): number {
  const g = r.g;
  const head = readHead(r);
  const fromName = head.branch ?? head.hash ?? 'HEAD';
  let newHash: string | undefined;
  if (target.create) {
    newHash = target.startRev ? needCommit(r, target.startRev) : head.hash;
  } else if (target.branch) {
    newHash = readRef(r, `refs/heads/${target.branch}`);
  } else newHash = target.detach;
  if (target.branch && target.branch === head.branch && !target.create) {
    g.err(`Already on '${target.branch}'\n`);
    if (head.hash) g.err(trackingText(r, head.branch, head.hash));
    return 0;
  }
  if (newHash && newHash !== head.hash) switchTree(r, commitTree(r, head.hash), commitTree(r, newHash), 'checkout', target.force);
  else if (target.force && newHash) switchTree(r, commitTree(r, head.hash), commitTree(r, newHash), 'checkout', true);
  if (target.create) {
    if (newHash) writeRef(r, `refs/heads/${target.create}`, newHash);
    setHeadBranch(r, target.create);
    if (target.track) {
      const [remote, ...rest] = target.track.split('/');
      setConfig(g, gpath(r, 'config'), `branch.${target.create}.remote`, remote);
      setConfig(g, gpath(r, 'config'), `branch.${target.create}.merge`, `refs/heads/${rest.join('/')}`);
      g.out(`branch '${target.create}' set up to track '${target.track}'.\n`);
    }
  } else if (target.branch) setHeadBranch(r, target.branch);
  else setHeadDetached(r, newHash!);
  const toName = target.create ?? target.branch ?? newHash!;
  if (newHash) reflog(r, head.hash, newHash, `checkout: moving from ${fromName} to ${toName}`);
  // Lokala ändringar som följer med visas som i riktiga git.
  if (r.root) {
    const s = computeStatus(r);
    const changed = new Map<string, string>();
    for (const ch of s.staged) changed.set(ch.path, ch.status === 'R' ? 'A' : ch.status);
    for (const ch of s.unstaged) changed.set(ch.path, ch.status);
    for (const p of [...changed.keys()].sort()) g.out(`${changed.get(p)}\t${show(r, p)}\n`);
  }
  if (target.detach) {
    detachedAdvice(g, r, newHash!, target.startRev ?? short(newHash!));
    return 0;
  }
  if (!head.branch && head.hash && !target.create) g.err(`Previous HEAD position was ${short(head.hash)} ${subject(readCommit(r, head.hash))}\n`);
  g.err(target.create ? `Switched to a new branch '${target.create}'\n` : `Switched to branch '${target.branch}'\n`);
  const nb = target.create ?? target.branch!;
  const h = readRef(r, `refs/heads/${nb}`);
  if (h) g.out(trackingText(r, nb, h));
  return 0;
}

/** Om bara origin/<namn> finns skapar git en lokal gren som följer den. */
function remoteGuess(r: Repo, name: string): string | null {
  const hits = listRefs(r, 'refs/remotes/').filter((x) => x.split('/').slice(1).join('/') === name);
  return hits.length === 1 ? hits[0] : null;
}

const cmdSwitch: Sub = (g, args) => {
  const o = parseArgs(args, ['c|create=', 'C|force-create=', 'd|detach', 'f|force|discard-changes', 't|track', 'q|quiet'], 'switch');
  const r = needRepo(g);
  needWork(r);
  if (existsAt(g, gpath(r, 'MERGE_HEAD')) && !o.has('force')) fatal('cannot switch branch while merging\nConsider "git merge --quit" or "git worktree add".');
  const create = o.get('create') ?? o.get('force-create');
  if (create) {
    checkBranchName(g, create);
    if (branchExists(r, create) && !o.has('force-create')) fatal(`a branch named '${create}' already exists`);
    const start = o.operands[0];
    const track = start && readRef(r, `refs/remotes/${start}`) ? start : undefined;
    return doSwitch(r, { create, startRev: start, force: o.has('force'), track });
  }
  let name = o.operands[0];
  if (!name) fatal('missing branch or commit argument');
  if (name === '-') name = previousBranch(r) ?? fatal('invalid reference: @{-1}');
  if (o.has('detach')) return doSwitch(r, { detach: needCommit(r, name), startRev: name, force: o.has('force') });
  if (branchExists(r, name)) return doSwitch(r, { branch: name, force: o.has('force') });
  if (/^[0-9a-f]{40}$/.test(name) && resolveCommit(r, name)) return doSwitch(r, { detach: name, startRev: short(name), force: o.has('force') });
  const remote = remoteGuess(r, name);
  if (remote) return doSwitch(r, { create: name, startRev: remote, track: remote, force: o.has('force') });
  if (resolveCommit(r, name)) {
    g.err(`fatal: a branch is expected, got ${readRef(r, `refs/tags/${name}`) ? 'tag' : 'commit'} '${name}'\n`);
    g.hint('If you want to detach HEAD at the commit, try again with the --detach option.');
    return 128;
  }
  return fatal(`invalid reference: ${name}`);
};

const cmdCheckout: Sub = (g, args) => {
  const o = parseArgs(args, ['b=', 'B=', 'f|force', 'q|quiet', 'detach', 'ours', 'theirs', 't|track'], 'checkout');
  const r = needRepo(g);
  needWork(r);
  const create = o.get('b') ?? o.get('B');
  if (create) {
    checkBranchName(g, create);
    if (branchExists(r, create) && !o.has('B')) fatal(`a branch named '${create}' already exists`);
    const start = o.operands[0];
    const track = start && readRef(r, `refs/remotes/${start}`) ? start : undefined;
    return doSwitch(r, { create, startRev: start, force: o.has('force'), track });
  }
  if (o.paths !== null || o.has('ours') || o.has('theirs')) {
    const source = o.operands[0];
    const paths = o.paths !== null ? o.paths : o.operands;
    if (o.paths !== null && o.operands.length > 1) fatal('only one reference expected');
    if (!paths.length) fatal('you must specify path(s) to restore');
    return restorePaths(r, paths, { worktree: true, staged: !!(source && o.paths !== null), source: o.paths !== null ? source : undefined, ours: o.has('ours'), theirs: o.has('theirs'), checkoutStyle: true });
  }
  let name = o.operands[0];
  if (!name) return 0;
  if (name === '-') name = previousBranch(r) ?? fatal('invalid reference: @{-1}');
  if (o.operands.length === 1) {
    if (existsAt(g, gpath(r, 'MERGE_HEAD')) && !o.has('force') && (branchExists(r, name) || resolveCommit(r, name))) {
      fail(`error: you need to resolve your current index first`);
    }
    if (branchExists(r, name) && !o.has('detach')) return doSwitch(r, { branch: name, force: o.has('force') });
    const h = resolveCommit(r, name);
    if (h) return doSwitch(r, { detach: h, startRev: name, force: o.has('force') });
    const remote = remoteGuess(r, name);
    if (remote) return doSwitch(r, { create: name, startRev: remote, track: remote, force: o.has('force') });
  }
  // Annars är det filer: ta tillbaka versionen från indexet.
  const isRev = o.operands.length > 1 && resolveCommit(r, o.operands[0]);
  const paths = isRev ? o.operands.slice(1) : o.operands;
  return restorePaths(r, paths, { worktree: true, staged: !!isRev, source: isRev ? o.operands[0] : undefined, checkoutStyle: true });
};

// merge

function mergeInto(r: Repo, theirs: string, label: string, opts: { noFf?: boolean; ffOnly?: boolean; message?: string; reflogName: string; squash?: boolean }): number {
  const g = r.g;
  const head = readHead(r);
  if (!head.hash) {
    // Tom gren: "merge" blir bara att peka på den andra commiten.
    switchTree(r, {}, commitTree(r, theirs), 'merge');
    moveHead(r, theirs, `merge ${opts.reflogName}: Fast-forward`);
    return 0;
  }
  if (head.hash === theirs || isAncestor(r, theirs, head.hash)) {
    g.out('Already up to date.\n');
    return 0;
  }
  const base = mergeBase(r, head.hash, theirs);
  const ourTree = commitTree(r, head.hash);
  const theirTree = commitTree(r, theirs);
  if (base === head.hash && !opts.noFf) {
    switchTree(r, ourTree, theirTree, 'merge');
    moveHead(r, theirs, `merge ${opts.reflogName}: Fast-forward`);
    g.out(`Updating ${short(head.hash)}..${short(theirs)}\nFast-forward\n${statText(r, treeChanges(ourTree, theirTree), false)}`);
    return 0;
  }
  if (opts.ffOnly) {
    g.hint(
      "Diverging branches can't be fast-forwarded, you need to either:\n\n\tgit merge --no-ff\n\nor:\n\n\tgit rebase\n\nDisable this message with \"git config set advice.diverging false\"",
    );
    return fatal('Not possible to fast-forward, aborting.');
  }
  const baseTree = commitTree(r, base ?? undefined);
  const result: Tree = {};
  const unmerged: Record<string, Unmerged> = {};
  const conflictFiles: Record<string, string> = {};
  const messages: string[] = [];
  const paths = [...new Set([...Object.keys(baseTree), ...Object.keys(ourTree), ...Object.keys(theirTree)])].sort();
  for (const p of paths) {
    const b = baseTree[p];
    const o = ourTree[p];
    const t = theirTree[p];
    if (o === t || t === b) {
      if (o) result[p] = o;
      continue;
    }
    if (o === b) {
      if (t) result[p] = t;
      continue;
    }
    // Båda sidor har ändrat filen.
    if (!o || !t) {
      const deletedIn = !o ? 'HEAD' : label;
      const modifiedIn = !o ? label : 'HEAD';
      messages.push(`CONFLICT (modify/delete): ${p} deleted in ${deletedIn} and modified in ${modifiedIn}.  Version ${modifiedIn} of ${p} left in tree.`);
      unmerged[p] = { base: b, ours: o, theirs: t };
      conflictFiles[p] = readBlob(r, (o ?? t)!);
      if (o) result[p] = o;
      continue;
    }
    messages.push(`Auto-merging ${p}`);
    const m = merge3(b ? readBlob(r, b) : '', readBlob(r, o), readBlob(r, t), 'HEAD', label);
    if (m.conflict) {
      messages.push(`CONFLICT (${b ? 'content' : 'add/add'}): Merge conflict in ${p}`);
      unmerged[p] = { base: b, ours: o, theirs: t };
      conflictFiles[p] = m.text;
      result[p] = o;
    } else result[p] = writeObj(r, 'blob', m.text);
  }
  // Kontrollera lokala ändringar innan något skrivs.
  const idx = switchTree(r, ourTree, result, 'merge', false, Object.keys(unmerged));
  for (const [p, text] of Object.entries(conflictFiles)) writeWorkFile(r, p, text);
  for (const p of Object.keys(unmerged)) {
    idx.unmerged[p] = unmerged[p];
    if (!unmerged[p].ours) delete idx.entries[p];
  }
  writeIndex(r, idx);
  const into = head.branch && !['main', 'master'].includes(head.branch) ? ` into ${head.branch}` : '';
  const message = opts.message ? cleanMessage(opts.message) : `Merge ${label.startsWith('origin/') || label.includes('/') ? 'remote-tracking branch' : 'branch'} '${label}'${into}\n`;
  if (messages.length) g.out(messages.map((m) => m + '\n').join(''));
  if (Object.keys(unmerged).length) {
    writeText(g, gpath(r, 'MERGE_HEAD'), theirs + '\n');
    writeText(g, gpath(r, 'MERGE_MODE'), opts.noFf ? 'no-ff' : '');
    writeText(g, gpath(r, 'MERGE_MSG'), `${message}\n# Conflicts:\n${Object.keys(unmerged).map((p) => `#\t${p}\n`).join('')}`);
    g.out('Automatic merge failed; fix conflicts and then commit the result.\n');
    return 1;
  }
  const id = identity(g, r)!;
  const h = writeCommit(r, { tree: writeTree(r, result), parents: [head.hash, theirs], author: id, committer: id, message });
  moveHead(r, h, `merge ${opts.reflogName}: Merge made by the 'ort' strategy.`);
  g.out(`Merge made by the 'ort' strategy.\n${statText(r, treeChanges(ourTree, result), false)}`);
  return 0;
}

const cmdMerge: Sub = (g, args) => {
  const o = parseArgs(args, ['no-ff', 'ff', 'ff-only', 'm|message=', 'abort', 'continue', 'no-edit', 'e|edit', 'q|quiet', 'squash'], 'merge');
  const r = needRepo(g);
  needWork(r);
  const mergeHead = readText(g, gpath(r, 'MERGE_HEAD'));
  if (o.has('abort')) {
    if (!mergeHead) fatal('There is no merge to abort (MERGE_HEAD missing).');
    const head = readHead(r);
    const idx = readIndex(r);
    const t = commitTree(r, head.hash);
    for (const p of new Set([...Object.keys(idx.entries), ...Object.keys(idx.unmerged)])) {
      if (!(p in t)) removeWorkFile(r, p);
    }
    for (const [p, h] of Object.entries(t)) writeWorkFile(r, p, readBlob(r, h));
    writeIndex(r, { entries: { ...t }, unmerged: {} });
    for (const f of ['MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE']) removeFile(g, gpath(r, f));
    return 0;
  }
  if (o.has('continue')) {
    if (!mergeHead) fatal('There is no merge in progress (MERGE_HEAD missing).');
    return cmdCommit(g, []);
  }
  if (mergeHead) fatal('You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.');
  if (o.has('squash')) {
    g.note('(git merge --squash stöds inte i simulatorn.)', '(git merge --squash is not supported in the simulator.)');
    return 1;
  }
  let name = o.operands[0];
  const head = readHead(r);
  if (!name) {
    const up = head.branch ? upstreamOf(r, head.branch) : null;
    if (!up) fatal('No remote for the current branch.');
    name = up!.name;
  }
  if (o.operands.length > 1) {
    g.note('(Att slå ihop flera grenar på en gång (octopus) stöds inte i simulatorn.)', '(Merging several branches at once (octopus) is not supported in the simulator.)');
    return 1;
  }
  if (name === '-') name = previousBranch(r) ?? fatal('No previous branch.');
  const theirs = resolveCommit(r, name) ?? fatal(`${name} - not something we can merge`);
  return mergeInto(r, theirs!, name, {
    noFf: o.has('no-ff') || getConfig(g, r, 'merge.ff') === 'false',
    ffOnly: o.has('ff-only') || getConfig(g, r, 'merge.ff') === 'only',
    message: o.opts.get('message')?.join('\n\n'),
    reflogName: name,
  });
};

// reset

const cmdReset: Sub = (g, args) => {
  const o = parseArgs(args, ['soft', 'mixed', 'hard', 'q|quiet', 'keep', 'merge'], 'reset');
  const r = needRepo(g);
  const head = readHead(r);
  let rev = 'HEAD';
  let paths = o.paths ?? [];
  const ops = [...o.operands];
  if (ops.length && resolveCommit(r, ops[0]) && (o.paths !== null || ops.length === 1 || !existsAt(g, resolvePath(g.cwd, ops[0])))) rev = ops.shift()!;
  paths = [...ops, ...paths];
  if (paths.length) {
    if (o.has('hard') || o.has('soft')) fatal(`Cannot do ${o.has('hard') ? 'hard' : 'soft'} reset with paths.`);
    needWork(r);
    const t = rev === 'HEAD' && !head.hash ? {} : (revTree(r, rev) ?? fatal(`Failed to resolve '${rev}' as a valid revision.`));
    const specs = paths.map((p) => toSpec(r, p));
    const idx = readIndex(r);
    for (const p of new Set([...Object.keys(idx.entries), ...Object.keys(t!)])) {
      if (!specs.some((s) => specMatch(s, p))) continue;
      if (t![p]) idx.entries[p] = t![p];
      else delete idx.entries[p];
      delete idx.unmerged[p];
    }
    writeIndex(r, idx);
    printUnstaged(r, o.has('quiet'));
    return 0;
  }
  const target = rev === 'HEAD' && !head.hash ? undefined : (resolveCommit(r, rev) ?? fatal(`ambiguous argument '${rev}': unknown revision or path not in the working tree.`));
  const t = commitTree(r, target);
  if (o.has('hard')) {
    needWork(r);
    switchTree(r, commitTree(r, head.hash), t, 'checkout', true);
  } else if (!o.has('soft')) {
    writeIndex(r, { entries: { ...t }, unmerged: {} });
  }
  for (const f of ['MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE']) removeFile(g, gpath(r, f));
  if (target && target !== head.hash) moveHead(r, target, `reset: moving to ${rev}`);
  if (o.has('hard')) {
    if (target && !o.has('quiet')) g.out(`HEAD is now at ${short(target)} ${subject(readCommit(r, target))}\n`);
  } else if (!o.has('soft') && r.root) printUnstaged(r, o.has('quiet'));
  return 0;
};

function printUnstaged(r: Repo, quiet: boolean): void {
  if (quiet) return;
  const s = computeStatus(r);
  if (!s.unstaged.length) return;
  r.g.out(`Unstaged changes after reset:\n${s.unstaged.map((c) => `${c.status}\t${c.path}\n`).join('')}`);
}

// show

const cmdShow: Sub = (g, args) => {
  const o = parseArgs(args, ['stat', 'name-only', 'name-status', 'oneline', 's|no-patch', 'pretty=', 'format='], 'show');
  const r = needRepo(g);
  const targets = o.operands.length ? o.operands : ['HEAD'];
  const deco = g.tty ? decorations(r) : null;
  targets.forEach((rev, n) => {
    if (n) g.out('\n');
    const colon = rev.indexOf(':');
    if (colon >= 0) {
      const t = revTree(r, rev.slice(0, colon) || 'HEAD') ?? fatal(`invalid object name '${rev.slice(0, colon)}'.`);
      let p = rev.slice(colon + 1);
      if (p.startsWith('./') && r.root) p = toSpec(r, p).rel;
      const h = t![p];
      if (!h) {
        const dir = Object.keys(t!).filter((x) => x.startsWith(p ? p + '/' : ''));
        if (!dir.length) fatal(`path '${p}' does not exist in '${rev.slice(0, colon) || 'HEAD'}'`);
        g.out(`tree ${rev}\n\n${[...new Set(dir.map((x) => x.slice(p ? p.length + 1 : 0).split('/')[0] + (x.slice(p ? p.length + 1 : 0).includes('/') ? '/' : '')))].join('\n')}\n`);
        return;
      }
      g.out(readBlob(r, h));
      return;
    }
    const h = resolveRev(r, rev);
    if (!h) {
      if (rev === 'HEAD') fatal(`your current branch '${readHead(r).branch}' does not have any commits yet`);
      fail(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`, 128);
    }
    const obj = readObj(r, h!)!;
    if (obj.type === 'blob') {
      g.out(obj.data);
      return;
    }
    if (obj.type === 'tree') {
      g.out(`tree ${rev}\n\n${Object.keys(readTree(r, h!)).join('\n')}\n`);
      return;
    }
    let ch = h!;
    if (obj.type === 'tag') {
      const tag = /\ntag (.*)\ntagger (.*)\n\n([\s\S]*)$/.exec(obj.data);
      if (tag) {
        const t = parseIdent(tag[2]);
        g.out(`${g.c(C.yellow, `tag ${tag[1]}`)}\nTagger: ${t.name} <${t.email}>\nDate:   ${fmtDate(t)}\n\n${tag[3]}\n`);
      }
      ch = peel(r, h!);
    }
    const c = readCommit(r, ch);
    if (o.has('oneline')) g.out(`${g.c(C.yellow, short(c.hash))}${decorate(g, deco, c.hash)} ${subject(c)}\n`);
    else g.out(commitHeader(r, c, deco).join('\n') + '\n');
    if (o.has('no-patch') || c.parents.length > 1) return;
    const changes = treeChanges(commitTree(r, c.parents[0]), readTree(r, c.tree));
    if (changes.length && !o.has('oneline')) g.out('\n');
    printPatch(r, changes, o.has('stat') ? 'stat' : o.has('name-only') ? 'name-only' : o.has('name-status') ? 'name-status' : 'patch');
  });
  return 0;
};

// tag

const cmdTag: Sub = (g, args) => {
  const o = parseArgs(args, ['a|annotate', 'm|message=', 'd|delete', 'l|list', 'f|force', 'n'], 'tag');
  const r = needRepo(g);
  if (o.has('delete')) {
    for (const t of o.operands) {
      const h = readRef(r, `refs/tags/${t}`);
      if (!h) fail(`error: tag '${t}' not found.`);
      deleteRef(r, `refs/tags/${t}`);
      g.out(`Deleted tag '${t}' (was ${short(h!)})\n`);
    }
    return 0;
  }
  if (!o.operands.length || o.has('list')) {
    for (const t of listRefs(r, 'refs/tags/')) g.out(t + '\n');
    return 0;
  }
  const [name, rev] = o.operands;
  if (!validBranchName(name)) fatal(`'${name}' is not a valid tag name.`);
  if (readRef(r, `refs/tags/${name}`) && !o.has('force')) fatal(`tag '${name}' already exists`);
  const target = needCommit(r, rev ?? 'HEAD');
  if (o.has('annotate') || o.has('message')) {
    const msg = o.opts.get('message')?.join('\n\n');
    if (!msg) {
      g.note('(Simulatorn har ingen editor. Ange meddelandet med -m "…".)', '(The simulator has no editor. Give the message with -m "…".)');
      return 1;
    }
    const id = identity(g, r)!;
    const h = writeObj(r, 'tag', `object ${target}\ntype commit\ntag ${name}\ntagger ${fmtIdent(id)}\n\n${cleanMessage(msg)}`);
    writeRef(r, `refs/tags/${name}`, h);
  } else writeRef(r, `refs/tags/${name}`, target);
  return 0;
};

// clone / remote / fetch / pull / push

const isNetworkUrl = (url: string) => (/^[a-z+]+:\/\//i.test(url) && !url.startsWith('file://')) || /^[^/\s]+@[^/\s]+:/.test(url);

function networkError(g: G, url: string, action: 'clone' | 'fetch' | 'push'): number {
  const host = /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:]+)/i.exec(url)?.[1] ?? /@([^:]+):/.exec(url)?.[1] ?? url;
  if (/^[^/\s]+@[^/\s]+:/.test(url) || url.startsWith('ssh://')) {
    g.err(`ssh: Could not resolve hostname ${host}: Name or service not known\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
  } else g.err(`fatal: unable to access '${url.replace(/\/?$/, '/')}': Could not resolve host: ${host}\n`);
  g.note(
    `(Simulatorn har inget nätverk, så git ${action} kan inte nå ${host}. Det fungerar däremot mot repon på den här datorn, t.ex. git clone ~/projekt-webb ~/kopia.)`,
    `(The simulator has no network, so git ${action} cannot reach ${host}. It does work with repositories on this computer, e.g. git clone ~/projekt-webb ~/kopia.)`,
  );
  return 128;
}

/** Öppnar ett lokalt repo som en "fjärr" (remote). */
function openRemote(g: G, url: string): Repo | null {
  const path = resolvePath(g.cwd, url.replace(/^file:\/\//, '').replace(/^~(?=\/|$)/, g.sh.home));
  if (looksLikeGitDir(g, join(path, '.git'))) return openRepo(g, join(path, '.git'), path);
  if (looksLikeGitDir(g, path)) return openRepo(g, path, null);
  if (!path.endsWith('.git') && looksLikeGitDir(g, path + '.git')) return openRepo(g, path + '.git', null);
  return null;
}

/** Kopierar alla objekt från ett repo till ett annat. */
function copyObjects(from: Repo, to: Repo): void {
  for (const h of allObjects(from)) {
    const p = objPath(to, h);
    if (existsAt(to.g, p)) continue;
    const raw = readText(from.g, objPath(from, h));
    if (raw !== null) writeText(to.g, p, raw);
  }
}

function remoteUrl(r: Repo, name: string): string | undefined {
  return getConfig(r.g, r, `remote.${name}.url`);
}

/** Hämtar grenar från en fjärr till refs/remotes/<namn>/. Returnerar utskriften. */
function fetchRemote(r: Repo, name: string, quiet = false): number {
  const g = r.g;
  const url = remoteUrl(r, name) ?? (openRemote(g, name) ? name : undefined);
  if (!url) {
    g.err(`fatal: '${name}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
    return 128;
  }
  if (isNetworkUrl(url)) return networkError(g, url, 'fetch');
  const src = openRemote(g, url);
  if (!src) {
    g.err(`fatal: '${url}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
    return 128;
  }
  copyObjects(src, r);
  const lines: string[] = [];
  const named = remoteUrl(r, name) !== undefined;
  const srcHead = readHead(src);
  for (const b of listRefs(src, 'refs/heads/')) {
    const h = readRef(src, `refs/heads/${b}`)!;
    if (!named) continue;
    const ref = `refs/remotes/${name}/${b}`;
    const old = readRef(r, ref);
    if (old === h) continue;
    writeRef(r, ref, h);
    if (!old) lines.push(` * [new branch]      ${b.padEnd(10)} -> ${name}/${b}`);
    else if (isAncestor(r, old, h)) lines.push(`   ${short(old)}..${short(h)}  ${b.padEnd(10)} -> ${name}/${b}`);
    else lines.push(` + ${short(old)}...${short(h)} ${b.padEnd(10)} -> ${name}/${b}  (forced update)`);
  }
  if (named) {
    for (const b of listRefs(r, `refs/remotes/${name}/`)) {
      if (b !== 'HEAD' && !readRef(src, `refs/heads/${b}`)) deleteRef(r, `refs/remotes/${name}/${b}`);
    }
    if (srcHead.branch) writeText(g, gpath(r, `refs/remotes/${name}/HEAD`), `ref: refs/remotes/${name}/${srcHead.branch}\n`);
  }
  const fetchHead = srcHead.hash ? `${srcHead.hash}\t\t${srcHead.branch ? `branch '${srcHead.branch}' of ` : ''}${url}\n` : '';
  writeText(g, gpath(r, 'FETCH_HEAD'), fetchHead);
  if (lines.length && !quiet) g.err(`From ${url}\n${lines.join('\n')}\n`);
  return 0;
}

const cmdClone: Sub = (g, args) => {
  // Paket från AUR (git clone https://aur.archlinux.org/PAKET.git) – se repos.ts.
  const aur = aurClone(g.ctx, args);
  if (aur !== null) return aur;
  const o = parseArgs(args, ['q|quiet', 'bare', 'b|branch=', 'o|origin=', 'depth='], 'clone');
  const [url, dirArg] = o.operands;
  if (!url) fail('fatal: You must specify a repository to clone.\n\nusage: git clone [<options>] [--] <repo> [<dir>]', 129);
  const name = dirArg ?? (url.replace(/\/+$/, '').replace(/\/\.git$/, '').split(/[/:]/).pop() ?? 'repo').replace(/\.git$/, '') + (o.has('bare') ? '.git' : '');
  const dest = resolvePath(g.cwd, name.replace(/^~(?=\/|$)/, g.sh.home));
  const destNode = g.sh.vfs.tryLookup(dest, g.user);
  if (destNode && (destNode.type !== 'dir' || Object.keys(destNode.children ?? {}).length)) fatal(`destination path '${dirArg ?? name}' already exists and is not an empty directory.`);
  if (!o.has('quiet')) g.err(`Cloning into ${o.has('bare') ? 'bare repository ' : ''}'${dirArg ?? name}'...\n`);
  if (isNetworkUrl(url)) return networkError(g, url, 'clone');
  const src = openRemote(g, url);
  if (!src) {
    if (!existsAt(g, resolvePath(g.cwd, url.replace(/^~(?=\/|$)/, g.sh.home)))) return fatal(`repository '${url}' does not exist`);
    g.err(`fatal: '${url}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
    return 128;
  }
  const srcHead = readHead(src);
  const branch = o.get('branch') ?? srcHead.branch ?? 'main';
  if (o.get('branch') && !readRef(src, `refs/heads/${branch}`)) fatal(`Remote branch ${branch} not found in upstream origin`);
  const { gitDir } = initRepo(g, dest, o.has('bare'), branch);
  const r = openRepo(g, gitDir, o.has('bare') ? null : dest);
  const remote = o.get('origin') ?? 'origin';
  const abs = src.root ?? src.gitDir;
  copyObjects(src, r);
  if (o.has('bare')) {
    for (const b of listRefs(src, 'refs/heads/')) writeRef(r, `refs/heads/${b}`, readRef(src, `refs/heads/${b}`)!);
    for (const t of listRefs(src, 'refs/tags/')) writeRef(r, `refs/tags/${t}`, readRef(src, `refs/tags/${t}`)!);
    if (!o.has('quiet')) g.err('done.\n');
    return 0;
  }
  const cfg = gpath(r, 'config');
  setConfig(g, cfg, `remote.${remote}.url`, abs);
  setConfig(g, cfg, `remote.${remote}.fetch`, `+refs/heads/*:refs/remotes/${remote}/*`);
  fetchRemote(r, remote, true);
  for (const t of listRefs(src, 'refs/tags/')) writeRef(r, `refs/tags/${t}`, readRef(src, `refs/tags/${t}`)!);
  const h = readRef(src, `refs/heads/${branch}`);
  if (h) {
    writeRef(r, `refs/heads/${branch}`, h);
    setConfig(g, cfg, `branch.${branch}.remote`, remote);
    setConfig(g, cfg, `branch.${branch}.merge`, `refs/heads/${branch}`);
    const t = commitTree(r, h);
    for (const [p, bh] of Object.entries(t)) writeWorkFile(r, p, readBlob(r, bh));
    writeIndex(r, { entries: { ...t }, unmerged: {} });
    reflog(r, undefined, h, `clone: from ${abs}`);
    if (!o.has('quiet')) g.err('done.\n');
  } else g.err('warning: You appear to have cloned an empty repository.\n');
  return 0;
};

const cmdRemote: Sub = (g, args) => {
  const sub = args[0] && !args[0].startsWith('-') ? args[0] : null;
  const o = parseArgs(sub ? args.slice(1) : args, ['v|verbose'], 'remote');
  const r = needRepo(g);
  const names = [...new Set(configAll(g, r).filter((e) => e.scope === 'local' && /^remote\..*\.url$/.test(e.key)).map((e) => e.key.slice(7, -4)))];
  const cfg = gpath(r, 'config');
  if (!sub) {
    for (const n of names) {
      if (o.has('verbose')) g.out(`${n}\t${remoteUrl(r, n)} (fetch)\n${n}\t${remoteUrl(r, n)} (push)\n`);
      else g.out(n + '\n');
    }
    return 0;
  }
  const [a, b] = o.operands;
  switch (sub) {
    case 'add':
      if (!a || !b) fail('usage: git remote add [<options>] <name> <url>', 129);
      if (names.includes(a)) fail(`error: remote ${a} already exists.`, 3);
      setConfig(g, cfg, `remote.${a}.url`, b);
      setConfig(g, cfg, `remote.${a}.fetch`, `+refs/heads/*:refs/remotes/${a}/*`);
      return 0;
    case 'remove':
    case 'rm': {
      if (!a || !names.includes(a)) fail(`error: No such remote: '${a ?? ''}'`, 2);
      let text = readText(g, cfg) ?? '';
      text = setConfigText(text, { section: 'remote', sub: a, name: 'url' }, null);
      text = setConfigText(text, { section: 'remote', sub: a, name: 'fetch' }, null);
      writeText(g, cfg, text.replace(new RegExp(`\\[remote "${a}"\\]\\n(?=\\[|$)`), ''));
      for (const ref of listRefs(r, `refs/remotes/${a}/`)) deleteRef(r, `refs/remotes/${a}/${ref}`);
      return 0;
    }
    case 'get-url':
      if (!a || !names.includes(a)) fail(`error: No such remote '${a ?? ''}'`, 2);
      g.out(remoteUrl(r, a) + '\n');
      return 0;
    case 'set-url':
      if (!a || !b) fail('usage: git remote set-url [--push] <name> <newurl> [<oldurl>]', 129);
      if (!names.includes(a)) fail(`error: No such remote '${a}'`, 2);
      setConfig(g, cfg, `remote.${a}.url`, b);
      return 0;
    case 'show':
      for (const n of a ? [a] : names) g.out(`* remote ${n}\n  Fetch URL: ${remoteUrl(r, n)}\n  Push  URL: ${remoteUrl(r, n)}\n`);
      return 0;
    default:
      fail(`error: unknown subcommand: \`${sub}'`, 129);
  }
  return 0;
};

const cmdFetch: Sub = (g, args) => {
  const o = parseArgs(args, ['all', 'q|quiet', 'prune', 'p'], 'fetch');
  const r = needRepo(g);
  const head = readHead(r);
  const remote = o.operands[0] ?? (head.branch ? getConfig(g, r, `branch.${head.branch}.remote`) : undefined) ?? 'origin';
  if (!remoteUrl(r, remote) && !o.operands[0]) {
    // Inga fjärrar alls: riktiga git säger ingenting.
    return 0;
  }
  return fetchRemote(r, remote, o.has('quiet'));
};

const cmdPull: Sub = (g, args) => {
  const o = parseArgs(args, ['ff-only', 'no-ff', 'rebase', 'no-rebase', 'q|quiet'], 'pull');
  const r = needRepo(g);
  needWork(r);
  const head = readHead(r);
  if (o.has('rebase')) {
    g.note('(git pull --rebase stöds inte i simulatorn – kör git pull utan --rebase.)', '(git pull --rebase is not supported in the simulator – run git pull without --rebase.)');
    return 1;
  }
  const up = head.branch ? upstreamOf(r, head.branch) : null;
  const remote = o.operands[0] ?? up?.remote;
  if (!remote) {
    fail(
      `There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=origin/<branch> ${head.branch ?? ''}`,
      1,
    );
  }
  const code = fetchRemote(r, remote!);
  if (code) return code;
  const branch = o.operands[1] ?? (up && up.remote === remote ? up.ref.slice(`refs/remotes/${remote}/`.length) : head.branch);
  const ref = `refs/remotes/${remote}/${branch}`;
  const theirs = readRef(r, ref) ?? (remoteUrl(r, remote!) ? undefined : readText(g, gpath(r, 'FETCH_HEAD'))?.split('\t')[0]);
  if (!theirs) fatal(`couldn't find remote ref ${branch}`);
  return mergeInto(r, theirs!, `${remote}/${branch}`, { ffOnly: o.has('ff-only'), noFf: o.has('no-ff'), reflogName: `${remote}/${branch}` });
};

const cmdPush: Sub = (g, args) => {
  const o = parseArgs(args, ['u|set-upstream', 'f|force', 'all', 'd|delete', 'q|quiet', 'tags'], 'push');
  const r = needRepo(g);
  const head = readHead(r);
  const up = head.branch ? upstreamOf(r, head.branch) : null;
  const remotes = configAll(g, r).filter((e) => e.scope === 'local' && /^remote\..*\.url$/.test(e.key));
  const remote = o.operands[0] ?? up?.remote ?? (remotes.length === 1 ? remotes[0].key.slice(7, -4) : undefined);
  if (!remote) {
    fail(
      'fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n',
      128,
    );
  }
  let specs = o.operands.slice(1);
  if (!specs.length) {
    if (o.has('all')) specs = listRefs(r, 'refs/heads/');
    else if (!head.branch) fatal('You are not currently on a branch.\nTo push the history leading to the current (detached HEAD)\nstate now, use\n\n    git push ' + remote + ' HEAD:<name-of-remote-branch>\n');
    else if (!up && !o.has('set-upstream'))
      fail(`fatal: The current branch ${head.branch} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream ${remote} ${head.branch}\n`, 128);
    else specs = [up && !o.has('set-upstream') ? `${head.branch}:${up.ref.slice(`refs/remotes/${up.remote}/`.length)}` : head.branch!];
  }
  const url = remoteUrl(r, remote!) ?? remote!;
  if (isNetworkUrl(url)) return networkError(g, url, 'push');
  const dst = openRemote(g, url);
  if (!dst) {
    g.err(`fatal: '${url}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
    return 128;
  }
  const dstHead = readHead(dst);
  const lines: string[] = [];
  let failed = false;
  let rejectedFf = false;
  copyObjects(r, dst);
  for (const spec of specs) {
    const [srcName, dstName0] = spec.includes(':') ? spec.split(':') : [spec, spec];
    const dstName = (dstName0 || srcName).replace(/^refs\/heads\//, '');
    if (o.has('delete')) {
      const old = readRef(dst, `refs/heads/${dstName}`);
      if (!old) {
        g.err(`error: unable to delete '${dstName}': remote ref does not exist\n`);
        failed = true;
        continue;
      }
      deleteRef(dst, `refs/heads/${dstName}`);
      deleteRef(r, `refs/remotes/${remote}/${dstName}`);
      lines.push(` - [deleted]         ${dstName}`);
      continue;
    }
    const h = resolveCommit(r, srcName);
    if (!h) {
      g.err(`error: src refspec ${srcName} does not match any\n`);
      failed = true;
      continue;
    }
    const old = readRef(dst, `refs/heads/${dstName}`);
    const label = `${srcName} -> ${dstName}`;
    if (old === h) {
      lines.push(` = [up to date]      ${label}`);
      continue;
    }
    if (dst.root && dstHead.branch === dstName) {
      g.err(
        `remote: error: refusing to update checked out branch: refs/heads/${dstName}\nremote: error: By default, updating the current branch in a non-bare repository\nremote: is denied, because it will make the index and work tree inconsistent\nremote: with what you pushed, and will require 'git reset --hard' to match\nremote: the work tree to HEAD.\n`,
      );
      lines.push(` ! [remote rejected] ${label} (branch is currently checked out)`);
      failed = true;
      continue;
    }
    if (old && !isAncestor(r, old, h) && !o.has('force')) {
      lines.push(` ! [rejected]        ${label} (${readObj(r, old) ? 'non-fast-forward' : 'fetch first'})`);
      failed = true;
      rejectedFf = true;
      continue;
    }
    writeRef(dst, `refs/heads/${dstName}`, h);
    if (remoteUrl(r, remote!)) writeRef(r, `refs/remotes/${remote}/${dstName}`, h);
    if (!old) lines.push(` * [new branch]      ${label}`);
    else if (isAncestor(r, old, h)) lines.push(`   ${short(old)}..${short(h)}  ${label}`);
    else lines.push(` + ${short(old)}...${short(h)} ${label} (forced update)`);
    if (o.has('set-upstream') && remoteUrl(r, remote!)) {
      const local = srcName === 'HEAD' ? head.branch : srcName;
      if (local && branchExists(r, local)) {
        setConfig(g, gpath(r, 'config'), `branch.${local}.remote`, remote!);
        setConfig(g, gpath(r, 'config'), `branch.${local}.merge`, `refs/heads/${dstName}`);
        lines.push(`branch '${local}' set up to track '${remote}/${dstName}'.`);
      }
    }
  }
  if (lines.length && !o.has('quiet')) {
    const upToDate = lines.every((l) => l.includes('[up to date]'));
    g.err(upToDate ? 'Everything up-to-date\n' : `To ${dst.root ?? dst.gitDir}\n${lines.filter((l) => !l.includes('[up to date]')).join('\n')}\n`);
  }
  if (failed) {
    g.err(`error: failed to push some refs to '${dst.root ?? dst.gitDir}'\n`);
    if (rejectedFf)
      g.hint(
        "Updates were rejected because the tip of your current branch is behind\nits remote counterpart. If you want to integrate the remote changes,\nuse 'git pull' before pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.",
      );
    return 1;
  }
  return 0;
};

// Små hjälpkommandon: reflog, rev-parse, cat-file, hash-object, ls-files, ls-tree

const cmdReflog: Sub = (g, args) => {
  const r = needRepo(g);
  const sub = args[0];
  if (sub && sub !== 'show') {
    g.note('(Bara git reflog [show] stöds i simulatorn.)', '(Only git reflog [show] is supported in the simulator.)');
    return 1;
  }
  const log = readReflog(r).reverse();
  if (!log.length) {
    const head = readHead(r);
    if (!head.hash) fatal(`your current branch '${head.branch}' does not have any commits yet`);
  }
  const deco = g.tty ? decorations(r) : null;
  log.forEach((e, i) => g.out(`${g.c(C.yellow, short(e.to))}${i === 0 ? decorate(g, deco, e.to) : ''} HEAD@{${i}}: ${e.msg}\n`));
  return 0;
};

const cmdRevParse: Sub = (g, args) => {
  const r = discover(g, g.cwd);
  let shortLen = 0;
  let abbrev = false;
  for (const a of args) {
    if (a === '--is-inside-work-tree') {
      g.out(r?.root ? 'true\n' : r ? 'false\n' : '');
      if (!r) fatal('not a git repository (or any of the parent directories): .git');
      continue;
    }
    if (!r) fatal('not a git repository (or any of the parent directories): .git');
    const repo = r!;
    if (a === '--show-toplevel') g.out((repo.root ?? fatal('this operation must be run in a work tree')) + '\n');
    else if (a === '--git-dir') g.out((repo.root && repo.root === g.cwd ? '.git' : repo.gitDir) + '\n');
    else if (a === '--is-bare-repository') g.out(repo.root ? 'false\n' : 'true\n');
    else if (a.startsWith('--short')) shortLen = Number(a.split('=')[1] ?? 7);
    else if (a === '--abbrev-ref') abbrev = true;
    else if (a.startsWith('-')) continue;
    else {
      if (abbrev && (a === 'HEAD' || a === '@')) {
        const head = readHead(repo);
        g.out((head.branch ?? 'HEAD') + '\n');
        continue;
      }
      const h = resolveRev(repo, a);
      if (!h) fail(`${a}\nfatal: ambiguous argument '${a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`, 128);
      g.out((shortLen ? h!.slice(0, shortLen) : h) + '\n');
    }
  }
  return 0;
};

const cmdCatFile: Sub = (g, args) => {
  const o = parseArgs(args, ['p', 't', 's', 'e'], 'cat-file');
  const r = needRepo(g);
  const rev = o.operands[0];
  if (!rev) fail('usage: git cat-file <type> <object>\n   or: git cat-file (-e | -p) <object>\n   or: git cat-file (-t | -s) <object>', 129);
  let h: string | null;
  const colon = rev.indexOf(':');
  if (colon >= 0) h = revTree(r, rev.slice(0, colon) || 'HEAD')?.[rev.slice(colon + 1)] ?? null;
  else h = resolveRev(r, rev);
  if (o.has('e')) return h && readObj(r, h) ? 0 : 1;
  const obj = h ? readObj(r, h) : null;
  if (!obj) fatal(`Not a valid object name ${rev}`);
  if (o.has('t')) g.out(obj!.type + '\n');
  else if (o.has('s')) g.out(utf8len(obj!.data) + '\n');
  else g.out(obj!.data);
  return 0;
};

const cmdHashObject: Sub = (g, args) => {
  const o = parseArgs(args, ['w', 'stdin', 't='], 'hash-object');
  const r = o.has('w') ? needRepo(g) : null;
  const inputs = o.has('stdin') ? [g.ctx.stdin ?? ''] : o.operands.map((f) => readText(g, resolvePath(g.cwd, f)) ?? fatal(`could not open '${f}' for reading: No such file or directory`));
  for (const data of inputs) g.out((r ? writeObj(r, 'blob', data) : blobHash(data)) + '\n');
  return 0;
};

const cmdLsFiles: Sub = (g, args) => {
  const o = parseArgs(args, ['s|stage', 'o|others', 'c|cached', 'u|unmerged', 'exclude-standard', 'i|ignored', 'd|deleted', 'm|modified'], 'ls-files');
  const r = needRepo(g);
  needWork(r);
  const idx = readIndex(r);
  const specs = o.operands.map((p) => toSpec(r, p));
  const pick = (p: string) => !specs.length || specs.some((s) => specMatch(s, p));
  const prefix = relPath(r.root!, g.cwd) === '.' ? '' : relPath(r.root!, g.cwd) + '/';
  const inCwd = (p: string) => p.startsWith(prefix);
  let list: string[];
  if (o.has('others') || o.has('ignored')) {
    const work = scanWork(r);
    list = [...work.files.entries()].filter(([p, w]) => !(p in idx.entries) && (o.has('ignored') ? w.ignored : !o.has('exclude-standard') || !w.ignored)).map(([p]) => p);
  } else if (o.has('deleted') || o.has('modified')) {
    const work = scanWork(r);
    list = Object.keys(idx.entries).filter((p) => (o.has('deleted') && !work.files.has(p)) || (o.has('modified') && work.files.get(p)?.hash !== idx.entries[p]));
  } else list = [...new Set([...Object.keys(idx.entries), ...Object.keys(idx.unmerged)])];
  for (const p of list.filter(pick).filter(inCwd).sort()) {
    const name = p.slice(prefix.length);
    if (o.has('stage')) {
      const u = idx.unmerged[p];
      if (u) {
        ([['base', 1], ['ours', 2], ['theirs', 3]] as const).forEach(([k, n]) => u[k] && g.out(`100644 ${u[k]} ${n}\t${name}\n`));
      } else g.out(`100644 ${idx.entries[p]} 0\t${name}\n`);
    } else g.out(name + '\n');
  }
  return 0;
};

const cmdLsTree: Sub = (g, args) => {
  const o = parseArgs(args, ['r', 'name-only', 'l|long'], 'ls-tree');
  const r = needRepo(g);
  const rev = o.operands[0];
  if (!rev) fail('usage: git ls-tree [<options>] <tree-ish> [<path>...]', 129);
  const t = revTree(r, rev) ?? fatal('Not a valid object name ' + rev);
  const rows = new Map<string, string>();
  for (const [p, h] of Object.entries(t!)) {
    if (o.has('r') || !p.includes('/')) rows.set(p, o.has('name-only') ? p : `100644 blob ${h}\t${p}`);
    else {
      const d = p.split('/')[0];
      if (!rows.has(d)) {
        const sub: Tree = {};
        for (const [q, qh] of Object.entries(t!)) if (q.startsWith(d + '/')) sub[q.slice(d.length + 1)] = qh;
        rows.set(d, o.has('name-only') ? d : `040000 tree ${writeTree(r, sub)}\t${d}`);
      }
    }
  }
  for (const k of [...rows.keys()].sort()) g.out(rows.get(k) + '\n');
  return 0;
};

// stash (förenklad: sparar ändringar i spårade filer)

interface StashEntry {
  base: string;
  branch: string;
  index: Tree;
  work: Tree;
  message: string;
}

function readStash(r: Repo): StashEntry[] {
  const text = readText(r.g, gpath(r, 'stash.json'));
  try {
    return text ? (JSON.parse(text) as StashEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStash(r: Repo, list: StashEntry[]): void {
  if (!list.length) removeFile(r.g, gpath(r, 'stash.json'));
  else writeText(r.g, gpath(r, 'stash.json'), JSON.stringify(list, null, 1) + '\n');
}

const cmdStash: Sub = (g, args) => {
  const sub = args[0] && !args[0].startsWith('-') ? args[0] : 'push';
  const o = parseArgs(args[0] && !args[0].startsWith('-') ? args.slice(1) : args, ['m|message=', 'u|include-untracked', 'q|quiet'], 'stash');
  const r = needRepo(g);
  needWork(r);
  const head = readHead(r);
  const list = readStash(r);
  const where = head.branch ?? '(no branch)';
  const pickIndex = () => {
    const ref = o.operands[0] ?? 'stash@{0}';
    const m = /^(?:stash@\{)?(\d+)\}?$/.exec(ref);
    const n = m ? Number(m[1]) : -1;
    if (!list[n]) fail(`error: ${ref} is not a valid reference`);
    return n;
  };
  switch (sub) {
    case 'push':
    case 'save': {
      if (!head.hash) fatal('You do not have the initial commit yet');
      const s = computeStatus(r);
      if (!s.staged.length && !s.unstaged.length) {
        g.out('No local changes to save\n');
        return 0;
      }
      const work: Tree = {};
      for (const p of Object.keys(s.index.entries)) {
        const w = s.work.files.get(p);
        if (w) work[p] = writeObj(r, 'blob', w.content);
      }
      const c = readCommit(r, head.hash!);
      const message = o.get('message') ? `On ${where}: ${o.get('message')}` : `WIP on ${where}: ${short(c.hash)} ${subject(c)}`;
      list.unshift({ base: head.hash!, branch: where, index: { ...s.index.entries }, work, message });
      writeStash(r, list);
      switchTree(r, commitTree(r, head.hash), commitTree(r, head.hash), 'checkout', true);
      g.out(`Saved working directory and index state ${message}\n`);
      return 0;
    }
    case 'list':
      list.forEach((e, i) => g.out(`stash@{${i}}: ${e.message}\n`));
      return 0;
    case 'show': {
      const e = list[pickIndex()];
      printPatch(r, treeChanges(commitTree(r, e.base), e.work), 'stat');
      return 0;
    }
    case 'drop': {
      const n = pickIndex();
      g.out(`Dropped stash@{${n}} (${list[n].message})\n`);
      list.splice(n, 1);
      writeStash(r, list);
      return 0;
    }
    case 'clear':
      writeStash(r, []);
      return 0;
    case 'pop':
    case 'apply': {
      if (!list.length) fail('No stash entries found.');
      const n = pickIndex();
      const e = list[n];
      const work = scanWork(r);
      const idx = readIndex(r);
      const headTree = commitTree(r, head.hash);
      const baseTree = commitTree(r, e.base);
      const conflicts: string[] = [];
      for (const p of new Set([...Object.keys(e.work), ...Object.keys(baseTree)])) {
        if (e.work[p] === baseTree[p]) continue;
        const cur = work.files.get(p)?.hash;
        if (cur !== headTree[p] && cur !== e.work[p]) conflicts.push(p);
      }
      if (conflicts.length) {
        fail(`error: Your local changes to the following files would be overwritten by merge:\n${conflicts.map((p) => `\t${show(r, p)}\n`).join('')}Please commit your changes or stash them before you merge.\nAborting`);
      }
      for (const p of new Set([...Object.keys(e.work), ...Object.keys(baseTree)])) {
        if (e.work[p] === baseTree[p]) continue;
        if (e.work[p] === undefined) {
          removeWorkFile(r, p);
          continue;
        }
        const cur = headTree[p] !== baseTree[p] && headTree[p] && baseTree[p] ? merge3(readBlob(r, baseTree[p]), readBlob(r, headTree[p]), readBlob(r, e.work[p]), 'Updated upstream', 'Stashed changes') : null;
        if (cur?.conflict) g.out(`CONFLICT (content): Merge conflict in ${p}\n`);
        writeWorkFile(r, p, cur ? cur.text : readBlob(r, e.work[p]));
        if (!(p in idx.entries) && e.index[p]) idx.entries[p] = e.index[p];
      }
      writeIndex(r, idx);
      printLongStatus(r, computeStatus(r));
      if (sub === 'pop') {
        list.splice(n, 1);
        writeStash(r, list);
        g.out(`Dropped stash@{${n}} (${e.message})\n`);
      }
      return 0;
    }
    default:
      fail(`error: unknown subcommand: ${sub}`, 129);
  }
  return 0;
};

// help / version

const COMMON = `usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
           <command> [<args>]

These are common Git commands used in various situations:

start a working area
   clone      Clone a repository into a new directory
   init       Create an empty Git repository or reinitialize an existing one

work on the current change
   add        Add file contents to the index
   mv         Move or rename a file, a directory, or a symlink
   restore    Restore working tree files
   rm         Remove files from the working tree and from the index

examine the history and state
   diff       Show changes between commits, commit and working tree, etc
   log        Show commit logs
   show       Show various types of objects
   status     Show the working tree status

grow, mark and tweak your common history
   branch     List, create, or delete branches
   commit     Record changes to the repository
   merge      Join two or more development histories together
   reset      Reset current HEAD to the specified state
   switch     Switch branches
   tag        Create, list, delete or verify a tag object signed with GPG

collaborate
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
See 'git help git' for an overview of the system.
`;

const SUBS: Record<string, Sub> = {
  init: cmdInit,
  config: cmdConfig,
  status: cmdStatus,
  add: cmdAdd,
  commit: cmdCommit,
  log: cmdLog,
  diff: cmdDiff,
  restore: cmdRestore,
  rm: cmdRm,
  mv: cmdMv,
  branch: cmdBranch,
  switch: cmdSwitch,
  checkout: cmdCheckout,
  merge: cmdMerge,
  reset: cmdReset,
  show: cmdShow,
  tag: cmdTag,
  clone: cmdClone,
  remote: cmdRemote,
  fetch: cmdFetch,
  pull: cmdPull,
  push: cmdPush,
  stash: cmdStash,
  reflog: cmdReflog,
  'rev-parse': cmdRevParse,
  'cat-file': cmdCatFile,
  'hash-object': cmdHashObject,
  'ls-files': cmdLsFiles,
  'ls-tree': cmdLsTree,
};

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function runGit(g: G, args: string[], depth = 0): number {
  // Globala flaggor före underkommandot.
  while (args.length && args[0].startsWith('-')) {
    const a = args[0];
    if (a === '--version' || a === '-v') {
      g.out('git version 2.51.1\n');
      return 0;
    }
    if (a === '--help' || a === '-h') {
      g.out(COMMON);
      return 0;
    }
    if (a === '-C') {
      if (!args[1]) fail('error: no directory given for \'-C\' option\n', 129);
      const dir = resolvePath(g.cwd, args[1].replace(/^~(?=\/|$)/, g.sh.home));
      if (!isDirAt(g, dir)) fatal(`cannot change to '${args[1]}': No such file or directory`);
      g.cwd = dir;
      args = args.slice(2);
      continue;
    }
    if (a === '--no-pager' || a === '-P' || a === '--paginate' || a === '-p') {
      args = args.slice(1);
      continue;
    }
    if (a === '-c') {
      args = args.slice(2);
      continue;
    }
    fail(`unknown option: ${a}\n${COMMON.split('\n').slice(0, 2).join('\n')}`, 129);
  }
  const [cmd, ...rest] = args;
  if (!cmd) {
    g.out(COMMON);
    return 1;
  }
  if (cmd === 'version') {
    g.out('git version 2.51.1\n');
    return 0;
  }
  if (cmd === 'help') {
    if (rest[0] && SUBS[rest[0]]) {
      g.note(`(Skriv man git för simulatorns manualsida om git.)`, `(Type man git for the simulator's manual page about git.)`);
      return 0;
    }
    g.out(COMMON);
    return 0;
  }
  if (rest.includes('-h') && SUBS[cmd]) {
    g.out(`usage: git ${cmd} [<options>]\n`);
    g.note('(Se man git för de flaggor som simulatorn stöder.)', '(See man git for the options the simulator supports.)');
    return 129;
  }
  const sub = SUBS[cmd];
  if (sub) return sub(g, rest);
  const r = discover(g, g.cwd);
  const alias = getConfig(g, r, `alias.${cmd}`);
  if (alias && depth < 5) {
    if (alias.startsWith('!')) {
      g.note('(Alias som kör skalkommandon (!) stöds inte i simulatorn.)', '(Aliases that run shell commands (!) are not supported in the simulator.)');
      return 1;
    }
    return runGit(g, [...alias.split(/\s+/).filter(Boolean), ...rest], depth + 1);
  }
  g.err(`git: '${cmd}' is not a git command. See 'git --help'.\n`);
  const prefixed = cmd.length >= 2 ? Object.keys(SUBS).filter((s) => s.startsWith(cmd)) : [];
  const dist = Object.keys(SUBS).map((s) => [s, levenshtein(s, cmd)] as const);
  const best = Math.min(...dist.map(([, d]) => d));
  const similar = prefixed.length ? prefixed : best <= 2 ? dist.filter(([, d]) => d === best).map(([s]) => s) : [];
  if (similar.length) g.err(`\nThe most similar command${similar.length > 1 ? 's are' : ' is'}\n${similar.map((s) => `\t${s}\n`).join('')}`);
  return 1;
}

// ---------- Hjälpfunktioner för kapitlets kontroller ----------

/** Öppnar repot i `dir` som `user` (för uppgiftskontroller och tester). */
function repoFor(sh: Shell, dir: string): Repo | null {
  const g = makeG({ sh, name: 'git', args: [], stdin: null, isTTY: false, out: () => {}, err: () => {} });
  g.user = sh.rootUser();
  return looksLikeGitDir(g, join(dir, '.git')) ? openRepo(g, join(dir, '.git'), dir) : null;
}

export interface RepoState {
  branch: string | null;
  head: string | undefined;
  branches: Record<string, string>;
  /** Filerna i HEAD-commiten. */
  files: string[];
  /** Antal commits som nås från HEAD. */
  commits: number;
}

/** En sammanfattning av repot i katalogen `dir`, eller null om det inte finns något repo där. */
export function gitRepoState(sh: Shell, dir: string): RepoState | null {
  try {
    const r = repoFor(sh, dir);
    if (!r) return null;
    const head = readHead(r);
    const branches: Record<string, string> = {};
    for (const b of listRefs(r, 'refs/heads/')) branches[b] = readRef(r, `refs/heads/${b}`)!;
    return { branch: head.branch, head: head.hash, branches, files: Object.keys(commitTree(r, head.hash)), commits: ancestors(r, head.hash).size };
  } catch {
    return null;
  }
}

/** Sant om commiten `a` finns i historiken bakom `b` (eller är `b`). */
export function gitIsAncestor(sh: Shell, dir: string, a: string, b: string): boolean {
  try {
    const r = repoFor(sh, dir);
    return !!r && isAncestor(r, a, b);
  } catch {
    return false;
  }
}

/** Värdet för en nyckel i den globala git-konfigurationen (~/.gitconfig) för användaren `home`. */
export function gitGlobalConfig(sh: Shell, home: string, key: string): string | undefined {
  const text = sh.vfs.tryLookup(`${home}/.gitconfig`, sh.rootUser())?.content ?? '';
  const k = splitKey(key);
  if (!k) return undefined;
  return parseConfig(text)
    .filter((e) => e.key === normKey(k))
    .at(-1)?.value;
}

// ---------- Kommandot ----------

const MAN_SV = `NAMN
       git - distribuerad versionshantering

SYNOPSIS
       git [-C KATALOG] KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       git sparar ögonblicksbilder (commits) av filerna i ett projekt så att
       du kan se vad som ändrats, gå tillbaka och arbeta i flera grenar.
       Repot ligger i den dolda katalogen .git i projektets rot.

       Arbetskatalogen är filerna du ser. Indexet (staging area) är det som
       ska med i nästa commit. En commit är en sparad version med meddelande,
       författare och tid.

       Simulatorn har en egen, förenklad git som sparar allt i .git som
       textfiler. Nätverk saknas, men clone, fetch, pull och push fungerar
       mot repon på samma dator.

KOMMANDON
       init [KATALOG]           skapa ett nytt repo (-b GREN, --bare)
       config                   inställningar, t.ex.
                                git config --global user.name "Namn"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         visa vad som ändrats (git status är kompassen!)
       add FIL... | . | -A      lägg ändringar i indexet (-u, -f, -n)
       commit -m MEDDELANDE     spara en commit (-a, --amend, --allow-empty)
       log                      historiken (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FIL)
       diff                     arbetskatalog mot index (--staged, --stat,
                                COMMIT, A B, -- FIL)
       show [COMMIT[:FIL]]      visa en commit eller en fil i en commit
       restore FIL              ångra ändringar i arbetskatalogen
                                (--staged för att plocka ur indexet,
                                --source=COMMIT, --ours, --theirs)
       rm [--cached] [-r] FIL   ta bort filer (ur indexet)
       mv KÄLLA MÅL             flytta eller byt namn
       branch [NAMN]            lista eller skapa grenar (-d, -D, -m, -v, -a)
       switch GREN              byt gren (-c NY för att skapa, -, --detach)
       checkout GREN | -- FIL   äldre kommando: byt gren eller återställ fil
                                (-b NY)
       merge GREN               slå ihop en gren (--no-ff, --ff-only,
                                --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FIL
                                flytta grenen eller plocka ur indexet
       stash [list|pop|apply|drop]
                                lägg undan ändringar tillfälligt
       tag [-a -m MEDD] NAMN    märk en commit (t.ex. v1.0)
       clone KÄLLA [MÅL]        kopiera ett repo (bara lokala i simulatorn)
       remote [-v] | remote add NAMN URL
       fetch, pull, push [-u] FJÄRR GREN
                                utbyt commits med ett annat repo
       reflog                   var HEAD har varit (bra för att rädda saker)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                titta in i maskineriet

FILER
       ~/.gitconfig             dina globala inställningar
       .git/                    repot: objects/, refs/heads/, HEAD, index ...
       .gitignore               filer som git ska strunta i

EXEMPEL
       git config --global user.name "Elev Elevsson"
       git init
       git add .
       git commit -m "Första versionen"
       git switch -c ny-design
       git log --oneline --graph --all`;

const MAN_EN = `NAME
       git - distributed version control

SYNOPSIS
       git [-C DIR] COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       git stores snapshots (commits) of the files in a project so you can
       see what changed, go back in time and work in several branches.
       The repository lives in the hidden directory .git in the project root.

       The working tree is the files you see. The index (staging area) is
       what will go into the next commit. A commit is a saved version with a
       message, an author and a time.

       The simulator has its own simplified git that stores everything in
       .git as text files. There is no network, but clone, fetch, pull and
       push work with repositories on the same computer.

COMMANDS
       init [DIR]               create a new repository (-b BRANCH, --bare)
       config                   settings, e.g.
                                git config --global user.name "Name"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         show what changed (git status is your compass!)
       add FILE... | . | -A     add changes to the index (-u, -f, -n)
       commit -m MESSAGE        record a commit (-a, --amend, --allow-empty)
       log                      history (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FILE)
       diff                     working tree vs index (--staged, --stat,
                                COMMIT, A B, -- FILE)
       show [COMMIT[:FILE]]     show a commit or a file in a commit
       restore FILE             discard changes in the working tree
                                (--staged to unstage, --source=COMMIT,
                                --ours, --theirs)
       rm [--cached] [-r] FILE  remove files (from the index)
       mv SOURCE DEST           move or rename
       branch [NAME]            list or create branches (-d, -D, -m, -v, -a)
       switch BRANCH            switch branches (-c NEW to create, -, --detach)
       checkout BRANCH | -- FILE
                                older command: switch branch or restore file
                                (-b NEW)
       merge BRANCH             join a branch (--no-ff, --ff-only, --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FILE
                                move the branch or unstage
       stash [list|pop|apply|drop]
                                put changes aside for a while
       tag [-a -m MSG] NAME     mark a commit (e.g. v1.0)
       clone SOURCE [DEST]      copy a repository (local only in the simulator)
       remote [-v] | remote add NAME URL
       fetch, pull, push [-u] REMOTE BRANCH
                                exchange commits with another repository
       reflog                   where HEAD has been (great for rescues)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                look inside the machinery

FILES
       ~/.gitconfig             your global settings
       .git/                    the repository: objects/, refs/heads/, HEAD, index ...
       .gitignore               files git should ignore

EXAMPLES
       git config --global user.name "Ada Lovelace"
       git init
       git add .
       git commit -m "First version"
       git switch -c new-design
       git log --oneline --graph --all`;

const git: CommandDef = {
  name: 'git',
  summary: 'Versionshantering',
  summaryEn: 'Version control',
  man: MAN_SV,
  manEn: MAN_EN,
  run(ctx) {
    const g = makeG(ctx);
    try {
      return runGit(g, ctx.args);
    } catch (e) {
      if (e instanceof GitExit) {
        if (e.text) g.err(e.text);
        return e.code;
      }
      if (e instanceof FsError) {
        g.err(`fatal: ${e.message}\n`);
        return 128;
      }
      throw e;
    }
  },
};

export const GIT_COMMANDS: CommandDef[] = [git];
