// Port of Shellmode/ShellmodeLib.cs (src/shell/shellmode.ts) – shells other than bash: zsh and fish. The shell
// keeps a stack of started shells (`zsh` starts zsh, `exit` goes back). Here are the prompts, what happens when a
// shell starts (greeting, ~/.zshrc, config.fish) and fish universal variables.

import { Js } from "../Js.js";
import type { Proc } from "../Procs/Proc.js";
import type { Shell } from "../Shell/Shell.js";
import { IO } from "../Types/IO.js";
import type { Sink } from "../Types/Sink.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { ShellMode } from "./ShellFrame.js";

export const shellPaths = new Map<ShellMode, string>([
  ["bash", "/bin/bash"],
  ["zsh", "/usr/bin/zsh"],
  ["fish", "/usr/bin/fish"],
]);

export const ZshVersion = "5.9";

export function fishVersion(sh: Shell): string {
  switch (sh.distro.family) {
    case "debian":
      return "3.7.0";
    case "arch":
      return "4.1.2";
    case "redhat":
      return "4.0.2";
    default:
      throw new RangeError(`sh: ${sh.distro.family}`);
  }
}

/** Which shell a path like /usr/bin/zsh or "fish" means (null if unknown). */
export function modeOf(path: string): ShellMode | null {
  const name = VfsLib.basename(path.trim());
  if (name === "zsh" || name === "fish" || name === "bash") return name;
  if (name === "sh") return "bash";
  return null;
}

const shebangRe = /^#!\s*(\S+)(?:[ \t]+(\S+))?/;

/** The shell a script should run with, according to the #! line at the top (null if none or unknown). */
export function shebang(content: string): { mode: ShellMode; interpreter: string } | null {
  const m = shebangRe.exec(content);
  if (!m) return null;
  const prog = VfsLib.basename(m[1]!) === "env" && m[2] !== undefined && m[2] !== "" ? m[2] : m[1]!;
  const mode = modeOf(prog);
  return mode !== null ? { mode, interpreter: m[1]! } : null;
}

export function shellProc(pid: number, ppid: number, user: string, mode: ShellMode): Proc {
  return {
    pid,
    ppid,
    user,
    cmd: mode,
    cpu: 0,
    mem: 0.1,
    vsz: mode === "fish" ? 245_000 : 12_500,
    rss: mode === "fish" ? 9_800 : 5_600,
    tty: "pts/0",
    stat: "S",
    start: Js.hhmm(Js.localNow()),
    time: "0:00",
  };
}

// ---------- Prompts ----------

const colors = new Map<string, number>([
  ["black", 30],
  ["red", 31],
  ["green", 32],
  ["yellow", 33],
  ["blue", 34],
  ["magenta", 35],
  ["cyan", 36],
  ["white", 37],
]);

