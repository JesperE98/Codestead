// Port of Commands/Git/GitCmd.Stash.cs – git stash (simplified: saves changes in tracked files).

import { Js } from "../../Js.js";
import { parseArgs } from "./GitCmd.Args.js";
import { merge3, printPatch, treeChanges } from "./GitCmd.Diff.js";
import { gpath, needRepo, needWork, readText, removeFile, writeText, type Repo } from "./GitCmd.Files.js";
import { readIndex, writeIndex } from "./GitCmd.Index.js";
import { JsMap, jsonStringify, treeFromJson, union } from "./GitCmd.Json.js";
import { commitTree, readBlob, readCommit, subject, writeObj } from "./GitCmd.Objects.js";
import { readHead } from "./GitCmd.Refs.js";
import { computeStatus, printLongStatus } from "./GitCmd.Status.js";
import { removeWorkFile, scanWork, show, switchTree, writeWorkFile } from "./GitCmd.WorkTree.js";
import { fail, fatal, short, type G } from "./GitCmd.js";

interface StashEntry {
  base: string;
  branch: string;
  index: JsMap<string>;
  work: JsMap<string>;
  message: string;
}

function readStash(r: Repo): StashEntry[] {
  const text = readText(r.g, gpath(r, "stash.json"));
  if (text === null || text === "") return [];
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return [];
  }
  if (!Array.isArray(root)) return [];
  return root.map((e: unknown): StashEntry => {
    const obj = e !== null && typeof e === "object" && !Array.isArray(e) ? (e as Record<string, unknown>) : null;
    const prop = (k: string): unknown => (obj !== null && Object.hasOwn(obj, k) ? obj[k] : undefined);
    const str = (k: string): string => {
      const v = prop(k);
      return typeof v === "string" ? v : "";
    };
    return { base: str("base"), branch: str("branch"), index: treeFromJson(prop("index")), work: treeFromJson(prop("work")), message: str("message") };
  });
}

function writeStash(r: Repo, list: StashEntry[]): void {
  if (list.length === 0) {
    removeFile(r.g, gpath(r, "stash.json"));
    return;
  }
  const json = list.map((e) => ({ base: e.base, branch: e.branch, index: e.index.toObject(), work: e.work.toObject(), message: e.message }));
  writeText(r.g, gpath(r, "stash.json"), jsonStringify(json) + "\n");
}

const stashRefRe = /^(?:stash@\{)?([0-9]+)\}?$/;

export function cmdStash(g: G, args: string[]): number {
  const hasSub = args.length > 0 && args[0] !== "" && !args[0]!.startsWith("-");
  const sub = hasSub ? args[0]! : "push";
  const o = parseArgs(hasSub ? args.slice(1) : args, ["m|message=", "u|include-untracked", "q|quiet"], "stash");
  const r = needRepo(g);
  needWork(r);
  const head = readHead(r);
  const list = readStash(r);
  const where = head.branch ?? "(no branch)";
  const pickIndex = (): number => {
    const ref = o.operands.length > 0 ? o.operands[0]! : "stash@{0}";
    const m = stashRefRe.exec(ref);
    const n = m ? Js.number(m[1]) : -1;
    if (!(n >= 0 && n < list.length)) throw fail(`error: ${ref} is not a valid reference`);
    return n;
  };
  switch (sub) {
    case "push":
    case "save": {
      if (!head.hash) throw fatal("You do not have the initial commit yet");
      const s = computeStatus(r);
      if (s.staged.length === 0 && s.unstaged.length === 0) {
        g.out("No local changes to save\n");
        return 0;
      }
      const work = new JsMap<string>();
      for (const p of s.index.entries.keys) {
        const w = s.work.get(p);
        if (w !== null) work.set(p, writeObj(r, "blob", w.content));
      }
      const c = readCommit(r, head.hash);
      const message = o.get("message") ? `On ${where}: ${o.get("message")}` : `WIP on ${where}: ${short(c.hash)} ${subject(c)}`;
      list.unshift({ base: head.hash, branch: where, index: s.index.entries.copy(), work, message });
      writeStash(r, list);
      switchTree(r, commitTree(r, head.hash), commitTree(r, head.hash), "checkout", true);
      g.out(`Saved working directory and index state ${message}\n`);
      return 0;
    }
    case "list":
      for (let i = 0; i < list.length; i++) g.out(`stash@{${i}}: ${list[i]!.message}\n`);
      return 0;
    case "show": {
      const e = list[pickIndex()]!;
      printPatch(r, treeChanges(commitTree(r, e.base), e.work), "stat");
      return 0;
    }
    case "drop": {
      const n = pickIndex();
      g.out(`Dropped stash@{${n}} (${list[n]!.message})\n`);
      list.splice(n, 1);
      writeStash(r, list);
      return 0;
    }
    case "clear":
      writeStash(r, []);
      return 0;
    case "pop":
    case "apply": {
      if (list.length === 0) throw fail("No stash entries found.");
      const n = pickIndex();
      const e = list[n]!;
      const work = scanWork(r);
      const idx = readIndex(r);
      const headTree = commitTree(r, head.hash);
      const baseTree = commitTree(r, e.base);
      const conflicts: string[] = [];
      for (const p of union(e.work.keys, baseTree.keys)) {
        if (e.work.get(p) === baseTree.get(p)) continue;
        const cur = work.get(p)?.hash ?? null;
        if (cur !== headTree.get(p) && cur !== e.work.get(p)) conflicts.push(p);
      }
      if (conflicts.length > 0) {
        throw fail(
          `error: Your local changes to the following files would be overwritten by merge:\n${conflicts.map((p) => `\t${show(r, p)}\n`).join("")}Please commit your changes or stash them before you merge.\nAborting`,
        );
      }
      for (const p of union(e.work.keys, baseTree.keys)) {
        const wp = e.work.get(p);
        const bp = baseTree.get(p);
        const hp = headTree.get(p);
        if (wp === bp) continue;
        if (wp === null) {
          removeWorkFile(r, p);
          continue;
        }
        const cur = hp !== bp && hp && bp ? merge3(readBlob(r, bp), readBlob(r, hp), readBlob(r, wp), "Updated upstream", "Stashed changes") : null;
        if (cur?.conflict === true) g.out(`CONFLICT (content): Merge conflict in ${p}\n`);
        writeWorkFile(r, p, cur !== null ? cur.text : readBlob(r, wp));
        const ip = e.index.get(p);
        if (!idx.entries.has(p) && ip) idx.entries.set(p, ip);
      }
      writeIndex(r, idx);
      printLongStatus(r, computeStatus(r));
      if (sub === "pop") {
        list.splice(n, 1);
        writeStash(r, list);
        g.out(`Dropped stash@{${n}} (${e.message})\n`);
      }
      return 0;
    }
    default:
      throw fail(`error: unknown subcommand: ${sub}`, 129);
  }
}
