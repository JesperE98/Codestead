// Själva skalet: håller tillståndet (filsystem, katalog, variabler, användare, funktioner)
// och kör bash-kod – med pipes, omdirigering, alias, jokertecken, sudo, villkor, loopar,
// funktioner, $(...) och $((...)).

import { ArithError, evalArith } from './arith';
import { COMMANDS } from './commands';
import { formatMan } from './commands/util';
import { manFor } from './commands/man-en';
import { setupDisks, type DiskState } from './disks';
import { getDistro, type Distro } from './distros';
import { buildFs, STUDENT } from './initfs';
import { installCommand, installPackage, PACKAGES, packageProviding } from './packages';
import { initialProcs, SHELL_PID, type Job, type ProcState } from './procs';
import {
  escapeGlob,
  findClosingParen,
  globToRegex,
  hasUnescapedGlob,
  parse,
  ParseError,
  tokenize,
  unescapeGlob,
  type Node,
  type Redirect,
  type Word,
} from './parser';
import { ExitSignal, isControlSignal, LimitError, LoopSignal, ReturnSignal } from './signals';
import type { CmdCtx, IO, Reader, Sink } from './types';
import { basename, dirname, ELF, FsError, hasPerm, resolvePath, VFS, type FsNode, type User } from './vfs';

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
  functions?: Record<string, Node>;
  proc?: ProcState;
  disks?: DiskState;
}

export interface ExecResult {
  /** Kommandoraden som kördes (vid svar på en fråga: den ursprungliga raden). */
  line: string;
  output: string;
  exitCode: number;
  clear: boolean;
  /** Sant om ett kommando väntar på ett svar (t.ex. "Do you want to continue? [Y/n]"). */
  pending: boolean;
  /** Sant om raden inte var färdig (t.ex. en for-loop utan "done") – skalet väntar på fler rader. */
  incomplete: boolean;
}

interface Pending {
  question: string;
  defaultYes: boolean;
  user: string;
  line: string;
  onAnswer(yes: boolean, io: Sink, text: string): number;
  /** Resten av kommandoraden, som körs när frågan besvarats. */
  resume?: (io: XIO) => number;
}

/** Internt IO-objekt när kod körs: stdin är en delad läsare. */
interface XIO extends Sink {
  stdin: Reader | null;
  tty: boolean;
}

interface ExpandOpts {
  split?: boolean;
  glob?: boolean;
}

export const DIM = '\x1b[2m';
export const RESET = '\x1b[0m';

/** Högsta antal kommandon/varv per körning innan skalet avbryter (skyddar mot oändliga loopar). */
const STEP_LIMIT = 20_000;

export class Shell {
  distro: Distro;
  vfs: VFS;
  cwd: string;
  env: Record<string, string>;
  aliases: Record<string, string>;
  history: string[];
  installed: Record<string, string>;
  flags: Record<string, boolean>;
  functions: Record<string, Node>;
  /** Processer och bakgrundsjobb. */
  proc: ProcState;
  /** Diskar, partitioner och monterade filsystem. */
  disks: DiskState;
  /** PID för det senast startade bakgrundsjobbet ($!). */
  lastBgPid: number | null = null;
  /** Inloggade användare; sista är aktiv. `sudo -i` lägger till root, `exit` tar bort. */
  userStack: string[];
  lastExit = 0;
  pending: Pending | null = null;
  /** Gränssnittets språk. Styr simulatorns egna tipsrader och manualsidor (svenska eller engelska). */
  lang = 'sv';

  scriptDepth = 0;
  funcDepth = 0;
  loopDepth = 0;

  private overrides: string[] = [];
  private clearRequested = false;
  private currentLine = '';
  private positional: string[][] = [];
  private locals: Record<string, string | undefined>[] = [];
  /** Påbörjad flerradig kod (t.ex. efter "for i in 1 2 3"). */
  private partial: string | null = null;
  private steps = 0;
  private listDepth = 0;
  private substDepth = 0;

  private constructor(s: ShellSnapshot) {
    this.distro = getDistro(s.distroId);
    this.vfs = new VFS(s.fs);
    this.cwd = s.cwd;
    this.env = s.env;
    this.aliases = s.aliases;
    this.history = s.history;
    this.installed = s.installed;
    this.flags = s.flags;
    this.functions = s.functions ?? {};
    this.proc = s.proc ?? initialProcs(this.distro);
    this.disks = s.disks ?? setupDisks(this.distro, this.vfs);
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
    sh.addMissingDefaults();
    return sh;
  }

  static restore(snapshot: unknown): Shell | null {
    const s = snapshot as ShellSnapshot | null;
    if (!s || s.version !== 1 || !s.fs || !s.distroId) return null;
    const sh = new Shell(s);
    sh.addMissingDefaults();
    return sh;
  }