const zshPromptRe = /%([0-9]*)([~nmMd/c#%BbFfT*])(\{[^}]*\})?/g;
const singleDigitRe = /^[0-9]$/;

/** Interprets the zsh prompt's %-codes: %n, %m, %~, %1~, %#, %F{colour} … */
export function zshPrompt(sh: Shell, format: string): string {
  const u = sh.currentUser();
  const tilde = (p: string): string => (p === u.home ? "~" : p.startsWith(u.home + "/") ? "~" + p.slice(u.home.length) : p);
  return format.replace(zshPromptRe, (_m, num: string, code: string, arg: string | undefined) => {
    switch (code) {
      case "n":
        return u.name;
      case "m":
        return sh.distro.hostname.split(".")[0]!;
      case "M":
        return sh.distro.hostname;
      case "~":
      case "d":
      case "/":
      case "c": {
        const full = code === "~" || code === "c" ? tilde(sh.cwd) : sh.cwd;
        const n = code === "c" ? 1 : Js.number(num !== "" ? num : "0");
        if (n === 0 || Number.isNaN(n) || full === "/" || full === "~") return full;
        const parts = full.split("/").filter((p) => p !== "");
        return parts.slice(-Math.trunc(Math.min(n, parts.length))).join("/");
      }
      case "#":
        return u.uid === 0 ? "#" : "%";
      case "%":
        return "%";
      case "B":
        return "\x1b[1m";
      case "b":
        return "\x1b[22m";
      case "F": {
        const name = arg !== undefined ? arg.slice(1, -1) : "";
        const c = colors.get(name) ?? (singleDigitRe.test(name) ? 30 + (name.charCodeAt(0) - 48) : null);
        return c !== null && c !== 0 ? `\x1b[${c}m` : "";
      }
      case "f":
        return "\x1b[39m";
      case "T":
        return Js.hhmm(Js.localNow());
      case "*":
        return Js.hhmmss(Js.localNow());
    }
    return "";
  });
}

/** fish shortens the path: /home/elev/dokument/projekt -> ~/d/projekt */
export function fishPwd(sh: Shell): string {
  const home = sh.currentUser().home;
  const p = sh.cwd === home ? "~" : sh.cwd.startsWith(home + "/") ? "~" + sh.cwd.slice(home.length) : sh.cwd;
  const parts = p.split("/");
  return parts.map((s, i) => (i === parts.length - 1 || s === "" || s === "~" ? s : s.startsWith(".") ? s.slice(0, 2) : s[0]!)).join("/");
}

export function shellPrompt(sh: Shell, mode: ShellMode): string {
  const u = sh.currentUser();
  if (mode === "zsh") return zshPrompt(sh, sh.env.get("PROMPT") ?? sh.env.get("PS1") ?? "%m%# ");
  const root = u.uid === 0;
  return `\x1b[32m${u.name}\x1b[0m@${sh.distro.hostname} \x1b[${root ? 31 : 32}m${fishPwd(sh)}\x1b[0m${root ? "#" : ">"} `;
}

// ---------- Startup ----------

const Newuser = "This is the Z Shell configuration function for new users,\nzsh-newuser-install.\nYou are seeing this message because you have no zsh startup files\n(the files .zshenv, .zprofile, .zshrc, .zlogin in the directory\n~).  This function can help you with a few settings that should\nmake your use of the shell easier.\n\nYou can:\n\n(q)  Quit and do nothing.  The function will be run again next time.\n\n(0)  Exit, creating the file ~/.zshrc containing just a comment.\n     That will prevent this function being run again.\n\n(1)  Continue to the main menu.\n\n(2)  Populate your ~/.zshrc with the configuration recommended\n     by the system administrator and exit (you will need to edit\n     the file by hand, if so desired)." + "\n\n";

export const ZshrcRecommended = "# ~/.zshrc – körs av zsh för interaktiva skal.\n# Skapad av zsh-newuser-install med de rekommenderade inställningarna.\n\n# Prompten: användare@dator katalog %\nPROMPT='%n@%m %1~ %# '\n\nHISTSIZE=1000\nSAVEHIST=1000\nHISTFILE=~/.zsh_history\n\n# Skriv bara ett katalognamn för att gå dit (utan cd).\nsetopt autocd\nsetopt histignorealldups sharehistory" + "\n";

export const ConfigFish = "if status is-interactive\n    # Commands to run in interactive sessions can go here\nend" + "\n";

const Dim = "\x1b[2m";
const Reset = "\x1b[0m";

function writeHomeFile(sh: Shell, rel: string, content: string): void {
  const user = sh.currentUser();
  const path = `${user.home}/${rel}`;
  const parts = rel.split("/").slice(0, -1);
  let dir = user.home;
  for (const p of parts) {
    dir += "/" + p;
    if (sh.vfs.tryLookup(dir, user) === null) sh.vfs.mkdir(dir, user);
  }
  sh.vfs.writeFile(path, content, user);
}

function sourceFile(sh: Shell, rel: string, mode: ShellMode, io: Sink): void {
  const user = sh.currentUser();
  const node = sh.vfs.tryLookup(`${user.home}/${rel}`, user);
  if (node?.type !== "file") return;
  sh.runScript(node.content ?? "", `${user.home}/${rel}`, [], new IO(io.outFn, io.errFn, null, false), true, mode);
}

/** Runs when a new interactive zsh or fish shell starts. */
export function shellStartup(sh: Shell, mode: ShellMode, io: Sink): void {
  const user = sh.currentUser();
  if (mode === "zsh") {
    const hasRc = [".zshrc", ".zshenv", ".zprofile", ".zlogin"].some((f) => sh.vfs.tryLookup(`${user.home}/${f}`, user) !== null);
    if (hasRc) {
      sourceFile(sh, ".zshrc", "zsh", io);
      return;
    }
    io.out(Newuser);
    sh.askText("--- Type one of the keys in parentheses --- ", (text, out) => {
      const key = text.trim();
      if (key === "0") {
        writeHomeFile(sh, ".zshrc", "# Created by newuser for 5.9\n");
      } else if (key === "1" || key === "2") {
        if (key === "1") {
          out.out(`${Dim}${sh.msg("shellmode.zshMainMenu")}${Reset}\n`);
        }
        writeHomeFile(sh, ".zshrc", ZshrcRecommended);
        sourceFile(sh, ".zshrc", "zsh", out);
      }
      return 0;
    });
    return;
  }
  if (mode === "fish") {
    if (sh.vfs.tryLookup(`${user.home}/.config/fish/config.fish`, user) === null) writeHomeFile(sh, ".config/fish/config.fish", ConfigFish);
    loadUniversalVars(sh);
    sourceFile(sh, ".config/fish/config.fish", "fish", io);
    const greeting = sh.env.get("fish_greeting") ?? "Welcome to fish, the friendly interactive shell\nType help for instructions on how to use fish";
    if (greeting !== "") io.out(greeting + "\n");
  }
}

// ---------- fish: universal variables (set -U) in ~/.config/fish/fish_variables ----------

const Uvars = ".config/fish/fish_variables";

// [^\n\r\u2028\u2029] in C#: what "." matches in JavaScript without the s flag.
const uvarLineRe = /^SETUVAR (--export )?([A-Za-z_][A-Za-z0-9_]*):(.*)$/;
const uvarHexRe = /\\x([0-9a-f]{2})/gi;
const uvarEncRe = /[^A-Za-z0-9_/.~-]/g;

function uvarPath(sh: Shell): string {
  return `${sh.currentUser().home}/${Uvars}`;
}

/** A universal variable: its value and whether it is exported (set -Ux, "SETUVAR --export" in the file). */
interface Uvar {
  value: string;
  exported: boolean;
}

function readUvars(sh: Shell): Map<string, Uvar> {
  const content = sh.vfs.tryLookup(uvarPath(sh), sh.currentUser())?.content ?? "";
  const vars = Js.obj<Uvar>();
  for (const line of content.split("\n")) {
    const m = uvarLineRe.exec(line);
    if (m) {
      const value = m[3]!.replaceAll("\\x1e", " ").replace(uvarHexRe, (_x, h: string) => String.fromCharCode(Number.parseInt(h, 16)));
      vars.set(m[2]!, { value, exported: m[1] !== undefined });
    }
  }
  return vars;
}

function loadUniversalVars(sh: Shell): void {
  for (const [k, v] of readUvars(sh)) {
    if (sh.env.has(k)) continue;
    sh.env.set(k, v.value);
    if (v.exported) sh.exported.add(k);
  }
}

/** Saves (or removes, with value null) a universal variable; exported is set -Ux. */
export function saveUniversalVar(sh: Shell, name: string, value: string | null, exported = false): void {
  const vars = readUvars(sh);
  if (value === null) vars.delete(name);
  else vars.set(name, { value, exported });
  const enc = (v: string): string =>
    v.replace(uvarEncRe, (m) => {
      const c = m.charCodeAt(0);
      return m === " " ? "\\x1e" : `\\x${c.toString(16).padStart(2, "0")}`;
    });
  // Object.entries(vars).sort() compares the entries as "key,value" strings.
  const lines = [...vars]
    .sort((a, b) => Js.ordinal(a[0] + "," + a[1].value, b[0] + "," + b[1].value))
    .map(([k, v]) => `SETUVAR ${v.exported ? "--export " : ""}${k}:${enc(v.value)}`);
  writeHomeFile(sh, Uvars, `# This file contains fish universal variable definitions.\n# VERSION: 3.0\n${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`);
}
