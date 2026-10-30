// Själva skalet: håller tillståndet (filsystem, katalog, variabler, användare)
// och kör kommandorader – med pipes, omdirigering, alias, jokertecken och sudo.

import { COMMANDS } from './commands';
import { getDistro, type Distro } from './distros';
import { buildFs, STUDENT } from './initfs';
import { PACKAGES, installPackage, packageProviding } from './packages';
import {
  escapeGlob,
  globToRegex,
  hasUnescapedGlob,
  parse,
  ParseError,
  tokenize,
  unescapeGlob,
  type SimpleCommand,
  type Word,
} from './parser';
import type { CmdCtx, IO, Sink } from './types';
import { formatMan } from './commands/util';
import { basename, ELF, FsError, hasPerm, resolvePath, VFS, type FsNode, type User } from './vfs';

export interface ShellSnapshot {
  version: 1;
  distroId: string;
  fs: FsNode;
  cwd: string;
  env: Record<string, string>;
  aliases: Record<string, string>;
  history: string[];
  installed: Record<string, string>;
  flags: Record<string, boolean>;
  userStack: string[];
}

export interface ExecResult {
  /** Kommandoraden som kördes (vid svar på en fråga: den ursprungliga raden). */
  line: string;
  output: string;
  exitCode: number;
  clear: boolean;
  /** Sant om ett kommando väntar på ett svar (t.ex. "Do you want to continue? [Y/n]"). */
  pending: boolean;
}

interface Pending {
  question: string;
  defaultYes: boolean;
  user: string;
  line: string;
  onAnswer(yes: boolean, io: Sink): number;
}

class ExitSignal {
  constructor(public code: number) {}
}

export const DIM = '\x1b[2m';
export const RESET = '\x1b[0m';

export class Shell {
  distro: Distro;
  vfs: VFS;
  cwd: string;
  env: Record<string, string>;
  aliases: Record<string, string>;
  history: string[];
  installed: Record<string, string>;
  flags: Record<string, boolean>;
  /** Inloggade användare; sista är aktiv. `sudo -i` lägger till root, `exit` tar bort. */
  userStack: string[];
  lastExit = 0;
  pending: Pending | null = null;

  private overrides: string[] = [];
  private clearRequested = false;
  private currentLine = '';
  private positional: string[][] = [];
  private scriptDepth = 0;

  private constructor(s: ShellSnapshot) {
    this.distro = getDistro(s.distroId);
    this.vfs = new VFS(s.fs);
    this.cwd = s.cwd;
    this.env = s.env;
    this.aliases = s.aliases;
    this.history = s.history;
    this.installed = s.installed;
    this.flags = s.flags;
    this.userStack = s.userStack.length ? s.userStack : [STUDENT];
  }

  static create(distroId: string): Shell {
    const distro = getDistro(distroId);
    const home = `/home/${STUDENT}`;
    const sh = new Shell({
      version: 1,
      distroId: distro.id,
      fs: buildFs(distro),
      cwd: home,
      env: {
        HOME: home,
        USER: STUDENT,
        LOGNAME: STUDENT,
        SHELL: '/bin/bash',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        PWD: home,
        LANG: 'sv_SE.UTF-8',
        TERM: 'xterm-256color',
      },
      aliases: {},
      history: [],
      installed: {},
      flags: {},
      userStack: [STUDENT],
    });
    for (const pkg of PACKAGES) {
      if (pkg.names[distro.family] && pkg.base?.includes(distro.family)) installPackage(sh, pkg);
    }
    return sh;
  }

  static restore(snapshot: unknown): Shell | null {
    const s = snapshot as ShellSnapshot | null;
    if (!s || s.version !== 1 || !s.fs || !s.distroId) return null;
    return new Shell(s);
  }

  snapshot(): ShellSnapshot {
    return {
      version: 1,
      distroId: this.distro.id,
      fs: this.vfs.root,
      cwd: this.cwd,
      env: this.env,
      aliases: this.aliases,
      history: this.history,
      installed: this.installed,
      flags: this.flags,
      userStack: this.userStack,
    };
  }

  // ---------- Användare ----------

  getUser(name: string): User {
    if (name === 'root') return { name: 'root', uid: 0, groups: ['root'], home: '/root' };
    return { name, uid: 1000, groups: [name, this.distro.adminGroup], home: `/home/${name}` };
  }

  rootUser(): User {
    return this.getUser('root');
  }

