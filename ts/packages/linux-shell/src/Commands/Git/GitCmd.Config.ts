// Port of Commands/Git/GitCmd.Config.cs – configuration files (.git/config, ~/.gitconfig), the identity and time
// used for commits, and git config.

import { Js, netTrim } from "../../Js.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { parseArgs } from "./GitCmd.Args.js";
import { discover, gpath, readText, writeText, type Repo } from "./GitCmd.Files.js";
import type { Ident } from "./GitCmd.Objects.js";
import { fail, fatal, raise, type G } from "./GitCmd.js";

export interface ConfigEntry {
  key: string;
  value: string;
  scope: string;
  path: string;
}

// .NET's . is [^\n] (JavaScript's also excludes \r, \u2028 and \u2029).
const sectionRe = /^\[\s*([A-Za-z0-9.-]+)(?:\s+"((?:[^"\\]|\\[^\n])*)")?\s*\]/;
const kvRe = /^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*([^\n]*))?$/;
const kvNameRe = /^([A-Za-z][A-Za-z0-9-]*)\s*(=|$)/;
const unescapeRe = /\\([^\n])/g;

export function parseConfig(text: string): ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  let section = "";
  for (const raw of text.split("\n")) {
    const line = netTrim(raw);
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const head = sectionRe.exec(line);
    if (head) {
      section = head[1]!.toLowerCase() + (head[2] !== undefined ? "." + head[2].replace(unescapeRe, "$1") : "");
      continue;
    }
    const kv = kvRe.exec(line);
    if (!kv || section === "") continue;
    entries.push({ key: `${section}.${kv[1]!.toLowerCase()}`, value: kv[2] === undefined ? "true" : unquote(kv[2]), scope: "", path: "" });
  }
  return entries;
}

function unquote(v: string): string {
  let sb = "";
  let q = false;
  for (let i = 0; i < v.length; i++) {
    const ch = v[i]!;
    if (ch === '"') q = !q;
    else if (ch === "\\" && i + 1 < v.length) {
      const n = v[++i]!;
      sb += n === "n" ? "\n" : n === "t" ? "\t" : n;
    } else if (!q && (ch === "#" || ch === ";")) break;
    else sb += ch;
  }
  return q ? sb : netTrim(sb);
}

