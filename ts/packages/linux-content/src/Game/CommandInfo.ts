// Port of Game/CommandInfo.cs – what a command line contained, for the statistics and achievements.

import { CommandFacts, type GameStats } from "@codestead/learning";
import { IndexCmd, type Node, ParseError, ParserLib, type Redirect, type SimpleNode, UtilCmd } from "@codestead/linux-shell";

const wrappers = new Set(["sudo", "time", "nohup", "env", "xargs", "watch", "exec", "command", "builtin"]);
const outputRedirects = new Set([">", ">>", "&>", "2>", "2>>", "<"]);

/** char.IsLetterOrDigit and char.IsDigit for one UTF-16 code unit (a lone surrogate is neither, as in C#). */
const letterOrDigit = /^[\p{L}\p{Nd}]$/u;
const digit = /^\p{Nd}$/u;

/**
 * What a command line contained: command names, pipes, redirections, loops … (for statistics and achievements).
 *
 * {@link CommandFacts.names} are the commands the simulator knows, also those run through sudo, time,
 * xargs …; {@link CommandFacts.firstWords} the first word of each simple command, known or not (e.g. "sl", ":q").
 * (C#: the properties have private setters; here they are plain fields that only {@link analyze} sets.)
 */
export class CommandInfo extends CommandFacts {
  /** The longest pipeline (1 = no pipe). */
  maxPipeline = 1;
  hasRedirect = false;
  hasLoop = false;
  usesSudo = false;
  isScriptRun = false;
  /** The page read with man, or null. */
  manPage: string | null = null;
  /** The words of every simple command (after leading VAR=value). */
  readonly commands: string[][] = [];

  /** The terminal's own counters: man pages, pipes, redirections, loops, scripts and sudo. */
  override countInto(s: GameStats): void {
    const page = this.manPage;
    if (page !== null && !s.manPages.includes(page)) s.manPages.push(page);
    if (this.maxPipeline > 1) s.pipes++;
    s.longestPipe = Math.max(s.longestPipe, this.maxPipeline);
    if (this.hasRedirect) s.redirects++;
    if (this.hasLoop) s.loops++;
    if (this.isScriptRun) s.scripts++;
    if (this.usesSudo) s.sudo++;
  }

  /** Analyses a command line and its result. A line that does not parse gives what the text alone shows. */
  static analyze(line: string, output: string, exitCode: number): CommandInfo {
    const info = new CommandInfo({ line: line.trim(), output: UtilCmd.stripAnsi(output), exitCode });
    try {
      info.walk(ParserLib.parse(line));
    } catch (e) {
      // C#: catch (ParseError or ArgumentException or InvalidOperationException) – the parser's errors.
      if (!(e instanceof ParseError || e instanceof Error)) throw e;
      const first = info.line.split(" ").find((w) => w !== "");
      if (first !== undefined) info.firstWords.push(first);
    }
    return info;
  }

  private static isAssignment(w: string): boolean {
    if (w.length <= 1) return false;
    const eq = w.indexOf("=");
    if (eq <= 0) return false;
    for (let i = 0; i < eq; i++) if (!(letterOrDigit.test(w[i]!) || w[i] === "_")) return false;
    return !digit.test(w[0]!);
  }

  private walk(node: Node | null | undefined): void {
    if (node === null || node === undefined) return;
    switch (node.type) {
      case "simple":
        this.simple(node);
        return;
      case "pipeline":
        this.maxPipeline = Math.max(this.maxPipeline, node.commands.length);
        for (const c of node.commands) this.walk(c);
        return;
      case "andor":
        this.walk(node.first);
        for (const r of node.rest) this.walk(r.node);
        return;
      case "list":
        for (const i of node.items) this.walk(i.node);
        return;
      case "if":
        for (const c of node.clauses) {
          this.walk(c.cond);
          this.walk(c.body);
        }
        this.walk(node.elseBody);
        this.redirects(node.redirects);
        return;
      case "for":
        this.hasLoop = true;
        this.walk(node.body);
        this.redirects(node.redirects);
        return;
      case "cfor":
        this.hasLoop = true;
        this.walk(node.body);
        this.redirects(node.redirects);
        return;
      case "while":
        this.hasLoop = true;
        this.walk(node.cond);
        this.walk(node.body);
        this.redirects(node.redirects);
        return;
      case "case":
        for (const item of node.items) this.walk(item.body);
        this.redirects(node.redirects);
        return;
      case "group":
        this.walk(node.body);
        this.redirects(node.redirects);
        return;
      case "funcdef":
        this.walk(node.body);
        return;
    }
  }

  private redirects(redirects: readonly Redirect[]): void {
    if (redirects.some((r) => outputRedirects.has(r.op))) this.hasRedirect = true;
  }

  private simple(s: SimpleNode): void {
    this.redirects(s.redirects);
    const raw = s.words.map((w) => w.raw);
    let skip = 0;
    while (skip < raw.length && CommandInfo.isAssignment(raw[skip]!)) skip++;
    const words = raw.slice(skip);
    if (words.length === 0) return;
    this.commands.push(words);
    this.firstWords.push(words[0]!);
    const known = IndexCmd.commands();
    let i = 0;
    while (i < words.length) {
      const name = words[i]!;
      if (known.has(name) && !this.names.includes(name)) this.names.push(name);
      if (name === "sudo") this.usesSudo = true;
      if (name === "man" && i + 1 < words.length && !words[i + 1]!.startsWith("-")) this.manPage = words[words.length - 1]!;
      if (name.startsWith("./") || ((name === "bash" || name === "sh" || name === "zsh") && i + 1 < words.length && words[i + 1]!.endsWith(".sh")))
        this.isScriptRun = true;
      if (!wrappers.has(name)) break;
      // The command after sudo/time/env …: skip its options (and the value of sudo -u USER).
      i++;
      while (i < words.length && (words[i]!.startsWith("-") || CommandInfo.isAssignment(words[i]!))) {
        if (name === "sudo" && (words[i] === "-u" || words[i] === "-g")) i++;
        i++;
      }
    }
  }
}
