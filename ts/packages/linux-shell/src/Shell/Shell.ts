// Port of Shell/Shell.cs and its partial files Shell.*.cs (src/shell/shell.ts) – the shell itself: holds the state
// (file system, directory, variables, users, functions) and runs bash code – with pipes, redirection, aliases,
// wildcards, sudo, conditions, loops, functions, $(...) and $((...)).
//
// A TypeScript class cannot be split over several files, so the C# partial files are the sections of this file,
// in the same order: Shell.cs, Shell.Execute.cs, Shell.Invoke.cs, Shell.Expansion.cs, Shell.Redirection.cs,
// Shell.Jobs.cs, Shell.Modes.cs, Shell.Questions.cs, Shell.Scripts.cs, Shell.Users.cs and Shell.Completion.cs.

import { ArithError } from "../Arith/ArithError.js";
import * as ArithLib from "../Arith/ArithLib.js";
import * as CronCmd from "../Commands/Cron/CronCmd.js";
import * as IndexCmd from "../Commands/IndexCmd.js";
import * as ManEnCmd from "../Commands/Man/ManEnCmd.js";
import * as UtilCmd from "../Commands/Util/UtilCmd.js";
import type { DiskState } from "../Disks/DiskState.js";
import * as DisksLib from "../Disks/DisksLib.js";
import type { Distro } from "../Distros/Distro.js";
import * as DistrosLib from "../Distros/DistrosLib.js";
import * as FishLib from "../Fish/FishLib.js";
import { Js, type Obj } from "../Js.js";
import * as KnownCommands from "../KnownCommands.js";
import * as PackagesLib from "../Packages/PackagesLib.js";
import type { CompoundNode } from "../Parser/Ast/CompoundNode.js";
import type { Node } from "../Parser/Ast/Node.js";
import type { Redirect } from "../Parser/Ast/Redirect.js";
import type { SimpleNode } from "../Parser/Ast/SimpleNode.js";
import type { Word } from "../Parser/Ast/Word.js";
import { ParseError } from "../Parser/ParseError.js";
import * as ParserLib from "../Parser/ParserLib.js";
import type { Job } from "../Procs/Job.js";
import type { ProcState } from "../Procs/ProcState.js";
import * as ProcsLib from "../Procs/ProcsLib.js";
import type { ServiceState } from "../Services/ServiceState.js";
import * as ServicesLib from "../Services/ServicesLib.js";
import type { ShellFrame, ShellMode } from "../Shellmode/ShellFrame.js";
import type { ShellFrameSaved } from "../Shellmode/ShellFrameSaved.js";
import * as ShellmodeLib from "../Shellmode/ShellmodeLib.js";
import * as ShellI18n from "../ShellI18n.js";
import { ControlSignal } from "../Signals/ControlSignal.js";
import { ExitSignal } from "../Signals/ExitSignal.js";
import { LimitError } from "../Signals/LimitError.js";
import { LoopSignal } from "../Signals/LoopSignal.js";
import { ReturnSignal } from "../Signals/ReturnSignal.js";
import { CmdCtx } from "../Types/CmdCtx.js";
import type { CommandDef } from "../Types/CommandDef.js";
import { IO } from "../Types/IO.js";
import { Reader } from "../Types/Reader.js";
import { Sink } from "../Types/Sink.js";
import * as UsersLib from "../Users/UsersLib.js";
import { FsError } from "../Vfs/FsError.js";
import type { FsNode } from "../Vfs/FsNode.js";
import type { User } from "../Vfs/User.js";
import { VFS } from "../Vfs/VFS.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import { World } from "../World.js";
import * as WorldMigration from "../WorldMigration.js";
import * as InitfsLib from "../InitfsLib.js";
import type { ExecResult } from "./ExecResult.js";
import { ExpansionError } from "./ExpansionError.js";
import type { Pending } from "./Pending.js";
import { resolvedCommand, type ResolvedCommand } from "./ResolvedCommand.js";
import * as ShellLib from "./ShellLib.js";
import { snapshotFromJson, snapshotToJson, type ShellSnapshot } from "./ShellSnapshot.js";
import { XIO } from "./XIO.js";

/** Maximum number of commands/iterations per run before the shell stops (protects against infinite loops). */
const StepLimit = 20_000;

