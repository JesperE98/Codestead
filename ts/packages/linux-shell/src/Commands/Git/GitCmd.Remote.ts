// Port of Commands/Git/GitCmd.Remote.cs – clone / remote / fetch / pull / push: remote addresses, opening a local
// repository as a remote, fetching, and git remote.

import * as VfsLib from "../../Vfs/VfsLib.js";
import { parseArgs } from "./GitCmd.Args.js";
import { configAll, getConfig, setConfig, setConfigText } from "./GitCmd.Config.js";
import { existsAt, gpath, join, looksLikeGitDir, needRepo, openRepo, readText, writeText, type Repo } from "./GitCmd.Files.js";
import { union } from "./GitCmd.Json.js";
import { allObjects, objPath } from "./GitCmd.Objects.js";
import { deleteRef, listRefs, readHead, readRef, writeRef } from "./GitCmd.Refs.js";
import { isAncestor } from "./GitCmd.Revisions.js";
import { fail, short, type G } from "./GitCmd.js";

const schemeRe = /^[a-z+]+:\/\//i;
const scpRe = /^[^/\s]+@[^/\s]+:/;
const urlHostRe = /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:]+)/i;
const scpHostRe = /@([^:]+):/;
const tildeRe = /^~(?=\/|$)/;
const fileSchemeRe = /^file:\/\//;

export function isNetworkUrl(url: string): boolean {
  return (schemeRe.test(url) && !url.startsWith("file://")) || scpRe.test(url);
}

export function networkError(g: G, url: string, action: string): number {
  const m1 = urlHostRe.exec(url);
  const m2 = scpHostRe.exec(url);
  const host = m1 ? m1[1]! : m2 ? m2[1]! : url;
  if (scpRe.test(url) || url.startsWith("ssh://")) {
    g.err(`ssh: Could not resolve hostname ${host}: Name or service not known\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n`);
  } else g.err(`fatal: unable to access '${url.endsWith("/") ? url : url + "/"}': Could not resolve host: ${host}\n`);
  g.note("git.noNetwork", { action, host });
  return 128;
}

export function expandTilde(g: G, path: string): string {
  // A function as the replacement: the home directory is inserted as it is ($ has no special meaning).
  return path.replace(tildeRe, () => g.sh.home);
}

/** Opens a local repository as a "remote". */
export function openRemote(g: G, url: string): Repo | null {
  const path = VfsLib.resolvePath(g.cwd, expandTilde(g, url.replace(fileSchemeRe, "")));
  if (looksLikeGitDir(g, join(path, ".git"))) return openRepo(g, join(path, ".git"), path);
  if (looksLikeGitDir(g, path)) return openRepo(g, path, null);
  if (!path.endsWith(".git") && looksLikeGitDir(g, path + ".git")) return openRepo(g, path + ".git", null);
  return null;
}

/** Copies every object from one repository to another. */
export function copyObjects(from: Repo, to: Repo): void {
  for (const h of allObjects(from)) {
    const p = objPath(to, h);
    if (existsAt(to.g, p)) continue;
    const raw = readText(from.g, objPath(from, h));
    if (raw !== null) writeText(to.g, p, raw);
  }
}

export function remoteUrl(r: Repo, name: string): string | null {
  return getConfig(r.g, r, `remote.${name}.url`);
}

export const NotARepoTail = "fatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n";

