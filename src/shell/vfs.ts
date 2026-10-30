// Ett litet virtuellt filsystem i minnet, med ägare och rättigheter (rwx).
// Allt är vanliga objekt så att det kan sparas som JSON i localStorage.

export interface FsNode {
  type: 'file' | 'dir';
  /** Rättighetsbitar, t.ex. 0o755. Inkluderar setuid (0o4000) och sticky bit (0o1000). */
  mode: number;
  owner: string;
  group: string;
  mtime: number;
  content?: string;
  children?: Record<string, FsNode>;
  /** Låtsasstorlek för "binärfiler" i /usr/bin. */
  size?: number;
}

export interface User {
  name: string;
  uid: number;
  groups: string[];
  home: string;
}

/** Innehållet i en simulerad binärfil börjar med detta. */
export const ELF = '\u007fELF';

export type FsErrorCode =
  | 'ENOENT'
  | 'EACCES'
  | 'ENOTDIR'
  | 'EISDIR'
  | 'EEXIST'
  | 'ENOTEMPTY'
  | 'EPERM'
  | 'EINVAL';

const MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: 'No such file or directory',
  EACCES: 'Permission denied',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EEXIST: 'File exists',
  ENOTEMPTY: 'Directory not empty',
  EPERM: 'Operation not permitted',
  EINVAL: 'Invalid argument',
};

export class FsError extends Error {
  constructor(public code: FsErrorCode) {
    super(MESSAGES[code]);
  }
}

export function makeDir(owner = 'root', mode = 0o755, children: Record<string, FsNode> = {}, group = owner): FsNode {
  return { type: 'dir', mode, owner, group, mtime: Date.now(), children };
}

export function makeFile(content = '', owner = 'root', mode = 0o644, group = owner): FsNode {
  return { type: 'file', mode, owner, group, mtime: Date.now(), content };
}

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
}

export function resolvePath(cwd: string, path: string): string {
  return normalizePath(path.startsWith('/') ? path : `${cwd}/${path}`);
}

export function dirname(path: string): string {
  const norm = normalizePath(path);
  const idx = norm.lastIndexOf('/');
  return idx <= 0 ? '/' : norm.slice(0, idx);
}

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  if (!trimmed) return '/';
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

export function nodeSize(node: FsNode): number {
  if (node.type === 'dir') return 4096;
  return node.size ?? new TextEncoder().encode(node.content ?? '').length;
}

export function hasPerm(node: FsNode, user: User, perm: 'r' | 'w' | 'x'): boolean {
  if (user.uid === 0) {
    // root får allt, förutom att köra filer som inte har någon x-bit alls.
    if (perm !== 'x' || node.type === 'dir') return true;
    return (node.mode & 0o111) !== 0;
  }
  const bit = perm === 'r' ? 4 : perm === 'w' ? 2 : 1;
  let shift = 0;
  if (node.owner === user.name) shift = 6;
  else if (user.groups.includes(node.group)) shift = 3;
  return ((node.mode >> shift) & bit) !== 0;
}

export function cloneNode(node: FsNode): FsNode {
  return JSON.parse(JSON.stringify(node)) as FsNode;
}

export class VFS {
  constructor(public root: FsNode) {}

  /** Går till en nod och kontrollerar sökrättighet (x) på varje katalog på vägen. */
  lookup(path: string, user: User): FsNode {
    let node = this.root;
    for (const seg of normalizePath(path).split('/').filter(Boolean)) {
      if (node.type !== 'dir' || !node.children) throw new FsError('ENOTDIR');
      if (!hasPerm(node, user, 'x')) throw new FsError('EACCES');
      const next: FsNode | undefined = node.children[seg];
      if (!next) throw new FsError('ENOENT');
      node = next;
    }
    return node;
  }

  tryLookup(path: string, user: User): FsNode | null {
    try {
      return this.lookup(path, user);
    } catch {
      return null;
    }
  }

  /** Föräldrakatalogen och filnamnet för en sökväg. */
  parent(path: string, user: User): { dir: FsNode; name: string } {
    const norm = normalizePath(path);
    if (norm === '/') throw new FsError('EEXIST');
    const dir = this.lookup(dirname(norm), user);
    if (dir.type !== 'dir' || !dir.children) throw new FsError('ENOTDIR');
    return { dir, name: basename(norm) };
  }

  readFile(path: string, user: User): string {
    const norm = normalizePath(path);
    if (norm === '/dev/null') return '';
    const node = this.lookup(norm, user);
    if (node.type === 'dir') throw new FsError('EISDIR');
    if (!hasPerm(node, user, 'r')) throw new FsError('EACCES');
    return node.content ?? '';
  }

  writeFile(path: string, content: string, user: User, append = false): void {
    const norm = normalizePath(path);
    if (norm === '/dev/null') return;
    const { dir, name } = this.parent(norm, user);
    const existing = dir.children![name];
    if (existing) {
      if (existing.type === 'dir') throw new FsError('EISDIR');
      if (!hasPerm(existing, user, 'w')) throw new FsError('EACCES');
      existing.content = append ? (existing.content ?? '') + content : content;
      existing.size = undefined;
      existing.mtime = Date.now();
      return;
    }
    if (!hasPerm(dir, user, 'w')) throw new FsError('EACCES');
    dir.children![name] = makeFile(content, user.name, 0o644, user.groups[0]);
    dir.mtime = Date.now();
  }

  mkdir(path: string, user: User): void {
    const { dir, name } = this.parent(path, user);
    if (dir.children![name]) throw new FsError('EEXIST');
    if (!hasPerm(dir, user, 'w')) throw new FsError('EACCES');
    dir.children![name] = makeDir(user.name, 0o755, {}, user.groups[0]);
    dir.mtime = Date.now();
  }

  /** Lägger in en färdig nod (används av cp och mv). Skriver över filer. */
  insert(path: string, node: FsNode, user: User): void {
    const { dir, name } = this.parent(path, user);
    if (!hasPerm(dir, user, 'w')) throw new FsError('EACCES');
    const existing = dir.children![name];
    if (existing && existing.type === 'dir' && node.type !== 'dir') throw new FsError('EISDIR');
    dir.children![name] = node;
    dir.mtime = Date.now();
  }

  /** Tar bort en nod. Kontrollen av om kataloger är tomma görs av anroparen. */
  remove(path: string, user: User): void {
    const { dir, name } = this.parent(path, user);
    if (!dir.children![name]) throw new FsError('ENOENT');
    if (!hasPerm(dir, user, 'w')) throw new FsError('EACCES');
    delete dir.children![name];
    dir.mtime = Date.now();
  }

  listDir(path: string, user: User): string[] {
    const node = this.lookup(path, user);
    if (node.type !== 'dir' || !node.children) throw new FsError('ENOTDIR');
    if (!hasPerm(node, user, 'r')) throw new FsError('EACCES');
    return Object.keys(node.children).sort();
  }
}