  currentUser(): User {
    return this.getUser(this.overrides.at(-1) ?? this.userStack.at(-1) ?? STUDENT);
  }

  /** Kör fn som en annan användare (används av sudo). */
  runAs<T>(user: string, fn: () => T): T {
    this.overrides.push(user);
    try {
      return fn();
    } finally {
      this.overrides.pop();
    }
  }

  get home(): string {
    return this.env.HOME ?? `/home/${STUDENT}`;
  }

  resolve(path: string): string {
    return resolvePath(this.cwd, path);
  }

  requestClear(): void {
    this.clearRequested = true;
  }

  /** Ber användaren om ja/nej. Svaret hanteras vid nästa execute(). */
  ask(question: string, defaultYes: boolean, onAnswer: Pending['onAnswer']): void {
    this.pending = { question, defaultYes, onAnswer, user: this.currentUser().name, line: this.currentLine };
  }

  prompt(): string {
    if (this.pending) return this.pending.question;
    const u = this.currentUser();
    let p = this.cwd;
    if (p === u.home) p = '~';
    else if (p.startsWith(u.home + '/')) p = '~' + p.slice(u.home.length);
    const sym = u.uid === 0 ? '#' : '$';
    const host = this.distro.hostname;
    switch (this.distro.promptStyle) {
      case 'ubuntu':
        return u.uid === 0
          ? `${u.name}@${host}:${p}${sym} `
          : `\x1b[1;32m${u.name}@${host}\x1b[0m:\x1b[1;34m${p}\x1b[0m${sym} `;
      case 'debian':
        return `${u.name}@${host}:${p}${sym} `;
      case 'bracket':
        return `[${u.name}@${host} ${p === '~' || p === '/' ? p : basename(p)}]${sym} `;
    }
  }

  welcome(): string {
    const motd = this.distro.motd ? this.distro.motd + '\n' : '';
    return (
      motd +
      `${DIM}Simulerad terminal (${this.distro.name}). Inget du gör här påverkar din dator.\n` +
      `Skriv 'help' för att se vilka kommandon som finns.${RESET}\n`
    );
  }

  // ---------- Körning ----------

  execute(line: string): ExecResult {
    this.clearRequested = false;
    let output = '';
    const term: Sink = { out: (s) => (output += s), err: (s) => (output += s) };

    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      const answer = line.trim();
      const yes = answer === '' ? p.defaultYes : /^(y|yes|j|ja)$/i.test(answer);
      this.currentLine = p.line;
      this.lastExit = this.runAs(p.user, () => p.onAnswer(yes, term));
      return { line: p.line, output, exitCode: this.lastExit, clear: this.clearRequested, pending: !!this.pending };
    }