const needsQuoteRe = /^\s|\s$|[#;"\\\n\t]/;

function quoteValue(v: string): string {
  const esc = v.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\t", "\\t");
  return needsQuoteRe.test(v) ? `"${esc}"` : esc;
}

export interface KeyParts {
  section: string;
  sub: string | null;
  name: string;
}

const keyNameRe = /^[A-Za-z][A-Za-z0-9-]*$/;

export function splitKey(key: string): KeyParts | null {
  const first = key.indexOf(".");
  const last = key.lastIndexOf(".");
  if (first < 0) return null;
  const name = key.slice(last + 1);
  if (!keyNameRe.test(name)) return null;
  return { section: key.slice(0, first).toLowerCase(), sub: first === last ? null : key.slice(first + 1, last), name };
}

export function normKey(k: KeyParts): string {
  return `${k.section}${k.sub !== null ? "." + k.sub : ""}.${k.name.toLowerCase()}`;
}

const subQuoteRe = /(["\\])/g;

/** Sets (or removes, with value null) a key in the configuration text. */
export function setConfigText(text: string, key: KeyParts, value: string | null): string {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  let inSection = false;
  let sectionEnd = -1;
  let keyLine = -1;
  const toRemove: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = netTrim(lines[i]!);
    const head = sectionRe.exec(line);
    if (head) {
      const sub = head[2] !== undefined ? head[2].replace(unescapeRe, "$1") : null;
      inSection = head[1]!.toLowerCase() === key.section && sub === key.sub;
      if (inSection) sectionEnd = i + 1;
      continue;
    }
    if (!inSection) continue;
    sectionEnd = i + 1;
    const kv = kvNameRe.exec(line);
    if (kv && kv[1]!.toLowerCase() === key.name.toLowerCase()) {
      keyLine = i;
      toRemove.push(i);
    }
  }
  if (value === null) {
    return lines
      .filter((_, i) => !toRemove.includes(i))
      .map((l) => l + "\n")
      .join("");
  }
  const formatted = `\t${key.name} = ${quoteValue(value)}`;
  if (keyLine >= 0) lines[keyLine] = formatted;
  else if (sectionEnd >= 0) lines.splice(sectionEnd, 0, formatted);
  else {
    lines.push(key.sub !== null ? `[${key.section} "${key.sub.replace(subQuoteRe, "\\$1")}"]` : `[${key.section}]`);
    lines.push(formatted);
  }
  return lines.map((l) => l + "\n").join("");
}

export function globalConfigPath(g: G): string {
  return `${g.sh.home}/.gitconfig`;
}

/** All configuration files that apply, in order (later wins). */
function configFiles(g: G, r: Repo | null): { scope: string; path: string }[] {
  const files = [
    { scope: "system", path: "/etc/gitconfig" },
    { scope: "global", path: globalConfigPath(g) },
  ];
  if (r !== null) files.push({ scope: "local", path: gpath(r, "config") });
  return files;
}

export function configAll(g: G, r: Repo | null): ConfigEntry[] {
  return configFiles(g, r).flatMap((f) =>
    parseConfig(readText(g, f.path) ?? "").map((e) => {
      e.scope = f.scope;
      e.path = f.path;
      return e;
    }),
  );
}

export function getConfig(g: G, r: Repo | null, key: string): string | null {
  const k = splitKey(key);
  if (k === null) return null;
  const nk = normKey(k);
  return configAll(g, r).filter((e) => e.key === nk).at(-1)?.value ?? null;
}

const trueRe = /^(true|yes|on|1)$/i;

export function configBool(v: string | null, def: boolean): boolean {
  return v === null ? def : trueRe.test(v);
}

export function setConfig(g: G, path: string, key: string, value: string | null): void {
  const k = splitKey(key) ?? raise(fail(`error: key does not contain a section: ${key}`, 2));
  const text = readText(g, path) ?? "";
  writeText(g, path, setConfigText(text, k, value));
}

/** The time for commits: whole seconds since the Unix epoch. */
export function now(): number {
  return Math.floor(Js.now() / 1000);
}

/** The local time zone's offset at this moment, e.g. "+0100". */
export function tzNow(): string {
  const off = Math.round(-new Date(Js.now()).getTimezoneOffset());
  const a = Math.abs(off);
  return `${off < 0 ? "-" : "+"}${String(Math.trunc(a / 60)).padStart(2, "0")}${String(a % 60).padStart(2, "0")}`;
}

export function fmtDate(i: Ident): string {
  const sign = (i.tz[0] ?? "") === "-" ? -1 : 1;
  const off = sign * (Js.number(i.tz.slice(1, 3)) * 60 + Js.number(i.tz.slice(3, 5)));
  // The time in the commit's own time zone, read with the UTC getters.
  const d = new Date(Math.trunc((i.time + off * 60) * 1000));
  const t = `${Js.pad2(d.getUTCHours())}:${Js.pad2(d.getUTCMinutes())}:${Js.pad2(d.getUTCSeconds())}`;
  return `${UtilCmd.Days[d.getUTCDay()]} ${UtilCmd.Months[d.getUTCMonth()]} ${d.getUTCDate()} ${t} ${d.getUTCFullYear()} ${i.tz}`;
}

/** The name from /etc/passwd (GECOS), which real git uses if user.name is missing. */
function gecosName(g: G): string {
  const passwd = g.sh.vfs.tryLookup("/etc/passwd", g.sh.rootUser())?.content ?? "";
  const line = passwd.split("\n").find((l) => l.startsWith(g.user.name + ":"));
  const fields = line?.split(":");
  const gecos = fields !== undefined && fields.length > 4 ? fields[4]!.split(",")[0]! : null;
  return gecos !== null && gecos !== "" ? gecos : g.user.name;
}

export function identity(g: G, r: Repo | null, strict = true): Ident | null {
  const email = getConfig(g, r, "user.email") ?? g.sh.env.get("EMAIL") ?? null;
  const cfgName = getConfig(g, r, "user.name");
  const name = cfgName !== null && cfgName !== "" ? cfgName : gecosName(g);
  if (email === null || email === "") {
    if (!strict) return null;
    throw fail(
      `Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account's default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got '${g.user.name}@${g.sh.distro.hostname}.(none)')`,
      128,
    );
  }
  return { name, email, time: now(), tz: tzNow() };
}

// config

export function cmdConfig(g: G, args: string[]): number {
  // The new syntax (git 2.46+): git config list|get|set|unset ...
  let action: string | null = null;
  if (args.length > 0 && (args[0] === "list" || args[0] === "get" || args[0] === "set" || args[0] === "unset")) {
    action = args[0];
    args = args.slice(1);
  }
  const o = parseArgs(args, ["global", "local", "system", "l|list", "get", "get-all", "unset", "unset-all", "show-origin", "e|edit", "add", "all"], "config");
  const scope = o.has("global") ? "global" : o.has("system") ? "system" : o.has("local") ? "local" : null;
  if (o.has("edit")) {
    g.note("git.configEditUnsupported");
    return 1;
  }
  if (o.has("list")) action = "list";
  else if (o.has("get") || o.has("get-all")) action = "get";
  else if (o.has("unset") || o.has("unset-all")) action = "unset";
  action ??= o.operands.length >= 2 ? "set" : o.operands.length === 1 ? "get" : null;
  if (action === null)
    throw fail(
      "usage: git config [<options>]\n\n    git config list [<file-option>] [<display-option>] [--includes]\n    git config get [<file-option>] [<display-option>] [--includes] [--all] <name>\n    git config set [<file-option>] [--type=<type>] [--all] [--value=<value>] [--fixed-value] <name> <value>\n    git config unset [<file-option>] [--all] [--value=<value>] [--fixed-value] <name>",
      129,
    );
  const r = discover(g, g.cwd);
  const pathFor = (s: string): string =>
    s === "global" ? globalConfigPath(g) : s === "system" ? "/etc/gitconfig" : r !== null ? gpath(r, "config") : raise(fatal("not in a git directory"));
  if (action === "list") {
    let entries: ConfigEntry[];
    if (scope !== null) {
      const path = pathFor(scope);
      entries = parseConfig(readText(g, path) ?? "").map((e) => {
        e.path = path;
        return e;
      });
    } else entries = configAll(g, r);
    if (scope !== null && readText(g, pathFor(scope)) === null) throw fatal(`unable to read config file '${pathFor(scope)}': No such file or directory`);
    for (const e of entries) g.out(`${o.has("show-origin") ? `file:${e.path}\t` : ""}${e.key}=${e.value}\n`);
    return 0;
  }
  const key = o.operands.length > 0 ? o.operands[0]! : null;
  const parts = splitKey(key ?? "");
  if (parts === null) {
    if (key !== null && key !== "" && !key.includes(".")) throw fail(`error: key does not contain a section: ${key}`, 2);
    throw fail(`error: invalid key: ${key ?? ""}`, 1);
  }
  if (action === "get") {
    const nk = normKey(parts);
    const entries = (scope !== null ? parseConfig(readText(g, pathFor(scope)) ?? "") : configAll(g, r)).filter((e) => e.key === nk);
    if (entries.length === 0) return 1;
    for (const e of o.has("get-all") || o.has("all") ? entries : entries.slice(-1)) g.out(e.value + "\n");
    return 0;
  }
  const cfgPath = pathFor(scope ?? "local");
  if (action === "unset") {
    const text = readText(g, cfgPath) ?? "";
    if (!parseConfig(text).some((e) => e.key === normKey(parts))) return 5;
    writeText(g, cfgPath, setConfigText(text, parts, null));
    return 0;
  }
  const value = o.operands.length > 1 ? o.operands[1]! : null;
  if (value === null) throw fail("error: wrong number of arguments, should be 2", 129);
  setConfig(g, cfgPath, key!, value);
  return 0;
}