const yesRe = /^(y|yes|j|ja)$/i;
const assignRe = /^([A-Za-z_][A-Za-z0-9_]*)=/;
const nohupRe = /^nohup\s+/;
/** A ~ right after the = of an assignment word or after a : in its value, followed by / or : or the end. */
const assignTildeRe = /(^[A-Za-z_][A-Za-z0-9_]*=|:)~(?=(\/|:|$))/g;
const noSplitCommands = new Set(["export", "local", "readonly", "declare", "alias"]);
const pkgManagers = new Set(["apt", "apt-get", "pacman", "dnf", "dnf5"]);
const elfImplRe = /^\u007fELF[^(]*\((?:simulated binary|simulerad binärfil): ([^)\s]+)\)/;
const trailingNewlines = /\n+$/;
const paramNameRe = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?])(.*)$/s;
const paramOpRe = /^(:-|:=|:\+|:\?|-|=|\+|\?|##|#|%%|%)(.*)$/s;
const digitsRe = /^[0-9]+$/;
const splitRe = /[ \t\n]+/;
const varNameRe = /^[A-Za-z_][A-Za-z0-9_]*/;
const specialCharRe = /^[0-9?#$!-]$/;
const completeWordRe = /(^|[\s|;&]+)([^\s|;&]*)$/;
const completeCmdPosRe = /(^|[|;&]\s*)$/;
const completeSudoRe = /(^|\s)sudo\s+$/;

/** A field being built by expandWord. */
interface Field {
  value: string;
  pattern: string;
  hasGlob: boolean;
  touched: boolean;
}

/** Where scan sends what it finds. */
interface ScanEmit {
  literal: (text: string) => void;
  expansion: (text: string, param: boolean) => void;
  fields: (list: string[]) => void;
}

/** expandWord's named options (split: and glob: in C#). */
export interface ExpandOptions {
  split?: boolean;
  glob?: boolean;
}

export class Shell {
  static readonly Dim = "\x1b[2m";
  static readonly Reset = "\x1b[0m";

  distro: Distro;
  vfs: VFS;
  cwd: string;
  /** All the shell's variables, exported or not (see exported). */
  env: Obj<string>;
  /**
   * The names of the exported variables – the environment variables. Only these reach the programs and scripts the
   * shell starts (bash -c, ./script.sh, env ...); `set` shows all of env, `env` only these. A name can be exported
   * without a value (`export NAME`), as in bash.
   */
  exported: Set<string>;
  aliases: Obj<string>;
  history: string[];
  installed: Obj<string>;
  flags: Obj<boolean>;
  functions: Obj<Node>;
  /** Processes and background jobs. */
  proc: ProcState;
  /** Services (systemd) and the journal. */
  services: ServiceState = null!;
  /** Disks, partitions and mounted file systems. */
  disks: DiskState;
  /** PID of the most recently started background job ($!). */
  lastBgPid: number | null = null;
  /** Logged-in users; the last one is active. `sudo -i` adds root, `exit` removes it. */
  userStack: string[];
  /** Shells started with `zsh`, `fish` or `bash` (ended with exit). */
  shellStack: ShellFrame[];
  lastExit = 0;
  pendingQuestion: Pending | null = null;
  /**
   * The language of the exercise files and the user name (see World.ts). Changed with
   * WorldMigration.translate, which also renames what is already there. (internal set in C#)
   */
  world: World;
  /**
   * The UI language code (en, sv, de ...). Controls the simulator's own hint lines and help summaries
   * (see ShellI18n); man pages are Swedish for "sv" and English otherwise.
   */
  lang = "sv";

  scriptDepth = 0;
  funcDepth = 0;
  loopDepth = 0;

  private readonly overrides: string[] = [];
  private clearRequested = false;
  private currentLine = "";
  private readonly positional: string[][] = [];
  private readonly locals: Map<string, string | null>[] = [];
  /** Started multi-line code (e.g. after "for i in 1 2 3"). */
  private partial: string | null = null;
  private steps = 0;
  private listDepth = 0;
  private substDepth = 0;
  /** The shell a script runs with (according to #! or e.g. `zsh script.sh`). */
  private readonly modeOverride: ShellMode[] = [];

  private constructor(s: ShellSnapshot) {
    this.distro = DistrosLib.getDistro(s.distroId);
    this.world = World.get(s.world ?? WorldMigration.LegacyWorld);
    this.vfs = new VFS(s.fs);
    this.vfs.umask = s.umask ?? Js.oct(22);
    this.vfs.joinHardLinks();
    this.cwd = s.cwd;
    this.env = s.env;
    // Terminals saved before the shell knew exported from plain variables: everything was exported.
    this.exported = new Set(s.exported ?? s.env.keys());
    this.aliases = s.aliases;
    this.history = s.history;
    this.installed = s.installed;
    this.flags = s.flags;
    this.functions = s.functions ?? Js.obj<Node>();
    this.proc = s.proc ?? ProcsLib.initialProcs(this.distro, this.world.user);
    this.disks = s.disks ?? DisksLib.setupDisks(this.distro, this.vfs, this.world);
    this.userStack = s.userStack.length > 0 ? s.userStack : [this.world.user];
    this.services = s.services ?? ServicesLib.initialServices(this);
    this.shellStack = s.shells ?? [];
  }

  /** A new computer. world is the language of the exercise files and the user name. */
  static create(distroId: string, world: string = World.Source): Shell {
    const distro = DistrosLib.getDistro(distroId);
    const w = World.get(world);
    const home = w.home;
    const env = Js.obj<string>();
    env.set("HOME", home);
    env.set("USER", w.user);
    env.set("LOGNAME", w.user);
    env.set("SHELL", "/bin/bash");
    env.set("PATH", "/usr/local/bin:/usr/bin:/bin");
    env.set("PWD", home);
    env.set("LANG", w.locale);
    env.set("TERM", "xterm-256color");
    const sh = new Shell({
      version: 1,
      distroId: distro.id,
      world: w.lang,
      fs: InitfsLib.buildFs(distro, w),
      cwd: home,
      env,
      // The login environment is exported, and so is OLDPWD (bash exports it, still unset, at start).
      exported: [...env.keys(), "OLDPWD"],
      aliases: Js.obj(),
      history: [],
      installed: Js.obj(),
      flags: Js.obj(),
      userStack: [w.user],
    });
    sh.addMissingDefaults();
    return sh;
  }

  static restore(s: ShellSnapshot | null): Shell | null {
    if (s === null || s.version !== 1 || !s.fs || !s.distroId) return null;
    // Terminals saved before the world was translated: new program names, and a known world (Swedish).
    if (s.world === null || s.world === undefined) s = WorldMigration.migrateLegacy(s);
    const sh = new Shell(s);
    sh.addMissingDefaults();
    return sh;
  }

  /** Restores from JSON (as saved by snapshotJson). Returns null if it is unusable. */
  static restoreJson(json: string | null | undefined): Shell | null {
    if (json === null || json === undefined || json.trim() === "") return null;
    try {
      return Shell.restore(snapshotFromJson(json));
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw e;
    }
  }

  /**
   * Installs preinstalled packages and exercise files that are missing – e.g. when the app has been
   * updated with new chapters after the terminal was saved. What the shell added once (and the student
   * then removed on purpose) is not put back.
   */
  private addMissingDefaults(): void {
    const family = this.distro.family;
    for (const pkg of PackagesLib.packages) {
      if (pkg.names.get(family) === undefined || !((pkg.base?.includes(family) ?? false) || (pkg.baseDistros?.includes(this.distro.id) ?? false))) continue;
      const key = `default:pkg:${pkg.id}`;
      if (this.flags.get(key) === true) continue;
      if (!this.installed.has(pkg.id)) PackagesLib.installPackage(this, pkg);
      this.flags.set(key, true);
    }
    // New commands in packages that are already installed (e.g. mount in util-linux).
    for (const pkg of PackagesLib.packages) {
      if (!this.installed.has(pkg.id)) continue;
      for (const cmd of pkg.provides) {
        const key = `default:cmd:${cmd}`;
        if (this.flags.get(key) === true) continue;
        if (this.vfs.tryLookup(`/usr/bin/${cmd}`, this.rootUser()) === null) PackagesLib.installCommand(this, cmd);
        this.flags.set(key, true);
      }
    }
    const fresh = new VFS(InitfsLib.buildFs(this.distro, this.world));
    const root = this.rootUser();
    const home = this.world.home;
    const walk = (path: string): void => {
      const node = fresh.tryLookup(path, root);
      if (node === null) return;
      const key = `default:file:${path}`;
      if (this.flags.get(key) !== true) {
        this.flags.set(key, true);
        if (this.vfs.tryLookup(path, root) === null && this.vfs.tryLookup(VfsLib.dirname(path), root)?.type === "dir") {
          this.vfs.insert(path, node, root);
          return;
        }
      }
      if (node.type === "dir") for (const name of [...node.children!.keys()]) walk(`${path}/${name}`);
    };
    walk(`${home}/${this.world.get("documents")}`);
    walk(`${home}/${this.world.get("webProject")}`);
    // The template for new home directories (useradd -m) and the settings for useradd.
    walk("/etc/skel");
    walk("/etc/login.defs");
    // The networking chapter: the DNS setting and the exercise server.
    walk("/etc/resolv.conf");
    walk("/usr/local/bin/myserver");
    walk(`${home}/${this.world.get("downloads")}`);
    this.addMissingSystemGroups();
  }

  /**
   * System groups that came with a later version (e.g. backup on the Debian family) are added to /etc/group of a
   * terminal saved before – once, and only when neither the name nor the GID is taken.
   */
  private addMissingSystemGroups(): void {
    const key = "default:systemGroups:2";
    if (this.flags.get(key) === true) return;
    this.flags.set(key, true);
    const root = this.rootUser();
    const node = this.vfs.tryLookup("/etc/group", root);
    if (node?.type !== "file") return;
    const text = node.content ?? "";
    const taken = new Set(text.split("\n").flatMap((l) => (l === "" ? [] : [`n:${l.split(":")[0]}`, `g:${l.split(":")[2]}`])));
    const missing = InitfsLib.systemGroups(this.distro).filter((g) => {
      const [name, , gid] = g.split(":");
      return !taken.has(`n:${name}`) && !taken.has(`g:${gid}`);
    });
    if (missing.length > 0) this.vfs.writeFile("/etc/group", `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${missing.join("\n")}\n`, root);
  }

  snapshot(): ShellSnapshot {
    return {
      version: 1,
      distroId: this.distro.id,
      world: this.world.lang,
      fs: this.vfs.root,
      cwd: this.cwd,
      env: this.env,
      exported: [...this.exported],
      aliases: this.aliases,
      history: this.history,
      installed: this.installed,
      flags: this.flags,
      userStack: this.userStack,
      functions: this.functions,
      proc: this.proc,
      services: this.services,
      shells: this.shellStack,
      disks: this.disks,
      umask: this.vfs.umask === Js.oct(22) ? null : this.vfs.umask,
    };
  }

  /** The snapshot as JSON, for saving. */
  snapshotJson(): string {
    return snapshotToJson(this.snapshot());
  }

  // =====================================================================================================
  // Shell.Execute.cs – running a typed line: execute, the syntax tree walker (exec/execCompound), loops and
  // arithmetic.
  // =====================================================================================================

  execute(line: string): ExecResult {
    this.clearRequested = false;
    this.steps = 0;
    let output = "";
    const term = new XIO(
      (s) => (output += s),
      (s) => (output += s),
      null,
      true,
    );
    const result = (l: string, incomplete = false): ExecResult => ({
      line: l,
      output: incomplete || this.pendingQuestion !== null ? output : output + this.jobNotifications(),
      exitCode: this.lastExit,
      clear: this.clearRequested,
      pending: this.pendingQuestion !== null,
      incomplete,
    });

    if (this.pendingQuestion !== null) {
      const p = this.pendingQuestion;
      this.pendingQuestion = null;
      const answer = line.trim();
      const yes = answer === "" ? p.defaultYes : yesRe.test(answer);
      this.currentLine = p.line;
      this.guard(term, () => {
        this.lastExit = this.runAs(p.user, () => p.onAnswer(yes, term, line));
        // If the answer asks a new question (e.g. "Retype new password:") the rest of the line runs after it.
        if (p.resume && this.pendingQuestion !== null) this.pendingQuestion.resume ??= p.resume;
        else if (p.resume) this.lastExit = p.resume(term);
      });
      return result(p.line);
    }

    // Scheduled jobs whose time has come run first (cron), as they would have while you were typing.
    if (this.partial === null) CronCmd.tick(this);
    const text = this.partial !== null ? `${this.partial}\n${line}` : line;
    let ast: Node;
    try {
      ast = this.parseCode(text);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      if (e.incomplete && text.split("\n").length < 500) {
        this.partial = text;
        return result(text, true);
      }
      this.partial = null;
      this.addHistory(text);
      term.err(`${this.shellMode}: ${e.message}\n`);
      this.lastExit = 2;
      return result(ShellLib.flattenLines(text));
    }
    this.partial = null;
    const flat = ShellLib.flattenLines(text);
    this.addHistory(flat);
    this.currentLine = flat;
    this.guard(term, () => (this.lastExit = this.exec(ast, term)));
    return result(flat);
  }

  private addHistory(text: string): void {
    if (text.trim() === "" || text.startsWith(" ")) return;
    this.history.push(ShellLib.flattenLines(text));
    if (this.history.length > 500) this.history.splice(0, this.history.length - 500);
  }

  /** Runs fn and catches signals that must not leak out of a run. */
  private guard(io: Sink, fn: () => void): void {
    try {
      fn();
    } catch (e) {
      if (e instanceof LimitError) {
        io.err(`\n${Shell.Dim}${e.message}${Shell.Reset}\n`);
        this.lastExit = 130;
      } else if (e instanceof ExitSignal) {
        this.lastExit = e.code;
      } else if (e instanceof ReturnSignal) {
        this.lastExit = e.code;
      } else if (!(e instanceof LoopSignal)) {
        throw e;
      }
    } finally {
      this.listDepth = 0;
    }
  }

  private tick(): void {
    if (++this.steps > StepLimit) {
      throw new LimitError(this.msg("shell.stepLimit", { steps: this.formatNumber(StepLimit) }));
    }
  }

  /** Runs a line (or a whole script) in the current shell. */
  runLine(line: string, sink: Sink): number {
    try {
      return (this.lastExit = this.exec(this.parseCode(line), new XIO(sink.outFn, sink.errFn, null, false)));
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      sink.err(`${this.shellMode}: ${e.message}\n`);
      return (this.lastExit = 2);
    }
  }

  private exec(node: Node, io: XIO): number {
    let code: number;
    switch (node.type) {
      case "list": {
        if (node.items.length === 0) return this.lastExit;
        this.listDepth++;
        code = this.lastExit;
        try {
          for (let k = 0; k < node.items.length; k++) {
            const item = node.items[k]!;
            code = item.background ? this.startJob(item.node, io) : this.exec(item.node, io);
            if (this.pendingQuestion !== null) {
              // A question (e.g. from read or apt) – run the rest when it has been answered.
              const rest = node.items.slice(k + 1);
              if (this.listDepth === 1 && rest.length > 0 && !this.pendingQuestion.resume) {
                this.pendingQuestion.resume = (io2) => this.exec({ type: "list", items: rest }, io2);
              }
              break;
            }
          }
        } finally {
          this.listDepth--;
        }
        break;
      }
      case "andor": {
        code = this.exec(node.first, io);
        for (const item of node.rest) {
          if (this.pendingQuestion !== null) break;
          if ((item.op === "&&" && code !== 0) || (item.op === "||" && code === 0)) continue;
          code = this.exec(item.node, io);
        }
        break;
      }
      case "pipeline": {
        let input = io.stdin;
        code = 0;
        for (let i = 0; i < node.commands.length; i++) {
          const last = i === node.commands.length - 1;
          let buf = "";
          const stage = new XIO(last ? io.outFn : (s) => (buf += s), io.errFn, input, last && io.tty);
          code = this.exec(node.commands[i]!, stage);
          input = new Reader(buf, 0);
        }
        if (node.negate) code = code === 0 ? 1 : 0;
        break;
      }
      case "simple":
        code = this.runSimple(node, io);
        break;
      case "funcdef":
        this.functions.set(node.name, node.body);
        code = 0;
        break;
      case "if":
      case "for":
      case "cfor":
      case "while":
      case "case":
      case "group":
      case "arith": {
        const compound = node;
        code = this.withRedirects(compound.redirects, io, (rio) => this.execCompound(compound, rio));
        break;
      }
      default:
        throw new Error(`Unknown node ${(node as Node).type}`);
    }
    this.lastExit = code;
    return code;
  }

  private execCompound(node: CompoundNode, io: XIO): number {
    switch (node.type) {
      case "if": {
        for (const clause of node.clauses) {
          if (this.exec(clause.cond, io) === 0) return this.exec(clause.body, io);
          if (this.pendingQuestion !== null) return 0;
        }
        return node.elseBody ? this.exec(node.elseBody, io) : 0;
      }
      case "for": {
        const values = node.words ? node.words.flatMap((w) => this.expandWord(w, io)) : (this.positional.at(-1) ?? ["bash"]).slice(1);
        let code = 0;
        this.runLoop(
          () => values.length > 0,
          () => {
            const v = values.shift()!;
            this.setVar(node.name, v);
            code = this.exec(node.body, io);
          },
        );
        return code;
      }
      case "cfor": {
        let code = 0;
        if (!this.arith(node.init, io).ok) return 1;
        this.runLoop(
          () => {
            const r = node.cond.trim() !== "" ? this.arith(node.cond, io) : { ok: true, value: 1n };
            return r.ok && r.value !== 0n;
          },
          () => (code = this.exec(node.body, io)),
          () => this.arith(node.step, io),
        );
        return code;
      }
      case "while": {
        let code = 0;
        this.runLoop(
          () => {
            const c = this.exec(node.cond, io);
            return node.until ? c !== 0 : c === 0;
          },
          () => (code = this.exec(node.body, io)),
        );
        return code;
      }
      case "case": {
        const value = this.expandWord(node.word, io, { split: false, glob: false }).join(" ");
        for (const item of node.items) {
          if (item.patterns.some((p) => ParserLib.globToRegex(this.expandPattern(p, io), true).test(value))) {
            return item.body ? this.exec(item.body, io) : 0;
          }
        }
        return 0;
      }
      case "group": {
        if (!node.subshell) return this.exec(node.body, io);
        const saved = { cwd: this.cwd, env: Js.copy(this.env), exported: new Set(this.exported), functions: Js.copy(this.functions) };
        try {
          return this.exec(node.body, io);
        } catch (e) {
          if (e instanceof ExitSignal) return e.code;
          throw e;
        } finally {
          this.cwd = saved.cwd;
          this.env = saved.env;
          this.exported = saved.exported;
          this.functions = saved.functions;
        }
      }
      case "arith": {
        const r = this.arith(node.expr, io);
        return r.ok && r.value !== 0n ? 0 : 1;
      }
    }
  }

  /** Shared loop logic with break/continue and protection against infinite loops. */
  private runLoop(cond: () => boolean, body: () => void, step: (() => void) | null = null): void {
    this.loopDepth++;
    try {
      for (;;) {
        this.tick();
        if (!cond() || this.pendingQuestion !== null) break;
        try {
          body();
        } catch (e) {
          if (!(e instanceof LoopSignal)) throw e;
          if (e.levels > 1) {
            e.levels--;
            throw e;
          }
          if (e.kind === "break") break;
        }
        if (this.pendingQuestion !== null) break;
        step?.();
      }
    } finally {
      this.loopDepth--;
    }
  }

  private arith(expr: string, io: Sink): { ok: boolean; value: bigint } {
    try {
      const value = ArithLib.evalArith(this.expandString(expr, io), {
        get: (n) => this.getVar(n),
        set: (n, v) => this.setVar(n, v),
      });
      return { ok: true, value };
    } catch (e) {
      if (!(e instanceof ArithError)) throw e;
      io.err(`bash: ${expr.trim()}: ${e.message}\n`);
      return { ok: false, value: 0n };
    }
  }

  // =====================================================================================================
  // Shell.Invoke.cs – simple commands: assignments, aliases, functions, positional parameters, command lookup
  // and "command not found".
  // =====================================================================================================

  private runSimple(node: SimpleNode, io: XIO): number {
    this.tick();
    // Aliases: replace the first word if it is an alias.
    let words = node.words;
    const first = words[0];
    const aliasText = first && first.parts.length === 1 && first.parts[0]!.quoted === "none" ? this.aliases.get(first.raw) : undefined;
    if (aliasText !== undefined) {
      const aliasWords = ParserLib.tokenize(aliasText).flatMap((t) => (t.t === "word" ? [t.w] : []));
      words = [...aliasWords, ...words.slice(1)];
    }

    // Variable assignments first on the line: NAME=value (not split at spaces).
    const assignments: { name: string; value: string }[] = [];
    let k = 0;
    for (; k < words.length; k++) {
      const firstPart = words[k]!.parts[0];
      const m = assignRe.exec(firstPart?.quoted === "none" ? firstPart.text : "");
      if (!m) break;
      const value = this.expandWord(words[k]!, io, { split: false, glob: false }).join("");
      assignments.push({ name: m[1]!, value: value.slice(m[1]!.length + 1) });
    }
    const cmdName = k < words.length ? words[k]!.raw : null;
    const noSplit = noSplitCommands.has(cmdName ?? "");
    // In [[ ... ]] there is no word splitting or filename expansion – patterns like *.txt are compared as text.
    const literalArgs = cmdName === "[[";
    const argv: string[] = [];
    for (let idx = 0; idx < words.length - k; idx++) {
      const w = words[k + idx]!;
      argv.push(
        ...(literalArgs
          ? this.expandWord(w, io, { split: false, glob: false })
          : noSplit && idx > 0
            ? this.expandWord(w, io, { split: false })
            : this.expandWord(w, io)),
      );
    }

    if (argv.length === 0) {
      for (const { name, value } of assignments) this.setVar(name, value);
      return this.withRedirects(node.redirects, io, () => (assignments.length > 0 ? this.lastExit : 0));
    }

    // NAME=value command: the variable is set and exported for that command only.
    const saved = assignments.map((a) => ({ name: a.name, value: this.env.get(a.name) ?? null, exported: this.exported.has(a.name) }));
    for (const { name, value } of assignments) {
      this.env.set(name, value);
      this.exported.add(name);
    }
    try {
      return this.withRedirects(node.redirects, io, (rio) =>
        this.invoke(
          argv,
          new IO(rio.outFn, rio.errFn, rio.stdin !== null ? rio.stdin.data.slice(Math.min(rio.stdin.pos, rio.stdin.data.length)) : null, rio.tty, rio.stdin),
        ),
      );
    } finally {
      for (const { name, value, exported } of saved) {
        if (value === null) this.env.delete(name);
        else this.env.set(name, value);
        if (!exported) this.exported.delete(name);
      }
    }
  }

  /** Runs a command with ready arguments. Also used by sudo. */
  invoke(argv: string[], io: IO, viaSudo = false): number {
    const name = argv[0]!;
    const args = argv.slice(1);
    const ctx = new CmdCtx(io, this, name, args);
    const builtin = IndexCmd.commands().get(name);
    try {
      if (!viaSudo && this.functions.has(name)) return this.callFunction(name, args, io);
      if (builtin?.builtin === true && !viaSudo) return builtin.run(ctx);
      // zsh with `setopt autocd`: a directory name as a command changes directory.
      if (args.length === 0 && this.shellMode === "zsh" && this.shellStack.length > 0 && this.shellStack.at(-1)!.options.get("autocd") === true && !viaSudo) {
        if (this.vfs.tryLookup(this.resolve(name), this.currentUser())?.type === "dir") return this.invoke(["cd", name], io);
      }

      const found = this.resolveCommand(name);
      switch (found.kind) {
        case "notfound":
          if (viaSudo) {
            io.err(`sudo: ${name}: command not found\n`);
            this.notFoundHint(name, io);
          } else this.commandNotFound(name, io);
          return viaSudo ? 1 : 127;
        case "error":
          io.err(`${viaSudo ? "sudo" : "bash"}: ${name}: ${found.message}\n`);
          return 126;
        case "script":
          return this.runScript(found.content, name, args, io);
        default: {
          const def: CommandDef | undefined = IndexCmd.commands().get(found.impl);
          if (!def) {
            io.err(`bash: ${name}: cannot execute binary file\n`);
            return 126;
          }
          if (args.length > 0 && args[0] === "--help" && def.man !== null && def.man !== undefined && !pkgManagers.has(def.name)) {
            io.out(UtilCmd.formatMan(def.name, ManEnCmd.manFor(def, this)));
            return 0;
          }
          return def.run(ctx);
        }
      }
    } catch (e) {
      if (e instanceof ControlSignal) throw e;
      io.err(`${name}: ${this.msg("shell.internalError")}: ${e instanceof Error ? e.message : String(e)}\n`);
      return 1;
    }
  }

  private toXIO(io: IO): XIO {
    return new XIO(io.outFn, io.errFn, io.reader ?? (io.stdin !== null ? new Reader(io.stdin, 0) : null), io.isTTY);
  }

  private callFunction(name: string, args: string[], io: IO): number {
    if (this.funcDepth >= 100) {
      io.err(`bash: ${name}: maximum function nesting level exceeded (100)\n`);
      return 1;
    }
    this.positional.push([this.positional.at(-1)?.[0] ?? "bash", ...args]);
    this.locals.push(new Map());
    this.funcDepth++;
    try {
      return this.exec(this.functions.get(name)!, this.toXIO(io));
    } catch (e) {
      if (e instanceof ReturnSignal) return e.code;
      throw e;
    } finally {
      this.funcDepth--;
      this.positional.pop();
      const top = this.locals.pop()!;
      for (const [k, v] of top) {
        if (v === null) this.env.delete(k);
        else this.env.set(k, v);
      }
    }
  }

  /** `local NAME[=value]` in a function. */
  declareLocal(name: string, value: string | null): boolean {
    const frame = this.locals.at(-1);
    if (!frame || this.funcDepth === 0) return false;
    if (!frame.has(name)) frame.set(name, this.env.get(name) ?? null);
    if (value !== null) this.env.set(name, value);
    else this.env.delete(name);
    return true;
  }

  /** Positional parameters ($1, $2 ...) for the current script/function. */
  get args(): string[] {
    return (this.positional.at(-1) ?? ["bash"]).slice(1);
  }

  setArgs(args: string[]): void {
    const top = this.positional.at(-1);
    if (top) top.splice(1, top.length - 1, ...args);
    else this.positional.push(["bash", ...args]);
  }

  resolveCommand(name: string): ResolvedCommand {
    const user = this.currentUser();
    const check = (path: string, node: FsNode): ResolvedCommand => {
      if (node.type === "dir") return resolvedCommand({ kind: "error", message: "Is a directory" });
      if (!VfsLib.hasPerm(node, user, "x")) return resolvedCommand({ kind: "error", message: "Permission denied" });
      const content = node.content ?? "";
      // The binary says itself which program it is, so it works even when renamed
      // (e.g. ./Calculator.AppImage or /snap/bin/hello-world which points to snap).
      const m = elfImplRe.exec(content);
      const impl = m ? m[1]! : VfsLib.basename(path);
      if (content.startsWith(VfsLib.Elf)) return resolvedCommand({ kind: "binary", impl, path });
      if (!VfsLib.hasPerm(node, user, "r")) return resolvedCommand({ kind: "error", message: "Permission denied" });
      return resolvedCommand({ kind: "script", content, path });
    };
    if (name.includes("/")) {
      const path = this.resolve(name);
      try {
        return check(path, this.vfs.lookup(path, user));
      } catch (e) {
        if (e instanceof FsError) return resolvedCommand({ kind: "error", message: e.message });
        throw e;
      }
    }
    for (const dir of (this.env.get("PATH") ?? "").split(":")) {
      if (dir === "") continue;
      const path = `${dir}/${name}`;
      const node = this.vfs.tryLookup(path, user);
      if (node !== null && node.type === "file" && VfsLib.hasPerm(node, user, "x")) return check(path, node);
    }
    return resolvedCommand({ kind: "notfound" });
  }

  private commandNotFound(name: string, io: IO): void {
    const pkg = PackagesLib.packageProviding(this.distro.family, name);
    const pkgName = pkg?.names.get(this.distro.family);
    if (pkg !== null && pkgName !== undefined && this.distro.id === "ubuntu" && this.shellMode === "bash") {
      io.err(`Command '${name}' not found, but can be installed with:\nsudo apt install ${pkgName}\n`);
      return;
    }
    const mode = this.shellMode;
    io.err(mode === "zsh" ? `zsh: command not found: ${name}\n` : mode === "fish" ? `fish: Unknown command: ${name}\n` : `bash: ${name}: command not found\n`);
    this.notFoundHint(name, io);
  }

  /**
   * After the real "command not found": a dim line from the simulator, so the learner knows whether the
   * mistake is theirs or the simulator's. A command in a package that is not installed → which package;
   * a real Linux command that the simulator does not have → say so; otherwise a likely typo → "Did you mean".
   */
  notFoundHint(name: string, io: Sink): void {
    const pkgName = PackagesLib.packageProviding(this.distro.family, name)?.names.get(this.distro.family);
    if (pkgName !== undefined) {
      io.err(`${Shell.Dim}${this.msg("shell.commandInPackage", { pkg: pkgName })}${Shell.Reset}\n`);
      return;
    }
    if (KnownCommands.notInSimulator(name)) {
      io.err(`${Shell.Dim}${this.msg("shell.notInSimulator", { cmd: name })}${Shell.Reset}\n`);
      return;
    }
    const similar = this.similarCommands(name);
    if (similar.length > 0) io.err(`${Shell.Dim}${this.msg("shell.didYouMean", { cmds: similar.join(", ") })}${Shell.Reset}\n`);
  }

  /** Up to three commands that can be run here and are one or two typos away from name. */
  similarCommands(name: string): string[] {
    if (name.length < 2 || name.includes("/")) return [];
    const max = name.length <= 3 ? 1 : 2;
    const runnable: string[] = [];
    const seen = new Set<string>();
    const add = (c: string): void => {
      if (!seen.has(c)) {
        seen.add(c);
        runnable.push(c);
      }
    };
    for (const [key, def] of IndexCmd.commands()) {
      if (key === def.name && !key.startsWith("__") && (def.builtin === true || this.resolveCommand(key).kind !== "notfound")) add(key);
    }
    for (const a of this.aliases.keys()) add(a);
    for (const f of this.functions.keys()) add(f);
    return runnable
      .map((c) => ({ cmd: c, d: UtilCmd.typoDistance(name, c) }))
      .filter((x) => x.d > 0 && x.d <= max)
      .sort((a, b) => a.d - b.d || Js.ordinal(a.cmd, b.cmd))
      .slice(0, 3)
      .map((x) => x.cmd);
  }

  // =====================================================================================================
  // Shell.Expansion.cs – variables and expansion: $VAR, ${...}, $(...), $((...)), word splitting and wildcards.
  // =====================================================================================================

  getVar(name: string): string | null {
    if (name === "RANDOM") return String(Math.floor(Js.random() * 32768));
    if (name === "PWD") return this.cwd;
    if (name === "UID") return String(this.currentUser().uid);
    if (name === "ZSH_VERSION" && this.shellMode === "zsh") return ShellmodeLib.ZshVersion;
    if (name === "FISH_VERSION" && this.shellMode === "fish") return ShellmodeLib.fishVersion(this);
    return this.env.get(name) ?? null;
  }

  setVar(name: string, value: string): void {
    this.env.set(name, value);
  }

  /** `unset NAME`: the variable and its export are gone. */
  unsetVar(name: string): void {
    this.env.delete(name);
    this.exported.delete(name);
  }

  /** The environment a program or script started by the shell gets: the exported variables that have a value. */
  environment(): Obj<string> {
    const env = Js.obj<string>();
    for (const [k, v] of this.env) if (this.exported.has(k)) env.set(k, v);
    return env;
  }

  /** An environment variable as a program started by the shell sees it: null when it is unset or not exported. */
  envVar(name: string): string | null {
    return this.exported.has(name) ? (this.env.get(name) ?? null) : null;
  }

  /**
   * Runs fn as a new process started by the shell: it gets env (by default the exported variables) and no shell
   * functions, and what it changes – variables, functions, the working directory – stays there.
   */
  asChild<T>(fn: () => T, env: Obj<string> = this.environment()): T {
    const saved = { cwd: this.cwd, env: this.env, exported: this.exported, functions: this.functions };
    this.env = env;
    this.exported = new Set(env.keys());
    this.functions = Js.obj<Node>();
    try {
      return fn();
    } finally {
      this.cwd = saved.cwd;
      this.env = saved.env;
      this.exported = saved.exported;
      this.functions = saved.functions;
    }
  }

  /** Runs code and returns its output (for $(...) and `...`). */
  private captureOutput(code: string, io: Sink): string {
    let ast: Node;
    try {
      ast = ParserLib.parse(code);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      io.err(`bash: command substitution: ${e.message}\n`);
      return "";
    }
    let buf = "";
    const saved = { cwd: this.cwd, env: Js.copy(this.env), exported: new Set(this.exported), functions: Js.copy(this.functions) };
    const savedPending = this.pendingQuestion;
    this.substDepth++;
    try {
      this.exec(
        ast,
        new XIO(
          (s) => (buf += s),
          io.errFn,
          null,
          false,
        ),
      );
    } catch (e) {
      if (e instanceof ExitSignal) this.lastExit = e.code;
      else throw e;
    } finally {
      this.substDepth--;
      const exit = this.lastExit;
      this.cwd = saved.cwd;
      this.env = saved.env;
      this.exported = saved.exported;
      this.functions = saved.functions;
      this.lastExit = exit;
      this.pendingQuestion = savedPending;
    }
    return buf.replace(trailingNewlines, "");
  }

  /** ${...}: ${NAME}, ${#NAME}, ${NAME:-default}, ${NAME%.txt} and more. */
  private paramExpand(inner: string, io: Sink): string {
    if (inner.startsWith("#") && inner.length > 1) return String(Js.codePointLength(this.special(inner.slice(1)) ?? ""));
    const m = paramNameRe.exec(inner);
    if (!m) throw new ExpansionError(`\${${inner}}: bad substitution`);
    const name = m[1]!;
    const rest = m[2]!;
    const value = this.special(name);
    if (rest === "") return value ?? "";
    const op = paramOpRe.exec(rest);
    if (!op) throw new ExpansionError(`\${${inner}}: bad substitution`);
    const kind = op[1]!;
    const arg = op[2]!;
    const word = (): string => this.expandString(arg, io);
    const unsetOrEmpty = kind.startsWith(":") ? value === null || value === "" : value === null;
    switch (kind) {
      case ":-":
      case "-":
        return unsetOrEmpty ? word() : value!;
      case ":=":
      case "=":
        if (unsetOrEmpty) this.setVar(name, word());
        return this.env.get(name) ?? "";
      case ":+":
      case "+":
        return unsetOrEmpty ? "" : word();
      case ":?":
      case "?":
        if (unsetOrEmpty) throw new ExpansionError(`${name}: ${arg !== "" ? arg : "parameter null or not set"}`);
        return value!;
    }
    // Remove a prefix (#, ##) or suffix (%, %%) matching a pattern.
    const v = value ?? "";
    const re = ParserLib.globToRegex(this.expandString(arg, io), true);
    const longest = kind.length === 2;
    const cuts = Array.from({ length: v.length + 1 }, (_, i) => i);
    if (kind.startsWith("#")) {
      for (const i of longest ? [...cuts].reverse() : cuts) if (re.test(v.slice(0, i))) return v.slice(i);
    } else {
      for (const i of longest ? cuts : [...cuts].reverse()) if (re.test(v.slice(i))) return v.slice(0, i);
    }
    return v;
  }

  /** The value of an ordinary or special parameter ($1, $#, $? ...). */
  private special(name: string): string | null {
    const pos = this.positional.at(-1) ?? [this.shellMode];
    if (digitsRe.test(name)) {
      const n = Number(name);
      return n < pos.length ? pos[n]! : null;
    }
    switch (name) {
      case "?":
        return String(this.lastExit);
      case "#":
        return String(pos.length - 1);
      case "@":
      case "*":
        return pos.slice(1).join(" ");
      case "$":
        return "4242";
      case "!":
        return this.lastBgPid !== null ? String(this.lastBgPid) : "";
      case "-":
        return "himBH";
    }
    return this.getVar(name);
  }

  /**
   * Expands a word into zero or more fields: ~, $VAR, ${...}, $(...), `...`, $((...)),
   * word splitting of unquoted expansions, and wildcards.
   */
  expandWord(w: Word, io: Sink | null = null, opts: ExpandOptions = {}): string[] {
    const split = opts.split ?? true;
    const glob = opts.glob ?? true;
    const sink = io ?? Sink.null();
    const newField = (): Field => ({ value: "", pattern: "", hasGlob: false, touched: false });
    let cur = newField();
    const fields: Field[] = [cur];
    const startField = (): void => {
      cur = newField();
      fields.push(cur);
    };
    const literal = (text: string, quoted: boolean): void => {
      cur.value += text;
      cur.pattern += quoted ? ParserLib.escapeGlob(text) : text;
      if (!quoted && ParserLib.hasUnescapedGlob(text)) cur.hasGlob = true;
      cur.touched = true;
    };
    // zsh does not split unquoted $variables at spaces (unless setopt shwordsplit).
    const zshParams = this.shellMode === "zsh" && !(this.shellStack.length > 0 && this.shellStack.at(-1)!.options.get("shwordsplit") === true);
    const expansion = (text: string, quoted: boolean, param: boolean): void => {
      if (param && zshParams && !quoted) {
        if (text !== "") literal(text, true);
        return;
      }
      if (quoted || !split) {
        literal(text, quoted);
        return;
      }
      const pieces = text.split(splitRe);
      for (let idx = 0; idx < pieces.length; idx++) {
        if (idx > 0 && cur.touched) startField();
        if (pieces[idx] !== "") literal(pieces[idx]!, false);
      }
    };

    try {
      for (let idx = 0; idx < w.parts.length; idx++) {
        const part = w.parts[idx]!;
        if (part.quoted === "single") {
          literal(part.text, true);
          continue;
        }
        let text = part.text;
        const quoted = part.quoted === "double";
        if (idx === 0 && !quoted && (text === "~" || text.startsWith("~/"))) {
          literal(this.home, true);
          text = text.slice(1);
        } else if (idx === 0 && !quoted && assignRe.test(text)) {
          // As in bash: in a word that looks like an assignment (NAME=~/dir, also as an argument to export), ~ is
          // expanded after the = and after each : (PATH=~/bin:~/.local/bin).
          const last = w.parts.length === 1;
          text = text.replace(assignTildeRe, (m, before: string, after: string) => (after !== "" || last ? before + this.home : m));
        }
        if (quoted && text !== "$@") cur.touched = true;
        this.scan(text, sink, {
          literal: (t) => literal(t, quoted),
          expansion: (t, param) => expansion(t, quoted, param),
          fields: (list) => {
            // "$@" becomes one field per argument.
            if (!quoted) {
              expansion(list.join(" "), false, false);
              return;
            }
            for (let i = 0; i < list.length; i++) {
              if (i > 0) startField();
              literal(list[i]!, true);
            }
          },
        });
      }
    } catch (e) {
      if (!(e instanceof ExpansionError)) throw e;
      sink.err(`bash: ${e.message}\n`);
      return [];
    }

    const result: string[] = [];
    for (const f of fields) {
      if (!f.touched) continue;
      if (glob && f.hasGlob) {
        const matches = this.glob(f.pattern);
        if (matches.length > 0) {
          result.push(...matches);
          continue;
        }
      }
      result.push(f.value);
    }
    return result;
  }

  /** Expands a pattern (for case and ${x%pattern}) without matching against files. */
  private expandPattern(w: Word, io: Sink): string {
    let pattern = "";
    for (const part of w.parts) {
      if (part.quoted === "single") {
        pattern += ParserLib.escapeGlob(part.text);
      } else {
        const quoted = part.quoted === "double";
        this.scan(part.text, io, {
          literal: (t) => (pattern += quoted ? ParserLib.escapeGlob(t) : t),
          expansion: (t) => (pattern += quoted ? ParserLib.escapeGlob(t) : t),
          fields: (l) => (pattern += l.join(" ")),
        });
      }
    }
    return pattern;
  }

  /** Expands text as if it stood inside double quotes. */
  expandString(text: string, io: Sink | null = null): string {
    let result = "";
    this.scan(text, io ?? Sink.null(), {
      literal: (t) => (result += t),
      expansion: (t) => (result += t),
      fields: (l) => (result += l.join(" ")),
    });
    return result;
  }

  /** Walks through text and finds $-expressions and `...`. */
  private scan(text: string, io: Sink, emit: ScanEmit): void {
    let lit = "";
    const flush = (): void => {
      if (lit.length > 0) emit.literal(lit);
      lit = "";
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      if (c === "`") {
        let j = i + 1;
        while (j < text.length && text[j] !== "`") j += text[j] === "\\" ? 2 : 1;
        flush();
        emit.expansion(this.captureOutput(text.slice(i + 1, j).replaceAll("\\`", "`"), io), false);
        i = j;
        continue;
      }
      if (c !== "$" || i + 1 >= text.length) {
        lit += c;
        continue;
      }
      const next = text[i + 1]!;
      if (next === "(") {
        const j = ParserLib.findClosingParen(text, i + 1);
        if (j < 0) {
          lit += c;
          continue;
        }
        flush();
        if (i + 2 < text.length && text[i + 2] === "(" && text[j - 1] === ")") {
          const expr = text.slice(i + 3, j - 1);
          const r = this.arith(expr, io);
          if (!r.ok) throw new ExpansionError(`${expr}: arithmetic error`);
          emit.expansion(r.value.toString(), false);
        } else {
          emit.expansion(this.captureOutput(text.slice(i + 2, j), io), false);
        }
        i = j;
        continue;
      }
      if (next === "{") {
        const j = text.indexOf("}", i);
        if (j < 0) {
          lit += c;
          continue;
        }
        flush();
        emit.expansion(this.paramExpand(text.slice(i + 2, j), io), true);
        i = j;
        continue;
      }
      const nm = varNameRe.exec(text.slice(i + 1));
      if (nm) {
        flush();
        emit.expansion(this.getVar(nm[0]) ?? "", true);
        i += nm[0].length;
        continue;
      }
      if (next === "@" || next === "*") {
        flush();
        emit.fields(this.args);
        i++;
        continue;
      }
      if (specialCharRe.test(next)) {
        flush();
        emit.expansion(this.special(next) ?? "", true);
        i++;
        continue;
      }
      lit += c;
    }
    flush();
  }

  glob(pattern: string): string[] {
    const user = this.currentUser();
    const abs = pattern.startsWith("/");
    const segs = pattern.split("/").filter((s) => s !== "");
    let results = [abs ? "/" : ""];
    const join = (b: string, name: string): string => (b === "" ? name : b === "/" ? `/${name}` : `${b}/${name}`);
    for (const seg of segs) {
      const next: string[] = [];
      for (const b of results) {
        if (seg === "**" && this.shellMode !== "bash") {
          // zsh and fish: ** matches every subdirectory, on every level (also none at all).
          const walk = (dir: string): void => {
            next.push(dir);
            const node = this.vfs.tryLookup(this.resolve(dir === "" ? "." : dir), user);
            if (node === null || node.type !== "dir" || !VfsLib.hasPerm(node, user, "r")) return;
            for (const name of [...node.children!.keys()].sort()) {
              if (!name.startsWith(".") && node.children!.get(name)!.type === "dir") walk(join(dir, name));
            }
          };
          walk(b);
          continue;
        }
        if (!ParserLib.hasUnescapedGlob(seg)) {
          next.push(join(b, ParserLib.unescapeGlob(seg)));
          continue;
        }
        const dirNode = this.vfs.tryLookup(this.resolve(b === "" ? "." : b), user);
        if (dirNode === null || dirNode.type !== "dir" || !VfsLib.hasPerm(dirNode, user, "r")) continue;
        const re = ParserLib.globToRegex(seg);
        for (const name of [...dirNode.children!.keys()].sort()) {
          if (name.startsWith(".") && !seg.startsWith(".")) continue;
          if (re.test(name)) next.push(join(b, name));
        }
      }
      results = next;
    }
    // Broken symbolic links match too (they exist, even if what they point to does not).
    const found = results.filter((r) => r !== "" && this.vfs.tryLookupLink(this.resolve(r), user) !== null);
    return segs.includes("**") && this.shellMode !== "bash" ? found.sort() : found;
  }

  // =====================================================================================================
  // Shell.Redirection.cs – redirections (> >> < 2> 2>&1 &> here-documents) around a command.
  // =====================================================================================================

  /** Applies redirections (> >> < 2> 2>&1 &>) around fn. */
  private withRedirects(redirects: Redirect[], io: XIO, fn: (rio: XIO) => number): number {
    if (redirects.length === 0) return fn(io);
    const user = this.currentUser();
    let stdin = io.stdin;
    let stdoutTarget: string | null = null;
    let stderrTarget: string | null = null;
    let stderrToStdout = false;
    let stdoutToStderr = false;
    for (const r of redirects) {
      if (r.op === "2>&1") {
        stderrToStdout = true;
        stderrTarget = null;
        continue;
      }
      if (r.op === ">&2") {
        stdoutToStderr = true;
        continue;
      }
      if (r.op === "<<" || r.op === "<<-") {
        stdin = new Reader(r.expand === true ? this.expandString(r.body ?? "", io) : (r.body ?? ""), 0);
        continue;
      }
      if (r.op === "<<<") {
        stdin = new Reader(this.expandWord(r.target!, io, { split: false, glob: false }).join(" ") + "\n", 0);
        continue;
      }
      const targets = this.expandWord(r.target!, io);
      if (targets.length !== 1) {
        io.err(`bash: ${r.target!.raw}: ambiguous redirect\n`);
        return 1;
      }
      const path = this.resolve(targets[0]!);
      try {
        if (r.op === "<") {
          stdin = new Reader(this.vfs.readFile(path, user), 0);
        } else if (r.op === ">" || r.op === "&>" || r.op === ">>") {
          // The file is created/emptied before the command runs – just like in bash.
          this.vfs.writeFile(path, "", user, r.op === ">>");
          stdoutTarget = path;
          if (r.op === "&>") {
            stderrToStdout = true;
            stderrTarget = null;
          }
        } else {
          this.vfs.writeFile(path, "", user, r.op === "2>>");
          stderrTarget = path;
          stderrToStdout = false;
        }
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        io.err(`bash: ${targets[0]}: ${e.message}\n`);
        return 1;
      }
    }
    let stdout = "";
    let stderr = "";
    const out: (s: string) => void = stdoutTarget !== null ? (s) => (stdout += s) : stdoutToStderr ? io.errFn : io.outFn;
    const rio = new XIO(out, stderrToStdout ? out : stderrTarget !== null ? (s) => (stderr += s) : io.errFn, stdin, io.tty && stdoutTarget === null);
    try {
      return fn(rio);
    } finally {
      try {
        if (stdoutTarget !== null) this.vfs.writeFile(stdoutTarget, stdout, user, true);
        if (stderrTarget !== null && !stderrToStdout) this.vfs.writeFile(stderrTarget, stderr, user, true);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        io.err(`bash: ${e.message}\n`);
      }
    }
  }

  // =====================================================================================================
  // Shell.Jobs.cs – background jobs (command &) and their notifications.
  // =====================================================================================================

  /** Updates jobs whose time has run out (e.g. `sleep 5 &`). */
  refreshJobs(): void {
    const now = Js.now();
    for (const job of [...this.proc.jobs]) {
      if (job.state === "Running" && job.endsAt !== null && job.endsAt !== undefined && job.endsAt <= now) this.finishJob(job, "Done");
    }
  }

  finishJob(job: Job, state: string): void {
    job.state = state;
    this.proc.procs = this.proc.procs.filter((p) => p.pid !== job.pid);
  }

  /** `command &`: starts a background job and prints "[1] 4200". */
  private startJob(node: Node, io: XIO): number {
    this.refreshJobs();
    const cmd = ShellLib.nodeToString(node);
    const id = Math.max(0, ...this.proc.jobs.map((j) => j.id)) + 1;
    const pid = this.proc.nextPid++;
    this.lastBgPid = pid;
    io.err(`[${id}] ${pid}\n`);
    const seconds = ShellLib.sleepSeconds(node);
    if (seconds !== null) {
      // sleep runs "for real" in the background: the job finishes when the time has passed.
      this.proc.jobs.push({ id, pid, cmd, state: "Running", endsAt: Js.now() + Math.trunc(seconds * 1000) });
      this.proc.procs.push({
        pid,
        ppid: ProcsLib.ShellPid,
        user: this.currentUser().name,
        // nohup replaces itself with the command, so ps shows (and pkill finds) "sleep", while jobs shows the line.
        cmd: cmd.replace(nohupRe, ""),
        cpu: 0,
        mem: 0,
        vsz: 8_300,
        rss: 1_900,
        tty: "pts/0",
        stat: "S",
        start: Js.hhmm(Js.localNow()),
        time: "0:00",
      });
    } else {
      // Other commands run directly – in the simulator they finish at once.
      const exit = this.exec(node, io);
      this.proc.jobs.push({ id, pid, cmd, state: "Done", exit });
    }
    return 0;
  }

  /** "[1]+  Done   sleep 3" for jobs that have finished since last time. */
  private jobNotifications(): string {
    this.refreshJobs();
    const finished = this.proc.jobs.filter((j) => j.state !== "Running");
    if (finished.length === 0) return "";
    const last = this.proc.jobs.at(-1) ?? null;
    this.proc.jobs = this.proc.jobs.filter((j) => j.state === "Running");
    return finished
      .map((j) => {
        const state = j.state === "Done" && j.exit !== null && j.exit !== undefined && j.exit !== 0 ? `Exit ${j.exit}` : j.state;
        return `[${j.id}]${j === last ? "+" : "-"}  ${state.padEnd(24)}${j.cmd}\n`;
      })
      .join("");
  }

  // =====================================================================================================
  // Shell.Modes.cs – other shells (zsh, fish) on top of bash, parsing in the current shell's syntax, prompt and
  // welcome text.
  // =====================================================================================================

  /** The shell interpreting the commands right now. */
  get shellMode(): ShellMode {
    if (this.modeOverride.length > 0) return this.modeOverride.at(-1)!;
    const top = this.shellStack.at(-1);
    return top !== undefined && top.userDepth === this.userStack.length ? top.mode : "bash";
  }

  /** True when commands are typed directly in the terminal (not in a script or $(...)). */
  get interactive(): boolean {
    return this.modeOverride.length === 0 && this.substDepth === 0;
  }

  /** Starts a new interactive shell (zsh, fish or bash) on top of the current one. */
  startShell(mode: ShellMode, io: Sink): number {
    const pid = this.proc.nextPid++;
    const ppid = this.shellStack.at(-1)?.pid ?? ProcsLib.ShellPid;
    const user = this.currentUser();
    this.proc.procs.push(ShellmodeLib.shellProc(pid, ppid, user.name, mode));
    const saved: ShellFrameSaved = { cwd: this.cwd, env: Js.copy(this.env), exported: [...this.exported], aliases: this.aliases, functions: this.functions };
    // The new shell is a new process: it gets the environment variables, not the plain shell variables.
    this.env = this.environment();
    this.exported = new Set(this.env.keys());
    // `sudo zsh` gives a shell as root.
    const pushedUser = user.name !== (this.userStack.at(-1) ?? null);
    if (pushedUser) {
      this.userStack.push(user.name);
      this.env.set("USER", user.name);
      this.env.set("HOME", user.home);
    }
    this.shellStack.push({ mode, pid, userDepth: this.userStack.length, options: Js.obj<boolean>(), saved, pushedUser });
    // Aliases and functions are not inherited by a new shell – environment variables are.
    this.aliases = Js.obj<string>();
    this.functions = Js.obj<Node>();
    ShellmodeLib.shellStartup(this, mode, io);
    return 0;
  }

  /** Parses code with the current shell's syntax (fish is translated to bash first). */
  private parseCode(text: string, mode: ShellMode | null = null): Node {
    mode ??= this.shellMode;
    return ParserLib.parse(mode === "fish" ? FishLib.translateFish(text, this.lang) : text);
  }

  prompt(): string {
    if (this.pendingQuestion !== null) return this.pendingQuestion.question;
    if (this.partial !== null) return "> ";
    if (this.shellMode !== "bash") return ShellmodeLib.shellPrompt(this, this.shellMode);
    const u = this.currentUser();
    let p = this.cwd;
    if (p === u.home) p = "~";
    else if (p.startsWith(u.home + "/")) p = "~" + p.slice(u.home.length);
    const sym = u.uid === 0 ? "#" : "$";
    const host = this.distro.hostname;
    switch (this.distro.promptStyle) {
      case "ubuntu":
        return u.uid === 0 ? `${u.name}@${host}:${p}${sym} ` : `\x1b[1;32m${u.name}@${host}\x1b[0m:\x1b[1;34m${p}\x1b[0m${sym} `;
      case "debian":
        return `${u.name}@${host}:${p}${sym} `;
      default:
        return `[${u.name}@${host} ${p === "~" || p === "/" ? p : VfsLib.basename(p)}]${sym} `;
    }
  }

  welcome(): string {
    const motd = this.distro.motd !== "" ? this.distro.motd + "\n" : "";
    return motd + Shell.Dim + this.msg("shell.welcome", { distro: this.distro.name }) + `${Shell.Reset}\n`;
  }

  // =====================================================================================================
  // Shell.Questions.cs – questions to the user (yes/no and text answers) and Ctrl+C.
  // =====================================================================================================

  /** Asks the user yes/no. The answer is handled on the next execute(). */
  ask(question: string, defaultYes: boolean, onAnswer: (yes: boolean, io: Sink) => number): void {
    this.pendingQuestion = {
      question,
      defaultYes,
      onAnswer: (yes, io) => onAnswer(yes, io),
      user: this.currentUser().name,
      line: this.currentLine,
    };
  }

  /** Asks the user to type a line of text (used by `read`). With secret the answer is not shown (passwords). */
  askText(prompt: string, onText: (text: string, io: Sink) => number, secret = false): void {
    this.pendingQuestion = {
      question: prompt,
      defaultYes: false,
      onAnswer: (_yes, io, text) => onText(text, io),
      user: this.currentUser().name,
      line: this.currentLine,
      secret,
    };
  }

  /** Can `read` ask the user directly? Only on the command line, not inside scripts. */
  canAskInteractively(): boolean {
    return this.scriptDepth === 0 && this.substDepth === 0;
  }

  /** Cancels a question or a started multi-line command line (Ctrl+C). */
  cancel(): void {
    this.pendingQuestion = null;
    this.partial = null;
  }

  // =====================================================================================================
  // Shell.Scripts.cs – running scripts (in a subshell or sourced) and `exit`.
  // =====================================================================================================

  /**
   * Runs a script. By default as a new process: it gets only the environment variables (not plain shell variables or
   * functions), and its cd, variables and functions do not affect the caller. With inCurrentShell (source) it sees
   * everything and the changes stay.
   */
  runScript(content: string, name: string, args: string[], io: IO, inCurrentShell = false, mode: ShellMode | null = null): number {
    if (this.scriptDepth > 20) {
      io.err(`bash: ${name}: ${this.msg("shell.nestingTooDeep")}\n`);
      return 1;
    }
    if (mode === null && !inCurrentShell) {
      // The #! line decides which shell runs the script, whatever shell you use yourself.
      const sb = ShellmodeLib.shebang(content);
      if (sb !== null && sb.mode !== "bash" && this.resolveCommand(sb.mode).kind !== "binary") {
        io.err(`${this.shellMode}: ${name}: ${sb.interpreter}: bad interpreter: No such file or directory\n`);
        return 126;
      }
      mode = sb?.mode ?? "bash";
    }
    mode ??= this.shellMode;
    let ast: Node;
    try {
      ast = this.parseCode(content, mode);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      io.err(`${name}: ${e.message}\n`);
      return 2;
    }
    // A script that is not sourced runs in a new process: it sees only the environment variables (export), and
    // its variables, functions and cd do not come back.
    const saved = { cwd: this.cwd, env: this.env, exported: this.exported, functions: this.functions };
    if (!inCurrentShell) {
      this.env = this.environment();
      this.exported = new Set(this.env.keys());
      this.functions = Js.obj<Node>();
    }
    this.scriptDepth++;
    if (!inCurrentShell) this.modeOverride.push(mode);
    this.positional.push([name, ...args]);
    const savedLoopDepth = this.loopDepth;
    this.loopDepth = 0;
    let code = 0;
    try {
      code = this.exec(ast, this.toXIO(io));
    } catch (e) {
      if (e instanceof ExitSignal) code = e.code;
      else if (e instanceof ReturnSignal) code = e.code;
      else if (e instanceof LoopSignal) code = 0;
      else throw e;
    } finally {
      this.scriptDepth--;
      if (!inCurrentShell) this.modeOverride.pop();
      this.positional.pop();
      this.loopDepth = savedLoopDepth;
      if (!inCurrentShell) {
        this.cwd = saved.cwd;
        this.env = saved.env;
        this.exported = saved.exported;
        this.functions = saved.functions;
      }
    }
    this.lastExit = code;
    return code;
  }

  /** Called by `exit`. */
  exit(code: number, io: IO): number {
    if (this.scriptDepth > 0 || this.substDepth > 0) throw new ExitSignal(code);
    const top = this.shellStack.at(-1);
    if (top !== undefined && top.userDepth === this.userStack.length) {
      // Back to the shell that started zsh/fish – with its variables, aliases and directory.
      this.shellStack.pop();
      if (top.pushedUser === true) this.userStack.pop();
      this.cwd = top.saved.cwd;
      this.env = top.saved.env;
      this.exported = new Set(top.saved.exported ?? top.saved.env.keys());
      this.aliases = top.saved.aliases;
      this.functions = top.saved.functions;
      this.flags.set(`left:${top.mode}`, true);
      this.proc.procs = this.proc.procs.filter((p) => p.pid !== top.pid);
      return code;
    }
    if (this.userStack.length > 1) {
      this.userStack.pop();
      const u = this.currentUser();
      this.cwd = u.home;
      this.env.set("HOME", u.home);
      this.env.set("USER", u.name);
      this.env.set("LOGNAME", u.name);
      io.out("logout\n");
      return code;
    }
    io.out(`${Shell.Dim}${this.msg("shell.exitNoSession")}${Shell.Reset}\n`);
    return 0;
  }

  // =====================================================================================================
  // Shell.Users.cs – the current user, sudo (runAs), home, path resolving and the simulator's own messages.
  // =====================================================================================================

  /** The user according to /etc/passwd and /etc/group (see Users/UsersLib.ts). */
  getUser(name: string): User {
    return UsersLib.lookupUser(this, name);
  }

  rootUser(): User {
    return this.getUser("root");
  }

  currentUser(): User {
    return this.getUser(this.overrides.at(-1) ?? this.userStack.at(-1) ?? this.world.user);
  }

  /** Runs fn as another user (used by sudo). */
  runAs<T>(user: string, fn: () => T): T {
    this.overrides.push(user);
    try {
      return fn();
    } finally {
      this.overrides.pop();
    }
  }

  get home(): string {
    return this.env.get("HOME") ?? this.world.home;
  }

  resolve(path: string): string {
    return VfsLib.resolvePath(this.cwd, path);
  }

  /** The simulator's own message key in the shell's language (see ShellI18n). */
  msg(key: string, args?: ShellI18n.MsgArgs): string {
    return ShellI18n.msg(this.lang, key, args);
  }

  /** A whole number formatted for the shell's language (10 000, 10,000, 10.000 ...). */
  formatNumber(n: number): string {
    return ShellI18n.formatNumber(this.lang, n);
  }

  requestClear(): void {
    this.clearRequested = true;
  }

  // =====================================================================================================
  // Shell.Completion.cs – tab completion of commands and file names.
  // =====================================================================================================

  /** Every command that can run right now (builtins + functions + executable files in PATH). */
  availableCommands(): string[] {
    const names = new Set<string>();
    for (const c of IndexCmd.commands().values()) if (c.builtin === true) names.add(c.name);
    const user = this.currentUser();
    for (const dir of (this.env.get("PATH") ?? "").split(":")) {
      const node = dir !== "" ? this.vfs.tryLookup(dir, user) : null;
      if (node?.type === "dir") {
        for (const [n, child] of node.children!) {
          const target = child.type === "link" ? this.vfs.tryLookup(`${dir}/${n}`, user) : child;
          if (target?.type === "file" && VfsLib.hasPerm(target, user, "x")) names.add(n);
        }
      }
    }
    for (const a of this.aliases.keys()) names.add(a);
    for (const f of this.functions.keys()) names.add(f);
    return [...names].sort();
  }

  complete(line: string): { line: string; options: string[] } {
    const m = completeWordRe.exec(line);
    const word = m?.[2] ?? "";
    const before = line.slice(0, line.length - word.length);
    const isCommand = completeCmdPosRe.test(before.trimEnd()) || before.trim() === "" || completeSudoRe.test(before);

    let candidates: string[];
    let prefix = word;
    let dirPart = "";
    if (isCommand && !word.includes("/")) {
      candidates = this.availableCommands().filter((c) => c.startsWith(word));
    } else {
      const slash = word.lastIndexOf("/");
      dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
      prefix = word.slice(slash + 1);
      let dirPath = dirPart !== "" ? dirPart : ".";
      if (dirPath === "~/" || dirPath.startsWith("~/")) dirPath = this.home + dirPath.slice(1);
      const node = this.vfs.tryLookup(this.resolve(dirPath), this.currentUser());
      if (node === null || node.type !== "dir") return { line, options: [] };
      candidates = [...node.children!]
        .filter(([key]) => key.startsWith(prefix) && (prefix.startsWith(".") || !key.startsWith(".")))
        .map(([key, value]) =>
          value.type === "dir" ||
          (value.type === "link" && this.vfs.tryLookup(this.resolve(`${dirPath.replace(/\/+$/, "")}/${key}`), this.currentUser())?.type === "dir")
            ? `${key}/`
            : key,
        )
        .sort();
    }
    if (candidates.length === 0) return { line, options: [] };
    if (candidates.length === 1) {
      const c = candidates[0]!;
      return { line: before + dirPart + c + (c.endsWith("/") ? "" : " "), options: [] };
    }
    let common = candidates[0]!;
    for (const c of candidates) {
      while (!c.startsWith(common)) common = common.slice(0, -1);
    }
    return { line: before + dirPart + common, options: common.length > prefix.length ? [] : candidates };
  }
}