  /**
   * Installerar förinstallerade paket och övningsfiler som saknas – t.ex. när appen
   * uppdaterats med nya kapitel efter att terminalen sparades. Det som skalet lagt in
   * en gång (och eleven sedan tagit bort med flit) läggs inte tillbaka.
   */
  private addMissingDefaults(): void {
    const family = this.distro.family;
    for (const pkg of PACKAGES) {
      if (!pkg.names[family] || !pkg.base?.includes(family)) continue;
      const key = `default:pkg:${pkg.id}`;
      if (this.flags[key]) continue;
      if (!(pkg.id in this.installed)) installPackage(this, pkg);
      this.flags[key] = true;
    }
    // Nya kommandon i paket som redan är installerade (t.ex. mount i util-linux).
    for (const pkg of PACKAGES) {
      if (!(pkg.id in this.installed)) continue;
      for (const cmd of pkg.provides) {
        const key = `default:cmd:${cmd}`;
        if (this.flags[key]) continue;
        if (!this.vfs.tryLookup(`/usr/bin/${cmd}`, this.rootUser())) installCommand(this, cmd);
        this.flags[key] = true;
      }
    }
    const fresh = new VFS(buildFs(this.distro));
    const root = this.rootUser();
    const home = `/home/${STUDENT}`;
    const walk = (path: string) => {
      const node = fresh.tryLookup(path, root);
      if (!node) return;
      const key = `default:file:${path}`;
      if (!this.flags[key]) {
        this.flags[key] = true;
        if (!this.vfs.tryLookup(path, root) && this.vfs.tryLookup(dirname(path), root)?.type === 'dir') {
          this.vfs.insert(path, node, root);
          return;
        }
      }
      if (node.type === 'dir') for (const name of Object.keys(node.children!)) walk(`${path}/${name}`);
    };
    walk(`${home}/dokument`);
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
      functions: this.functions,
      proc: this.proc,
      disks: this.disks,
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

  /** Väljer simulatorns egna meddelanden på svenska eller engelska (engelska för alla andra språk). */
  msg(text: { sv: string; en: string }): string {
    return this.lang === 'sv' ? text.sv : text.en;
  }

  requestClear(): void {
    this.clearRequested = true;
  }

  /** Ber användaren om ja/nej. Svaret hanteras vid nästa execute(). */
  ask(question: string, defaultYes: boolean, onAnswer: (yes: boolean, io: Sink) => number): void {
    this.pending = { question, defaultYes, onAnswer, user: this.currentUser().name, line: this.currentLine };
  }

  /** Ber användaren skriva en rad text (används av `read`). */
  askText(prompt: string, onText: (text: string, io: Sink) => number): void {
    this.pending = {
      question: prompt,
      defaultYes: false,
      onAnswer: (_yes, io, text) => onText(text, io),
      user: this.currentUser().name,
      line: this.currentLine,
    };
  }

  /** Kan `read` fråga användaren direkt? Bara på kommandoraden, inte inne i skript. */
  canAskInteractively(): boolean {
    return this.scriptDepth === 0 && this.substDepth === 0;
  }

  /** Avbryter en fråga eller en påbörjad flerradig kommandorad (Ctrl+C). */
  cancel(): void {
    this.pending = null;
    this.partial = null;
  }

  prompt(): string {
    if (this.pending) return this.pending.question;
    if (this.partial !== null) return '> ';
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
    this.steps = 0;
    let output = '';
    const term: XIO = { out: (s) => (output += s), err: (s) => (output += s), stdin: null, tty: true };
    const result = (l: string, incomplete = false): ExecResult => ({
      line: l,
      output: incomplete || this.pending ? output : output + this.jobNotifications(),
      exitCode: this.lastExit,
      clear: this.clearRequested,
      pending: !!this.pending,
      incomplete,
    });

    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      const answer = line.trim();
      const yes = answer === '' ? p.defaultYes : /^(y|yes|j|ja)$/i.test(answer);
      this.currentLine = p.line;
      this.guard(term, () => {
        this.lastExit = this.runAs(p.user, () => p.onAnswer(yes, term, line));
        if (p.resume && !this.pending) this.lastExit = p.resume(term);
      });
      return result(p.line);
    }

    const text = this.partial !== null ? `${this.partial}\n${line}` : line;
    let ast: Node;
    try {
      ast = parse(text);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      if (e.incomplete && text.split('\n').length < 500) {
        this.partial = text;
        return result(text, true);
      }
      this.partial = null;
      this.addHistory(text);
      term.err(`bash: ${e.message}\n`);
      this.lastExit = 2;
      return result(flattenLines(text));
    }
    this.partial = null;
    const flat = flattenLines(text);
    this.addHistory(flat);
    this.currentLine = flat;
    this.guard(term, () => {
      this.lastExit = this.exec(ast, term);
    });
    return result(flat);
  }

  private addHistory(text: string): void {
    if (!text.trim() || text.startsWith(' ')) return;
    this.history.push(flattenLines(text));
    if (this.history.length > 500) this.history.splice(0, this.history.length - 500);
  }