    if (line.trim() && !line.startsWith(' ')) {
      this.history.push(line);
      if (this.history.length > 500) this.history.splice(0, this.history.length - 500);
    }
    this.currentLine = line;
    this.runLine(line, term);
    return {
      line,
      output,
      exitCode: this.lastExit,
      clear: this.clearRequested,
      pending: !!this.pending,
    };
  }

  /** Kör en hel rad (med ; && ||) och skickar utdata till sink. */
  runLine(line: string, sink: Sink): number {
    let items;
    try {
      items = parse(line);
    } catch (e) {
      if (e instanceof ParseError) {
        sink.err(`bash: ${e.message}\n`);
        this.lastExit = 2;
        return 2;
      }
      throw e;
    }
    for (const item of items) {
      if (item.op === '&&' && this.lastExit !== 0) continue;
      if (item.op === '||' && this.lastExit === 0) continue;
      let input: string | null = null;
      item.pipeline.forEach((cmd, i) => {
        const isLast = i === item.pipeline.length - 1;
        const r = this.runSimple(cmd, input, isLast, sink);
        input = r.stdout;
        this.lastExit = r.code;
      });
      if (this.pending) break;
    }
    return this.lastExit;
  }

  private runSimple(cmd: SimpleCommand, stdin: string | null, isLast: boolean, sink: Sink): { code: number; stdout: string } {
    // Alias: byt ut första ordet om det är ett alias.
    let words: Word[] = cmd.words;
    const first = words[0];
    if (first && first.parts.length === 1 && first.parts[0].quoted === 'none' && this.aliases[first.raw] !== undefined) {
      const aliasWords = tokenize(this.aliases[first.raw]).flatMap((t) => (t.t === 'word' ? [t.w] : []));
      words = [...aliasWords, ...words.slice(1)];
    }

    let argv = words.flatMap((w) => this.expandWord(w));

    // Variabeltilldelning: NAMN=värde
    const assignments: [string, string][] = [];
    while (argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) {
      const a = argv.shift()!;
      const eq = a.indexOf('=');
      assignments.push([a.slice(0, eq), a.slice(eq + 1)]);
    }
    const saved: [string, string | undefined][] = [];
    for (const [k, v] of assignments) {
      if (argv.length) saved.push([k, this.env[k]]);
      this.env[k] = v;
    }

    let input = stdin;
    let stdoutTarget: { path: string; append: boolean } | null = null;
    let stderrTarget: { path: string; append: boolean } | 'stdout' | null = null;
    const user = this.currentUser();

    for (const r of cmd.redirects) {
      if (r.op === '2>&1') {
        stderrTarget = 'stdout';
        continue;
      }
      const targets = this.expandWord(r.target!);
      if (targets.length !== 1) {
        sink.err(`bash: ${r.target!.raw}: ambiguous redirect\n`);
        return { code: 1, stdout: '' };
      }
      const target = targets[0];
      const path = this.resolve(target);
      try {
        if (r.op === '<') {
          input = this.vfs.readFile(path, user);
        } else if (r.op === '>' || r.op === '&>' || r.op === '>>') {
          // Filen skapas/töms innan kommandot körs – precis som i bash.
          this.vfs.writeFile(path, '', user, r.op === '>>');
          stdoutTarget = { path, append: true };
          if (r.op === '&>') stderrTarget = 'stdout';
        } else {
          this.vfs.writeFile(path, '', user, r.op === '2>>');
          stderrTarget = { path, append: true };
        }
      } catch (e) {
        if (e instanceof FsError) {
          sink.err(`bash: ${target}: ${e.message}\n`);
          return { code: 1, stdout: '' };
        }
        throw e;
      }
    }

    let stdout = '';
    let stderr = '';
    const toTerminal = isLast && !stdoutTarget;
    const io: IO = {
      stdin: input,
      isTTY: toTerminal,
      out: (s) => {
        if (toTerminal) sink.out(s);
        else stdout += s;
      },
      err: (s) => {
        if (stderrTarget === 'stdout') io.out(s);
        else if (stderrTarget) stderr += s;
        else sink.err(s);
      },
    };

    const code = argv.length ? this.invoke(argv, io) : 0;

    for (const [k, v] of saved) {
      if (v === undefined) delete this.env[k];
      else this.env[k] = v;
    }

    try {
      if (stdoutTarget) this.vfs.writeFile(stdoutTarget.path, stdout, user, true);
      if (stderrTarget && stderrTarget !== 'stdout') this.vfs.writeFile(stderrTarget.path, stderr, user, true);
    } catch (e) {
      if (e instanceof FsError) sink.err(`bash: ${e.message}\n`);
      else throw e;
    }
    return { code, stdout: stdoutTarget ? '' : stdout };
  }

  /** Kör ett kommando med färdiga argument. Används också av sudo. */
  invoke(argv: string[], io: IO, opts: { viaSudo?: boolean } = {}): number {
    const [name, ...args] = argv;
    const ctx: CmdCtx = { ...io, sh: this, name, args };
    const builtin = COMMANDS[name];
    try {
      if (builtin?.builtin && !opts.viaSudo) return builtin.run(ctx);

      const found = this.resolveCommand(name);
      switch (found.kind) {
        case 'notfound':
          if (opts.viaSudo) io.err(`sudo: ${name}: command not found\n`);
          else this.commandNotFound(name, io);
          return opts.viaSudo ? 1 : 127;
        case 'error':
          io.err(`${opts.viaSudo ? 'sudo' : 'bash'}: ${name}: ${found.message}\n`);
          return 126;
        case 'script':
          return this.runScript(found.content, name, args, io);
        case 'binary': {
          const def = COMMANDS[found.impl];
          if (!def) {
            io.err(`bash: ${name}: cannot execute binary file\n`);
            return 126;
          }
          if (args[0] === '--help' && def.man && !['apt', 'apt-get', 'pacman', 'dnf', 'dnf5'].includes(def.name)) {
            io.out(formatMan(def.name, def.man));
            return 0;
          }
          return def.run(ctx);
        }
      }
    } catch (e) {
      if (e instanceof ExitSignal) throw e;
      io.err(`${name}: internt fel i simulatorn: ${(e as Error).message}\n`);
      return 1;
    }
  }

  resolveCommand(
    name: string,
  ):
    | { kind: 'notfound' }
    | { kind: 'error'; message: string }
    | { kind: 'binary'; impl: string; path: string }
    | { kind: 'script'; content: string; path: string } {
    const user = this.currentUser();
    const check = (path: string, node: FsNode) => {
      if (node.type === 'dir') return { kind: 'error' as const, message: 'Is a directory' };
      if (!hasPerm(node, user, 'x')) return { kind: 'error' as const, message: 'Permission denied' };
      const content = node.content ?? '';
      if (content.startsWith(ELF)) return { kind: 'binary' as const, impl: basename(path), path };
      if (!hasPerm(node, user, 'r')) return { kind: 'error' as const, message: 'Permission denied' };
      return { kind: 'script' as const, content, path };
    };
    if (name.includes('/')) {
      const path = this.resolve(name);
      try {
        return check(path, this.vfs.lookup(path, user));
      } catch (e) {
        if (e instanceof FsError) return { kind: 'error', message: e.message };
        throw e;
      }
    }
    for (const dir of (this.env.PATH ?? '').split(':')) {
      if (!dir) continue;
      const path = `${dir}/${name}`;
      const node = this.vfs.tryLookup(path, user);
      if (node && node.type === 'file' && hasPerm(node, user, 'x')) return check(path, node);
    }
    return { kind: 'notfound' };
  }

  private commandNotFound(name: string, io: IO): void {
    const pkg = packageProviding(this.distro.family, name);
    const pkgName = pkg?.names[this.distro.family];
    if (pkg && pkgName && this.distro.id === 'ubuntu') {
      io.err(`Command '${name}' not found, but can be installed with:\nsudo apt install ${pkgName}\n`);
      return;
    }
    io.err(`bash: ${name}: command not found\n`);
    if (pkgName) {
      io.err(`${DIM}Tips från simulatorn: kommandot finns i paketet '${pkgName}'. Se kapitlet om pakethantering.${RESET}\n`);
    }
  }

  /** Kör ett skript rad för rad i ett "underskal" (cd och variabler påverkar inte anroparen). */
  runScript(content: string, name: string, args: string[], io: IO, inCurrentShell = false): number {
    if (this.scriptDepth > 20) {
      io.err(`bash: ${name}: för djup rekursion\n`);
      return 1;
    }
    const savedCwd = this.cwd;
    const savedEnv = { ...this.env };
    this.scriptDepth++;
    this.positional.push([name, ...args]);
    let code = 0;
    try {
      for (const line of content.split('\n')) {
        if (line.startsWith('#!')) continue;
        code = this.runLine(line, io);
        if (this.pending) break;
      }
    } catch (e) {
      if (e instanceof ExitSignal) code = e.code;
      else throw e;
    } finally {
      this.scriptDepth--;
      this.positional.pop();
      if (!inCurrentShell) {
        this.cwd = savedCwd;
        this.env = savedEnv;
      }
    }
    this.lastExit = code;
    return code;
  }

  /** Anropas av `exit`. */
  exit(code: number, io: IO): number {
    if (this.scriptDepth > 0) throw new ExitSignal(code);
    if (this.userStack.length > 1) {
      this.userStack.pop();
      const u = this.currentUser();
      this.cwd = u.home;
      this.env.HOME = u.home;
      this.env.USER = u.name;
      io.out('logout\n');
      return code;
    }
    io.out(`${DIM}Det här är en simulerad terminal, så det finns ingen session att avsluta. Använd 'clear' för att rensa skärmen.${RESET}\n`);
    return 0;
  }

  // ---------- Expansion ----------

  expandVars(text: string): string {
    const pos = this.positional.at(-1) ?? ['bash'];
    return text.replace(/\$(\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*)|([0-9])|\?|\$|#|@)/g, (m, _a, braced, plain, digit) => {
      if (m === '$?') return String(this.lastExit);
      if (m === '$$') return '4242';
      if (m === '$#') return String(pos.length - 1);
      if (m === '$@') return pos.slice(1).join(' ');
      if (digit !== undefined) return pos[Number(digit)] ?? '';
      return this.env[braced ?? plain] ?? '';
    });
  }

  expandWord(w: Word): string[] {
    let value = '';
    let pattern = '';
    let hasGlob = false;
    let allUnquoted = true;
    w.parts.forEach((p, idx) => {
      let text = p.text;
      if (p.quoted !== 'single') text = this.expandVars(text);
      if (idx === 0 && p.quoted === 'none' && (text === '~' || text.startsWith('~/'))) {
        text = this.home + text.slice(1);
      }
      value += text;
      if (p.quoted === 'none') {
        pattern += text;
        if (hasUnescapedGlob(text)) hasGlob = true;
      } else {
        allUnquoted = false;
        pattern += escapeGlob(text);
      }
    });
    if (hasGlob) {
      const matches = this.glob(pattern);
      if (matches.length) return matches;
    }
    // En tom, ociterad variabel försvinner helt (som i bash).
    if (value === '' && allUnquoted && w.raw.includes('$')) return [];
    return [value];
  }

  glob(pattern: string): string[] {
    const user = this.currentUser();
    const abs = pattern.startsWith('/');
    const segs = pattern.split('/').filter(Boolean);
    let results = [abs ? '/' : ''];
    const join = (base: string, name: string) => (base === '' ? name : base === '/' ? `/${name}` : `${base}/${name}`);
    for (const seg of segs) {
      const next: string[] = [];
      for (const base of results) {
        if (!hasUnescapedGlob(seg)) {
          next.push(join(base, unescapeGlob(seg)));
          continue;
        }
        const node = this.vfs.tryLookup(this.resolve(base || '.'), user);
        if (!node || node.type !== 'dir' || !hasPerm(node, user, 'r')) continue;
        const re = globToRegex(seg);
        for (const name of Object.keys(node.children!).sort()) {
          if (name.startsWith('.') && !seg.startsWith('.')) continue;
          if (re.test(name)) next.push(join(base, name));
        }
      }
      results = next;
    }
    return results.filter((r) => r && this.vfs.tryLookup(this.resolve(r), user));
  }

  // ---------- Tab-komplettering ----------

  /** Alla kommandon som går att köra just nu (inbyggda + körbara filer i PATH). */
  availableCommands(): string[] {
    const names = new Set<string>(Object.values(COMMANDS).filter((c) => c.builtin).map((c) => c.name));
    const user = this.currentUser();
    for (const dir of (this.env.PATH ?? '').split(':')) {
      const node = dir ? this.vfs.tryLookup(dir, user) : null;
      if (node?.type === 'dir') {
        for (const [n, child] of Object.entries(node.children!)) {
          if (child.type === 'file' && hasPerm(child, user, 'x')) names.add(n);
        }
      }
    }
    Object.keys(this.aliases).forEach((a) => names.add(a));
    return [...names].sort();
  }

  complete(line: string): { line: string; options: string[] } {
    const m = /(^|[\s|;&]+)([^\s|;&]*)$/.exec(line)!;
    const word = m[2];
    const before = line.slice(0, line.length - word.length);
    const isCommand = /(^|[|;&]\s*)$/.test(before.trimEnd()) || before.trim() === '' || /(^|\s)sudo\s+$/.test(before);

    let candidates: string[];
    let prefix = word;
    let dirPart = '';
    if (isCommand && !word.includes('/')) {
      candidates = this.availableCommands().filter((c) => c.startsWith(word));
    } else {
      const slash = word.lastIndexOf('/');
      dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
      prefix = word.slice(slash + 1);
      let dirPath = dirPart || '.';
      if (dirPath === '~/' || dirPath.startsWith('~/')) dirPath = this.home + dirPath.slice(1);
      const node = this.vfs.tryLookup(this.resolve(dirPath), this.currentUser());
      if (!node || node.type !== 'dir') return { line, options: [] };
      candidates = Object.entries(node.children!)
        .filter(([n]) => n.startsWith(prefix) && (prefix.startsWith('.') || !n.startsWith('.')))
        .map(([n, child]) => (child.type === 'dir' ? `${n}/` : n))
        .sort();
    }
    if (candidates.length === 0) return { line, options: [] };
    if (candidates.length === 1) {
      const c = candidates[0];
      return { line: before + dirPart + c + (c.endsWith('/') ? '' : ' '), options: [] };
    }
    let common = candidates[0];
    for (const c of candidates) {
      while (!c.startsWith(common)) common = common.slice(0, -1);
    }
    return { line: before + dirPart + common, options: common.length > prefix.length ? [] : candidates };
  }
}
