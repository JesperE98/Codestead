// Port of Commands/Git/GitCmd.Mv.cs – git mv.

import * as VfsLib from "../../Vfs/VfsLib.js";
import { parseArgs } from "./GitCmd.Args.js";
import { existsAt, isDirAt, join, mkdirp, needRepo, needWork, relPath } from "./GitCmd.Files.js";
import { readIndex, writeIndex } from "./GitCmd.Index.js";
import { toSpec } from "./GitCmd.WorkTree.js";
import { fail, fatal, type G } from "./GitCmd.js";

export function cmdMv(g: G, args: string[]): number {
  const o = parseArgs(args, ["f|force", "v|verbose", "n|dry-run", "k"], "mv");
  const r = needRepo(g);
  const root = needWork(r);
  const ops = [...o.operands, ...(o.paths ?? [])];
  if (ops.length < 2) throw fail("usage: git mv [-v] [-f] [-n] [-k] <source> <destination>\n   or: git mv [-v] [-f] [-n] [-k] <source>... <destination-directory>", 129);
  const destRaw = ops.pop()!;
  const destSpec = toSpec(r, destRaw);
  const destIsDir = ops.length > 1 || isDirAt(g, join(root, destSpec.rel));
  if (ops.length > 1 && !isDirAt(g, join(root, destSpec.rel))) throw fatal(`destination '${destRaw}' is not a directory`);
  const idx = readIndex(r);
  const moves: { from: string; to: string }[] = [];
  for (const srcRaw of ops) {
    const src = toSpec(r, srcRaw);
    const target = destIsDir ? (destSpec.rel !== "" ? `${destSpec.rel}/` : "") + src.rel.split("/").at(-1)! : destSpec.rel;
    const desc = `source=${srcRaw}, destination=${destIsDir ? relPath(g.cwd, join(root, target)) : destRaw}`;
    if (!existsAt(g, join(root, src.rel))) throw fatal(`bad source, ${desc}`);
    const inside = idx.entries.keys.filter((p) => p === src.rel || p.startsWith(src.rel + "/"));
    if (inside.length === 0) throw fatal(`not under version control, ${desc}`);
    if (target === src.rel || target.startsWith(src.rel + "/")) throw fatal(`can not move directory into itself, ${desc}`);
    if (existsAt(g, join(root, target)) && !o.has("force")) throw fatal(`destination exists, ${desc}`);
    for (const p of inside) moves.push({ from: p, to: target + p.slice(src.rel.length) });
    if (o.has("verbose") || o.has("dry-run")) g.out(`Renaming ${src.rel} to ${target}\n`);
    if (o.has("dry-run")) continue;
    const node = g.sh.vfs.lookup(join(root, src.rel), g.user);
    mkdirp(g, VfsLib.dirname(join(root, target)));
    if (existsAt(g, join(root, target))) g.sh.vfs.remove(join(root, target), g.user);
    g.sh.vfs.insert(join(root, target), node, g.user);
    g.sh.vfs.remove(join(root, src.rel), g.user);
  }
  if (!o.has("dry-run")) {
    for (const { from, to } of moves) {
      idx.entries.set(to, idx.entries.get(from)!);
      idx.entries.delete(from);
    }
    writeIndex(r, idx);
  }
  return 0;
}