  /** Kör fn och fångar signaler som inte får läcka ut ur en körning. */
  private guard(io: Sink, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      if (e instanceof LimitError) {
        io.err(`\n${DIM}${e.message}${RESET}\n`);
        this.lastExit = 130;
      } else if (e instanceof ExitSignal || e instanceof ReturnSignal) {
        this.lastExit = e.code;
      } else if (!(e instanceof LoopSignal)) {
        throw e;
      }
    } finally {
      this.listDepth = 0;
    }
  }

  private tick(): void {
    if (++this.steps > STEP_LIMIT) {
      throw new LimitError(
        `Simulatorn avbröt körningen efter ${STEP_LIMIT.toLocaleString('sv-SE')} steg – kanske en oändlig loop? ` +
          '(I en riktig terminal stoppar du ett program som aldrig blir klart med Ctrl+C.)',
      );
    }
  }

  /** Kör en rad (eller ett helt skript) i det aktuella skalet. */
  runLine(line: string, sink: Sink): number {
    try {
      return (this.lastExit = this.exec(parse(line), { ...sink, stdin: null, tty: false }));
    } catch (e) {
      if (e instanceof ParseError) {
        sink.err(`bash: ${e.message}\n`);
        return (this.lastExit = 2);
      }
      throw e;
    }
  }

  private exec(node: Node, io: XIO): number {
    let code: number;
    switch (node.type) {
      case 'list': {
        if (!node.items.length) return this.lastExit;
        this.listDepth++;
        code = this.lastExit;
        try {
          for (let k = 0; k < node.items.length; k++) {
            code = node.items[k].background ? this.startJob(node.items[k].node, io) : this.exec(node.items[k].node, io);
            if (this.pending) {
              // En fråga (t.ex. från read eller apt) – kör resten när den besvarats.
              const rest = node.items.slice(k + 1);
              if (this.listDepth === 1 && rest.length && !this.pending.resume) {
                this.pending.resume = (io2) => this.exec({ type: 'list', items: rest }, io2);
              }
              break;
            }
          }
        } finally {
          this.listDepth--;
        }
        break;
      }
      case 'andor': {
        code = this.exec(node.first, io);
        for (const { op, node: next } of node.rest) {
          if (this.pending) break;
          if ((op === '&&' && code !== 0) || (op === '||' && code === 0)) continue;
          code = this.exec(next, io);
        }
        break;
      }
      case 'pipeline': {
        let input = io.stdin;
        code = 0;
        node.commands.forEach((cmd, i) => {
          const last = i === node.commands.length - 1;
          let buf = '';
          const stage: XIO = {
            stdin: input,
            out: last ? io.out : (s) => (buf += s),
            err: io.err,
            tty: last ? io.tty : false,
          };
          code = this.exec(cmd, stage);
          input = { data: buf, pos: 0 };
        });
        if (node.negate) code = code === 0 ? 1 : 0;
        break;
      }
      case 'simple':
        code = this.runSimple(node, io);
        break;
      case 'funcdef':
        this.functions[node.name] = node.body;
        code = 0;
        break;
      default:
        code = this.withRedirects(node.redirects, io, (rio) => this.execCompound(node, rio));
    }
    this.lastExit = code;
    return code;
  }

  private execCompound(node: Exclude<Node, { type: 'list' | 'andor' | 'pipeline' | 'simple' | 'funcdef' }>, io: XIO): number {
    switch (node.type) {
      case 'if': {
        for (const clause of node.clauses) {
          if (this.exec(clause.cond, io) === 0) return this.exec(clause.body, io);
          if (this.pending) return 0;
        }
        return node.elseBody ? this.exec(node.elseBody, io) : 0;
      }
      case 'for': {
        const values = node.words
          ? node.words.flatMap((w) => this.expandWord(w, io))
          : (this.positional.at(-1) ?? ['bash']).slice(1);
        let code = 0;
        this.runLoop(
          () => values.length > 0,
          () => {
            this.setVar(node.name, values.shift()!);
            code = this.exec(node.body, io);
          },
        );
        return code;
      }
      case 'cfor': {
        let code = 0;
        if (!this.arith(node.init, io).ok) return 1;
        this.runLoop(
          () => {
            const r = node.cond.trim() ? this.arith(node.cond, io) : { ok: true, value: 1 };
            return r.ok && r.value !== 0;
          },
          () => {
            code = this.exec(node.body, io);
          },
          () => {
            this.arith(node.step, io);
          },
        );
        return code;
      }
      case 'while': {
        let code = 0;
        this.runLoop(
          () => {
            const c = this.exec(node.cond, io);
            return node.until ? c !== 0 : c === 0;
          },
          () => {
            code = this.exec(node.body, io);
          },
        );
        return code;
      }
      case 'case': {
        const value = this.expandWord(node.word, io, { split: false, glob: false }).join(' ');
        for (const item of node.items) {
          if (item.patterns.some((p) => globToRegex(this.expandPattern(p, io), true).test(value))) {
            return item.body ? this.exec(item.body, io) : 0;
          }
        }
        return 0;
      }
      case 'group': {
        if (!node.subshell) return this.exec(node.body, io);
        const saved = { cwd: this.cwd, env: { ...this.env }, functions: { ...this.functions } };
        try {
          return this.exec(node.body, io);
        } catch (e) {
          if (e instanceof ExitSignal) return e.code;
          throw e;
        } finally {
          Object.assign(this, saved);
        }
      }
      case 'arith': {
        const r = this.arith(node.expr, io);
        return r.ok && r.value !== 0 ? 0 : 1;
      }
    }
  }

  /** Gemensam loop-logik med break/continue och skydd mot oändliga loopar. */
  private runLoop(cond: () => boolean, body: () => void, step?: () => void): void {
    this.loopDepth++;
    try {
      for (;;) {
        this.tick();
        if (!cond() || this.pending) break;
        try {
          body();
        } catch (e) {
          if (!(e instanceof LoopSignal)) throw e;
          if (e.levels > 1) {
            e.levels--;
            throw e;
          }
          if (e.kind === 'break') break;
        }
        if (this.pending) break;
        step?.();
      }
    } finally {
      this.loopDepth--;
    }
  }

  private arith(expr: string, io: Sink): { ok: boolean; value: number } {
    try {
      const value = evalArith(this.expandString(expr, io), {
        get: (n) => this.getVar(n),
        set: (n, v) => this.setVar(n, v),
      });
      return { ok: true, value };
    } catch (e) {
      if (!(e instanceof ArithError)) throw e;
      io.err(`bash: ${expr.trim()}: ${e.message}\n`);
      return { ok: false, value: 0 };
    }
  }

  /** Tillämpar omdirigeringar (> >> < 2> 2>&1 &>) runt fn. */
  private withRedirects(redirects: Redirect[], io: XIO, fn: (io: XIO) => number): number {
    if (!redirects.length) return fn(io);
    const user = this.currentUser();
    let stdin = io.stdin;
    let stdoutTarget: string | null = null;
    let stderrTarget: string | 'stdout' | null = null;
    let stdoutToStderr = false;
    for (const r of redirects) {
      if (r.op === '2>&1') {
        stderrTarget = 'stdout';
        continue;
      }
      if (r.op === '>&2') {
        stdoutToStderr = true;
        continue;
      }
      if (r.op === '<<' || r.op === '<<-') {
        stdin = { data: r.expand ? this.expandString(r.body ?? '', io) : (r.body ?? ''), pos: 0 };
        continue;
      }
      if (r.op === '<<<') {
        stdin = { data: this.expandWord(r.target!, io, { split: false, glob: false }).join(' ') + '\n', pos: 0 };
        continue;
      }
      const targets = this.expandWord(r.target!, io);
      if (targets.length !== 1) {
        io.err(`bash: ${r.target!.raw}: ambiguous redirect\n`);
        return 1;
      }
      const path = this.resolve(targets[0]);
      try {
        if (r.op === '<') {
          stdin = { data: this.vfs.readFile(path, user), pos: 0 };
        } else if (r.op === '>' || r.op === '&>' || r.op === '>>') {
          // Filen skapas/töms innan kommandot körs – precis som i bash.
          this.vfs.writeFile(path, '', user, r.op === '>>');
          stdoutTarget = path;
          if (r.op === '&>') stderrTarget = 'stdout';
        } else {
          this.vfs.writeFile(path, '', user, r.op === '2>>');
          stderrTarget = path;
        }
      } catch (e) {
        if (e instanceof FsError) {
          io.err(`bash: ${targets[0]}: ${e.message}\n`);
          return 1;
        }
        throw e;
      }
    }
    let stdout = '';
    let stderr = '';
    const out = stdoutTarget ? (s: string) => (stdout += s) : stdoutToStderr ? io.err : io.out;
    const rio: XIO = {
      stdin,
      tty: io.tty && !stdoutTarget,
      out,
      err: stderrTarget === 'stdout' ? out : stderrTarget ? (s) => (stderr += s) : io.err,
    };
    try {
      return fn(rio);
    } finally {
      try {
        if (stdoutTarget) this.vfs.writeFile(stdoutTarget, stdout, user, true);
        if (stderrTarget && stderrTarget !== 'stdout') this.vfs.writeFile(stderrTarget, stderr, user, true);
      } catch (e) {
        if (e instanceof FsError) io.err(`bash: ${e.message}\n`);
        else throw e;
      }
    }
  }

  private runSimple(node: Extract<Node, { type: 'simple' }>, io: XIO): number {
    this.tick();
    // Alias: byt ut första ordet om det är ett alias.
    let words: Word[] = node.words;
    const first = words[0];
    if (first && first.parts.length === 1 && first.parts[0].quoted === 'none' && this.aliases[first.raw] !== undefined) {
      const aliasWords = tokenize(this.aliases[first.raw]).flatMap((t) => (t.t === 'word' ? [t.w] : []));
      words = [...aliasWords, ...words.slice(1)];
    }

    // Variabeltilldelningar först på raden: NAMN=värde (delas inte upp vid mellanslag).
    const assignments: [string, string][] = [];
    let k = 0;
    for (; k < words.length; k++) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(words[k].parts[0]?.quoted === 'none' ? words[k].parts[0].text : '');
      if (!m) break;
      const value = this.expandWord(words[k], io, { split: false, glob: false }).join('');
      assignments.push([m[1], value.slice(m[1].length + 1)]);
    }
    const cmdName = words[k]?.raw;
    const noSplit = ['export', 'local', 'readonly', 'declare', 'alias'].includes(cmdName ?? '');
    // I [[ ... ]] sker ingen orduppdelning eller filnamnsexpansion – mönster som *.txt jämförs som text.
    const literalArgs = cmdName === '[[';
    const argv = words.slice(k).flatMap((w, idx) =>
      literalArgs
        ? this.expandWord(w, io, { split: false, glob: false })
        : noSplit && idx > 0
          ? this.expandWord(w, io, { split: false })
          : this.expandWord(w, io),
    );

    if (!argv.length) {
      for (const [name, value] of assignments) this.setVar(name, value);
      return this.withRedirects(node.redirects, io, () => (assignments.length ? this.lastExit : 0));
    }

    const saved: [string, string | undefined][] = assignments.map(([name]) => [name, this.env[name]]);
    for (const [name, value] of assignments) this.env[name] = value;
    try {
      return this.withRedirects(node.redirects, io, (rio) =>
        this.invoke(argv, {
          stdin: rio.stdin ? rio.stdin.data.slice(rio.stdin.pos) : null,
          reader: rio.stdin,
          isTTY: rio.tty,
          out: rio.out,
          err: rio.err,
        }),
      );
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete this.env[name];
        else this.env[name] = value;
      }
    }
  }

  /** Kör ett kommando med färdiga argument. Används också av sudo. */
  invoke(argv: string[], io: IO, opts: { viaSudo?: boolean } = {}): number {
    const [name, ...args] = argv;
    const ctx: CmdCtx = { ...io, sh: this, name, args };
    const builtin = COMMANDS[name];
    try {
      if (!opts.viaSudo && this.functions[name]) return this.callFunction(name, args, io);
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
            io.out(formatMan(def.name, manFor(def, this)));
            return 0;
          }
          return def.run(ctx);
        }
      }
    } catch (e) {
      if (isControlSignal(e)) throw e;
      io.err(`${name}: internt fel i simulatorn: ${(e as Error).message}\n`);
      return 1;
    }
  }

  private toXIO(io: IO): XIO {
    return {
      stdin: io.reader ?? (io.stdin !== null ? { data: io.stdin, pos: 0 } : null),
      out: io.out,
      err: io.err,
      tty: io.isTTY,
    };
  }

  private callFunction(name: string, args: string[], io: IO): number {
    if (this.funcDepth >= 100) {
      io.err(`bash: ${name}: maximum function nesting level exceeded (100)\n`);
      return 1;
    }
    this.positional.push([this.positional.at(-1)?.[0] ?? 'bash', ...args]);
    this.locals.push({});
    this.funcDepth++;
    try {
      return this.exec(this.functions[name], this.toXIO(io));
    } catch (e) {
      if (e instanceof ReturnSignal) return e.code;
      throw e;
    } finally {
      this.funcDepth--;
      this.positional.pop();
      for (const [k, v] of Object.entries(this.locals.pop()!)) {
        if (v === undefined) delete this.env[k];
        else this.env[k] = v;
      }
    }
  }

  /** `local NAMN[=värde]` i en funktion. */
  declareLocal(name: string, value: string | undefined): boolean {
    const frame = this.locals.at(-1);
    if (!frame || this.funcDepth === 0) return false;
    if (!(name in frame)) frame[name] = this.env[name];
    if (value !== undefined) this.env[name] = value;
    else delete this.env[name];
    return true;
  }

  /** Positionsparametrar ($1, $2 ...) för aktuellt skript/funktion. */
  get args(): string[] {
    return (this.positional.at(-1) ?? ['bash']).slice(1);
  }

  setArgs(args: string[]): void {
    const top = this.positional.at(-1);
    if (top) top.splice(1, top.length - 1, ...args);
    else this.positional.push(['bash', ...args]);
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

  /**
   * Kör ett skript. Som standard i ett "underskal": cd, variabler och funktioner
   * påverkar inte anroparen. Med inCurrentShell (source) stannar ändringarna kvar.
   */
  runScript(content: string, name: string, args: string[], io: IO, inCurrentShell = false): number {
    if (this.scriptDepth > 20) {
      io.err(`bash: ${name}: för djup rekursion\n`);
      return 1;
    }
    let ast: Node;
    try {
      ast = parse(content);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      io.err(`${name}: ${e.message}\n`);
      return 2;
    }
    const saved = { cwd: this.cwd, env: { ...this.env }, functions: { ...this.functions } };
    this.scriptDepth++;
    this.positional.push([name, ...args]);
    const savedLoopDepth = this.loopDepth;
    this.loopDepth = 0;
    let code = 0;
    try {
      code = this.exec(ast, this.toXIO(io));
    } catch (e) {
      if (e instanceof ExitSignal || e instanceof ReturnSignal) code = e.code;
      else if (e instanceof LoopSignal) code = 0;
      else throw e;
    } finally {
      this.scriptDepth--;
      this.positional.pop();
      this.loopDepth = savedLoopDepth;
      if (!inCurrentShell) Object.assign(this, saved);
    }
    this.lastExit = code;
    return code;
  }

  /** Anropas av `exit`. */
  exit(code: number, io: IO): number {
    if (this.scriptDepth > 0 || this.substDepth > 0) throw new ExitSignal(code);
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

  // ---------- Bakgrundsjobb ----------

  /** Uppdaterar jobb vars tid har gått ut (t.ex. `sleep 5 &`). */
  refreshJobs(): void {
    const now = Date.now();
    for (const job of this.proc.jobs) {
      if (job.state === 'Running' && job.endsAt !== undefined && job.endsAt <= now) this.finishJob(job, 'Done');
    }
  }

  finishJob(job: Job, state: Job['state']): void {
    job.state = state;
    this.proc.procs = this.proc.procs.filter((p) => p.pid !== job.pid);
  }

  /** `kommando &`: startar ett bakgrundsjobb och skriver ut "[1] 4200". */
  private startJob(node: Node, io: XIO): number {
    this.refreshJobs();
    const cmd = nodeToString(node);
    const id = Math.max(0, ...this.proc.jobs.map((j) => j.id)) + 1;
    const pid = this.proc.nextPid++;
    this.lastBgPid = pid;
    io.err(`[${id}] ${pid}\n`);
    const seconds = sleepSeconds(node);
    if (seconds !== null) {
      // sleep körs "på riktigt" i bakgrunden: jobbet blir klart när tiden gått.
      this.proc.jobs.push({ id, pid, cmd, state: 'Running', endsAt: Date.now() + seconds * 1000 });
      this.proc.procs.push({
        pid,
        ppid: SHELL_PID,
        user: this.currentUser().name,
        cmd,
        cpu: 0,
        mem: 0,
        vsz: 8_300,
        rss: 1_900,
        tty: 'pts/0',
        stat: 'S',
        start: new Date().toTimeString().slice(0, 5),
        time: '0:00',
      });
    } else {
      // Andra kommandon körs direkt – i simulatorn blir de klara på en gång.
      const exit = this.exec(node, io);
      this.proc.jobs.push({ id, pid, cmd, state: 'Done', exit });
    }
    return 0;
  }

  /** "[1]+  Done   sleep 3" för jobb som blivit klara sedan förra gången. */
  private jobNotifications(): string {
    this.refreshJobs();
    const finished = this.proc.jobs.filter((j) => j.state !== 'Running');
    if (!finished.length) return '';
    const last = this.proc.jobs.at(-1);
    this.proc.jobs = this.proc.jobs.filter((j) => j.state === 'Running');
    return finished
      .map((j) => {
        const state = j.state === 'Done' && j.exit ? `Exit ${j.exit}` : j.state;
        return `[${j.id}]${j === last ? '+' : '-'}  ${state.padEnd(24)}${j.cmd}\n`;
      })
      .join('');
  }

  // ---------- Variabler och expansion ----------

  getVar(name: string): string | undefined {
    if (name === 'RANDOM') return String(Math.floor(Math.random() * 32768));
    if (name === 'PWD') return this.cwd;
    if (name === 'UID') return String(this.currentUser().uid);
    return this.env[name];
  }

  setVar(name: string, value: string): void {
    this.env[name] = value;
  }

  /** Kör kod och returnerar dess utdata (för $(...) och `...`). */
  private captureOutput(code: string, io: Sink): string {
    let ast: Node;
    try {
      ast = parse(code);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      io.err(`bash: command substitution: ${e.message}\n`);
      return '';
    }
    let buf = '';
    const saved = { cwd: this.cwd, env: { ...this.env }, functions: { ...this.functions } };
    const savedPending = this.pending;
    this.substDepth++;
    try {
      this.exec(ast, { stdin: null, out: (s) => (buf += s), err: io.err, tty: false });
    } catch (e) {
      if (e instanceof ExitSignal) this.lastExit = e.code;
      else throw e;
    } finally {
      this.substDepth--;
      const exit = this.lastExit;
      Object.assign(this, saved);
      this.lastExit = exit;
      this.pending = savedPending;
    }
    return buf.replace(/\n+$/, '');
  }

  /** ${...}: ${NAMN}, ${#NAMN}, ${NAMN:-standard}, ${NAMN%.txt} m.fl. */
  private paramExpand(inner: string, io: Sink): string {
    if (inner.startsWith('#') && inner.length > 1) return String([...(this.special(inner.slice(1)) ?? '')].length);
    const m = /^([A-Za-z_]\w*|\d+|[@*#?])(.*)$/s.exec(inner);
    if (!m) throw new ExpansionError(`\${${inner}}: bad substitution`);
    const [, name, rest] = m;
    const value = this.special(name);
    if (!rest) return value ?? '';
    const op = /^(:-|:=|:\+|:\?|-|=|\+|\?|##|#|%%|%)(.*)$/s.exec(rest);
    if (!op) throw new ExpansionError(`\${${inner}}: bad substitution`);
    const [, kind, arg] = op;
    const word = () => this.expandString(arg, io);
    const unsetOrEmpty = kind.startsWith(':') ? !value : value === undefined;
    switch (kind) {
      case ':-':
      case '-':
        return unsetOrEmpty ? word() : value!;
      case ':=':
      case '=':
        if (unsetOrEmpty) this.setVar(name, word());
        return this.env[name] ?? '';
      case ':+':
      case '+':
        return unsetOrEmpty ? '' : word();
      case ':?':
      case '?':
        if (unsetOrEmpty) throw new ExpansionError(`${name}: ${arg || 'parameter null or not set'}`);
        return value!;
    }
    // Ta bort prefix (#, ##) eller suffix (%, %%) som matchar ett mönster.
    const v = value ?? '';
    const re = globToRegex(this.expandString(arg, io), true);
    const longest = kind.length === 2;
    const cuts = [...Array(v.length + 1).keys()];
    if (kind.startsWith('#')) {
      for (const i of longest ? cuts.reverse() : cuts) if (re.test(v.slice(0, i))) return v.slice(i);
    } else {
      for (const i of longest ? cuts : cuts.reverse()) if (re.test(v.slice(i))) return v.slice(0, i);
    }
    return v;
  }

  /** Värdet av en vanlig eller speciell parameter ($1, $#, $? ...). */
  private special(name: string): string | undefined {
    const pos = this.positional.at(-1) ?? ['bash'];
    if (/^\d+$/.test(name)) return pos[Number(name)];
    switch (name) {
      case '?':
        return String(this.lastExit);
      case '#':
        return String(pos.length - 1);
      case '@':
      case '*':
        return pos.slice(1).join(' ');
      case '$':
        return '4242';
      case '!':
        return this.lastBgPid !== null ? String(this.lastBgPid) : '';
      case '-':
        return 'himBH';
    }
    return this.getVar(name);
  }

  /**
   * Expanderar ett ord till noll eller flera fält: ~, $VAR, ${...}, $(...), `...`, $((...)),
   * orduppdelning av ociterade expansioner och jokertecken.
   */
  expandWord(w: Word, io: Sink = { out: () => {}, err: () => {} }, opts: ExpandOpts = {}): string[] {
    const split = opts.split ?? true;
    const glob = opts.glob ?? true;
    interface Field {
      value: string;
      pattern: string;
      hasGlob: boolean;
      touched: boolean;
    }
    const fields: Field[] = [];
    let cur: Field = { value: '', pattern: '', hasGlob: false, touched: false };
    fields.push(cur);
    const newField = () => {
      cur = { value: '', pattern: '', hasGlob: false, touched: false };
      fields.push(cur);
    };
    const literal = (text: string, quoted: boolean) => {
      cur.value += text;
      cur.pattern += quoted ? escapeGlob(text) : text;
      if (!quoted && hasUnescapedGlob(text)) cur.hasGlob = true;
      cur.touched = true;
    };
    const expansion = (text: string, quoted: boolean) => {
      if (quoted || !split) {
        literal(text, quoted);
        return;
      }
      text.split(/[ \t\n]+/).forEach((piece, idx) => {
        if (idx > 0 && cur.touched) newField();
        if (piece) literal(piece, false);
      });
    };

    try {
      w.parts.forEach((part, idx) => {
        if (part.quoted === 'single') {
          literal(part.text, true);
          return;
        }
        let text = part.text;
        const quoted = part.quoted === 'double';
        if (idx === 0 && !quoted && (text === '~' || text.startsWith('~/'))) {
          literal(this.home, true);
          text = text.slice(1);
        }
        if (quoted && text !== '$@') cur.touched = true;
        this.scan(text, io, {
          literal: (t) => literal(t, quoted),
          expansion: (t) => expansion(t, quoted),
          fields: (list) => {
            // "$@" blir ett fält per argument.
            if (!quoted) return expansion(list.join(' '), false);
            list.forEach((a, i) => {
              if (i > 0) newField();
              literal(a, true);
            });
          },
        });
      });
    } catch (e) {
      if (e instanceof ExpansionError) {
        io.err(`bash: ${e.message}\n`);
        return [];
      }
      throw e;
    }

    const result: string[] = [];
    for (const f of fields) {
      if (!f.touched) continue;
      if (glob && f.hasGlob) {
        const matches = this.glob(f.pattern);
        if (matches.length) {
          result.push(...matches);
          continue;
        }
      }
      result.push(f.value);
    }
    return result;
  }

  /** Expanderar ett mönster (för case och ${x%mönster}) utan att matcha mot filer. */
  private expandPattern(w: Word, io: Sink): string {
    let pattern = '';
    for (const part of w.parts) {
      if (part.quoted === 'single') pattern += escapeGlob(part.text);
      else {
        const quoted = part.quoted === 'double';
        this.scan(part.text, io, {
          literal: (t) => (pattern += quoted ? escapeGlob(t) : t),
          expansion: (t) => (pattern += quoted ? escapeGlob(t) : t),
          fields: (l) => (pattern += l.join(' ')),
        });
      }
    }
    return pattern;
  }

  /** Expanderar text som om den stod inom dubbla citattecken. */
  expandString(text: string, io: Sink = { out: () => {}, err: () => {} }): string {
    let out = '';
    this.scan(text, io, { literal: (t) => (out += t), expansion: (t) => (out += t), fields: (l) => (out += l.join(' ')) });
    return out;
  }

  /** Går igenom text och hittar $-uttryck och `...`. */
  private scan(
    text: string,
    io: Sink,
    emit: { literal(t: string): void; expansion(t: string): void; fields(list: string[]): void },
  ): void {
    let lit = '';
    const flush = () => {
      if (lit) emit.literal(lit);
      lit = '';
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '`') {
        let j = i + 1;
        while (j < text.length && text[j] !== '`') j += text[j] === '\\' ? 2 : 1;
        flush();
        emit.expansion(this.captureOutput(text.slice(i + 1, j).replace(/\\`/g, '`'), io));
        i = j;
        continue;
      }
      if (c !== '$' || i + 1 >= text.length) {
        lit += c;
        continue;
      }
      const next = text[i + 1];
      if (next === '(') {
        const j = findClosingParen(text, i + 1);
        if (j < 0) {
          lit += c;
          continue;
        }
        flush();
        if (text[i + 2] === '(' && text[j - 1] === ')') {
          const r = this.arith(text.slice(i + 3, j - 1), io);
          if (!r.ok) throw new ExpansionError(`${text.slice(i + 3, j - 1)}: arithmetic error`);
          emit.expansion(String(r.value));
        } else {
          emit.expansion(this.captureOutput(text.slice(i + 2, j), io));
        }
        i = j;
        continue;
      }
      if (next === '{') {
        const j = text.indexOf('}', i);
        if (j < 0) {
          lit += c;
          continue;
        }
        flush();
        emit.expansion(this.paramExpand(text.slice(i + 2, j), io));
        i = j;
        continue;
      }
      const name = /^[A-Za-z_]\w*/.exec(text.slice(i + 1))?.[0];
      if (name) {
        flush();
        emit.expansion(this.getVar(name) ?? '');
        i += name.length;
        continue;
      }
      if (next === '@' || next === '*') {
        flush();
        emit.fields(this.args);
        i++;
        continue;
      }
      if (/[0-9?#$!-]/.test(next)) {
        flush();
        emit.expansion(this.special(next) ?? '');
        i++;
        continue;
      }
      lit += c;
    }
    flush();
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

  /** Alla kommandon som går att köra just nu (inbyggda + funktioner + körbara filer i PATH). */
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
    Object.keys(this.functions).forEach((f) => names.add(f));
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

class ExpansionError extends Error {}

/**
 * Gör om flerradig kod till en rad för historiken, som bash gör:
 * "for i in 1 2\ndo echo $i\ndone" blir "for i in 1 2; do echo $i; done".
 */
export function flattenLines(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return text;
  return lines.reduce((acc, l) => {
    const joiner = /(\bdo|\bthen|\belse|\{|\||&&|\|\||\bin|;)$/.test(acc) || /^(;|\))/.test(l) ? ' ' : '; ';
    return acc + joiner + l;
  });
}

/** Ungefärlig källkod för ett kommando (visas av jobs och ps). */
export function nodeToString(node: Node): string {
  switch (node.type) {
    case 'simple':
      return [...node.words.map((w) => w.raw), ...node.redirects.map((r) => r.op + (r.target ? ' ' + r.target.raw : ''))].join(' ');
    case 'pipeline':
      return (node.negate ? '! ' : '') + node.commands.map(nodeToString).join(' | ');
    case 'andor':
      return [nodeToString(node.first), ...node.rest.map((r) => `${r.op} ${nodeToString(r.node)}`)].join(' ');
    case 'list':
      return node.items.map((i) => nodeToString(i.node) + (i.background ? ' &' : '')).join('; ');
    default:
      return node.type === 'funcdef' ? `${node.name}()` : node.type;
  }
}

/** Om noden är `sleep N`: antalet sekunder, annars null. */
function sleepSeconds(node: Node): number | null {
  if (node.type !== 'simple' || node.words[0]?.raw !== 'sleep' || node.words.length !== 2) return null;
  const m = /^(\d+(?:\.\d+)?)([smh]?)$/.exec(node.words[1].raw);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'm' ? 60 : m[2] === 'h' ? 3600 : 1);
}
