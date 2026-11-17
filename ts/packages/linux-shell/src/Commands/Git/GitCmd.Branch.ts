// Port of Commands/Git/GitCmd.Branch.cs – git branch.

import { netTrim } from "../../Js.js";
import { parseArgs } from "./GitCmd.Args.js";
import { setConfig, setConfigText } from "./GitCmd.Config.js";
import { gpath, needRepo, readText, writeText } from "./GitCmd.Files.js";
import { readCommit, subject } from "./GitCmd.Objects.js";
import { branchExists, checkBranchName, deleteRef, listRefs, readHead, readRef, setHeadBranch, writeRef } from "./GitCmd.Refs.js";
import { isAncestor, needCommit } from "./GitCmd.Revisions.js";
import { upstreamOf } from "./GitCmd.Status.js";
import { Col, fatal, raise, short, type G } from "./GitCmd.js";

/** Regex.Escape in .NET: \, *, +, ?, |, {, [, (, ), ^, $, ., # and white space are escaped. */
function netRegexEscape(s: string): string {
  return s.replace(/[\\*+?|{[()^$.#\t\n\f\r ]/g, (c) => (c === "\t" ? "\\t" : c === "\n" ? "\\n" : c === "\f" ? "\\f" : c === "\r" ? "\\r" : "\\" + c));
}

export function cmdBranch(g: G, args: string[]): number {
  const o = parseArgs(
    args,
    ["d|delete", "D", "m|move", "M", "l|list", "a|all", "r|remotes", "v|verbose", "show-current", "f|force", "u|set-upstream-to=", "unset-upstream", "c|copy"],
    "branch",
  );
  const r = needRepo(g);
  const head = readHead(r);
  if (o.has("show-current")) {
    if (head.branch) g.out(head.branch + "\n");
    return 0;
  }
  if (o.has("delete") || o.has("D")) {
    if (o.operands.length === 0) throw fatal("branch name required");
    const force = o.has("D") || o.has("force");
    let code = 0;
    for (const b of o.operands) {
      const ref = o.has("remotes") ? `refs/remotes/${b}` : `refs/heads/${b}`;
      const h = readRef(r, ref);
      if (!h) {
        g.err(`error: ${o.has("remotes") ? "remote-tracking " : ""}branch '${b}' not found\n`);
        code = 1;
        continue;
      }
      if (b === head.branch && !o.has("remotes")) {
        g.err(`error: cannot delete branch '${b}' used by worktree at '${r.root ?? r.gitDir}'\n`);
        code = 1;
        continue;
      }
      if (!force && !o.has("remotes")) {
        const up = upstreamOf(r, b);
        const upHash = up !== null ? readRef(r, up.ref) : null;
        const base = upHash ?? head.hash;
        if (!base || !isAncestor(r, h, base)) {
          g.err(`error: the branch '${b}' is not fully merged\n`);
          g.hint(`If you are sure you want to delete it, run 'git branch -D ${b}'\nDisable this message with "git config set advice.forceDeleteBranch false"`);
          code = 1;
          continue;
        }
      }
      deleteRef(r, ref);
      if (!o.has("remotes")) {
        const cfg = gpath(r, "config");
        let text = readText(g, cfg) ?? "";
        text = setConfigText(text, { section: "branch", sub: b, name: "remote" }, null);
        text = setConfigText(text, { section: "branch", sub: b, name: "merge" }, null);
        const re = new RegExp(`\\[branch "${netRegexEscape(b)}"\\]\\n(?=\\[|$)`);
        writeText(g, cfg, text.replace(re, ""));
      }
      g.out(`Deleted ${o.has("remotes") ? "remote-tracking branch" : "branch"} ${b} (was ${short(h)}).\n`);
    }
    return code;
  }
  if (o.has("move") || o.has("M")) {
    let a: string | null;
    let b: string | null;
    if (o.operands.length === 1) {
      a = head.branch ?? raise(fatal("cannot rename the current branch while not on any"));
      b = o.operands[0]!;
    } else {
      a = o.operands.length > 0 ? o.operands[0]! : null;
      b = o.operands.length > 1 ? o.operands[1]! : null;
    }
    if (!a || !b) throw fatal("branch name required");
    checkBranchName(g, b);
    const h = readRef(r, `refs/heads/${a}`);
    const isCurrent = a === head.branch;
    if (!h && !isCurrent) throw fatal(`no branch named '${a}'`);
    if (branchExists(r, b) && !o.has("M") && a !== b) throw fatal(`a branch named '${b}' already exists`);
    if (h) {
      deleteRef(r, `refs/heads/${a}`);
      writeRef(r, `refs/heads/${b}`, h);
    }
    if (isCurrent) setHeadBranch(r, b);
    return 0;
  }
  if (o.has("set-upstream-to")) {
    const up = o.get("set-upstream-to")!;
    const b = (o.operands.length > 0 ? o.operands[0]! : null) ?? head.branch ?? raise(fatal("could not set upstream of HEAD to " + up + " when it does not point to any branch."));
    const m = upstreamRe.exec(up);
    if (!m || !readRef(r, `refs/remotes/${up}`)) throw fatal(`the requested upstream branch '${up}' does not exist`);
    setConfig(g, gpath(r, "config"), `branch.${b}.remote`, m[1]!);
    setConfig(g, gpath(r, "config"), `branch.${b}.merge`, `refs/heads/${m[2]}`);
    g.out(`branch '${b}' set up to track '${up}'.\n`);
    return 0;
  }
  if (o.has("unset-upstream")) {
    const b = (o.operands.length > 0 ? o.operands[0]! : null) ?? head.branch!;
    const cfg = gpath(r, "config");
    let text = readText(g, cfg) ?? "";
    text = setConfigText(text, { section: "branch", sub: b, name: "remote" }, null);
    text = setConfigText(text, { section: "branch", sub: b, name: "merge" }, null);
    writeText(g, cfg, text);
    return 0;
  }
  if (o.operands.length > 0 && !o.has("list")) {
    const name = o.operands[0]!;
    const start = o.operands.length > 1 ? o.operands[1]! : null;
    checkBranchName(g, name);
    if (branchExists(r, name) && !o.has("force")) throw fatal(`a branch named '${name}' already exists`);
    if (name === head.branch && o.has("force")) throw fatal(`cannot force update the branch '${name}' used by worktree at '${r.root}'`);
    if (!start && !head.hash) throw fatal(`not a valid object name: '${head.branch ?? "HEAD"}'`);
    const h = start ? needCommit(r, start) : head.hash!;
    writeRef(r, `refs/heads/${name}`, h);
    if (start && readRef(r, `refs/remotes/${start}`) && upstreamRe.test(start)) {
      const segs = start.split("/");
      setConfig(g, gpath(r, "config"), `branch.${name}.remote`, segs[0]!);
      setConfig(g, gpath(r, "config"), `branch.${name}.merge`, `refs/heads/${segs.slice(1).join("/")}`);
      g.out(`branch '${name}' set up to track '${start}'.\n`);
    }
    return 0;
  }
  // List branches.
  const rows: { name: string; current: boolean; remote: boolean; hash: string }[] = [];
  if (!o.has("remotes")) {
    if (!head.branch && head.hash) rows.push({ name: `(HEAD detached at ${short(head.hash)})`, current: true, remote: false, hash: head.hash });
    for (const b of listRefs(r, "refs/heads/")) rows.push({ name: b, current: b === head.branch, remote: false, hash: readRef(r, `refs/heads/${b}`)! });
  }
  if (o.has("all") || o.has("remotes")) {
    for (const b of listRefs(r, "refs/remotes/")) {
      const raw = netTrim(readText(g, gpath(r, `refs/remotes/${b}`)) ?? "");
      const name = (o.has("all") ? "remotes/" : "") + b + (raw.startsWith("ref: refs/remotes/") ? ` -> ${raw.slice("ref: refs/remotes/".length)}` : "");
      rows.push({ name, current: false, remote: true, hash: readRef(r, `refs/remotes/${b}`) ?? "" });
    }
  }
  const nameW = Math.max(0, ...rows.map((x) => x.name.length));
  for (const row of rows) {
    const color = row.current ? Col.green : row.remote ? Col.red : "";
    let line = `${row.current ? "* " : "  "}${color !== "" ? g.c(color, row.name) : row.name}`;
    if (o.has("verbose") && row.hash) {
      line += " ".repeat(Math.max(0, nameW - row.name.length)) + ` ${g.c(Col.yellow, short(row.hash))} `;
      if (!row.remote && !row.name.startsWith("(")) {
        const up = upstreamOf(r, row.name);
        if (up !== null && o.getAll("verbose")!.length > 1) line += `[${g.c(Col.blue, up.name)}] `;
      }
      line += subject(readCommit(r, row.hash));
    }
    g.out(line + "\n");
  }
  return 0;
}

const upstreamRe = /^([^/]+)\/([^\n]+)$/;