/** Fetches branches from a remote into refs/remotes/<name>/. */
export function fetchRemote(r: Repo, name: string, quiet = false): number {
  const g = r.g;
  const url = remoteUrl(r, name) ?? (openRemote(g, name) !== null ? name : null);
  if (!url) {
    g.err(`fatal: '${name}' does not appear to be a git repository\n${NotARepoTail}`);
    return 128;
  }
  if (isNetworkUrl(url)) return networkError(g, url, "fetch");
  const src = openRemote(g, url);
  if (src === null) {
    g.err(`fatal: '${url}' does not appear to be a git repository\n${NotARepoTail}`);
    return 128;
  }
  copyObjects(src, r);
  const lines: string[] = [];
  const named = remoteUrl(r, name) !== null;
  const srcHead = readHead(src);
  for (const b of listRefs(src, "refs/heads/")) {
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
      if (b !== "HEAD" && !readRef(src, `refs/heads/${b}`)) deleteRef(r, `refs/remotes/${name}/${b}`);
    }
    if (srcHead.branch) writeText(g, gpath(r, `refs/remotes/${name}/HEAD`), `ref: refs/remotes/${name}/${srcHead.branch}\n`);
  }
  const fetchHead = srcHead.hash ? `${srcHead.hash}\t\t${srcHead.branch ? `branch '${srcHead.branch}' of ` : ""}${url}\n` : "";
  writeText(g, gpath(r, "FETCH_HEAD"), fetchHead);
  if (lines.length > 0 && !quiet) g.err(`From ${url}\n${lines.join("\n")}\n`);
  return 0;
}

export const remoteUrlKeyRe = /^remote\.[^\n]*\.url$/;

export function remoteNameOfKey(key: string): string {
  return key.slice(7, -4);
}

export function cmdRemote(g: G, args: string[]): number {
  const sub = args.length > 0 && args[0] !== "" && !args[0]!.startsWith("-") ? args[0]! : null;
  const o = parseArgs(sub !== null ? args.slice(1) : args, ["v|verbose"], "remote");
  const r = needRepo(g);
  const names = union(
    configAll(g, r)
      .filter((e) => e.scope === "local" && remoteUrlKeyRe.test(e.key))
      .map((e) => remoteNameOfKey(e.key)),
  );
  const cfg = gpath(r, "config");
  if (sub === null) {
    for (const n of names) {
      if (o.has("verbose")) g.out(`${n}\t${remoteUrl(r, n) ?? ""} (fetch)\n${n}\t${remoteUrl(r, n) ?? ""} (push)\n`);
      else g.out(n + "\n");
    }
    return 0;
  }
  const a = o.operands.length > 0 ? o.operands[0]! : null;
  const b = o.operands.length > 1 ? o.operands[1]! : null;
  switch (sub) {
    case "add":
      if (!a || !b) throw fail("usage: git remote add [<options>] <name> <url>", 129);
      if (names.includes(a)) throw fail(`error: remote ${a} already exists.`, 3);
      setConfig(g, cfg, `remote.${a}.url`, b);
      setConfig(g, cfg, `remote.${a}.fetch`, `+refs/heads/*:refs/remotes/${a}/*`);
      return 0;
    case "remove":
    case "rm": {
      if (!a || !names.includes(a)) throw fail(`error: No such remote: '${a ?? ""}'`, 2);
      let text = readText(g, cfg) ?? "";
      text = setConfigText(text, { section: "remote", sub: a, name: "url" }, null);
      text = setConfigText(text, { section: "remote", sub: a, name: "fetch" }, null);
      // The name goes into the pattern unescaped, like in the TypeScript.
      let re: RegExp | null = null;
      try {
        re = new RegExp(`\\[remote "${a}"\\]\\n(?=\\[|$)`);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
      writeText(g, cfg, re !== null ? text.replace(re, "") : text);
      for (const rf of listRefs(r, `refs/remotes/${a}/`)) deleteRef(r, `refs/remotes/${a}/${rf}`);
      return 0;
    }
    case "get-url":
      if (!a || !names.includes(a)) throw fail(`error: No such remote '${a ?? ""}'`, 2);
      g.out(remoteUrl(r, a) + "\n");
      return 0;
    case "set-url":
      if (!a || !b) throw fail("usage: git remote set-url [--push] <name> <newurl> [<oldurl>]", 129);
      if (!names.includes(a)) throw fail(`error: No such remote '${a}'`, 2);
      setConfig(g, cfg, `remote.${a}.url`, b);
      return 0;
    case "show":
      for (const n of a ? [a] : names) g.out(`* remote ${n}\n  Fetch URL: ${remoteUrl(r, n) ?? ""}\n  Push  URL: ${remoteUrl(r, n) ?? ""}\n`);
      return 0;
    default:
      throw fail(`error: unknown subcommand: \`${sub}'`, 129);
  }
}
