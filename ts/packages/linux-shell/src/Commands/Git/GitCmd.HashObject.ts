// Port of Commands/Git/GitCmd.HashObject.cs – git hash-object.

import * as VfsLib from "../../Vfs/VfsLib.js";
import { parseArgs } from "./GitCmd.Args.js";
import { needRepo, readText } from "./GitCmd.Files.js";
import { writeObj } from "./GitCmd.Objects.js";
import { blobHash, fatal, raise, type G } from "./GitCmd.js";

export function cmdHashObject(g: G, args: string[]): number {
  const o = parseArgs(args, ["w", "stdin", "t="], "hash-object");
  const r = o.has("w") ? needRepo(g) : null;
  const inputs = o.has("stdin")
    ? [g.ctx.stdin ?? ""]
    : o.operands.map((f) => readText(g, VfsLib.resolvePath(g.cwd, f)) ?? raise(fatal(`could not open '${f}' for reading: No such file or directory`)));
  for (const data of inputs) g.out((r !== null ? writeObj(r, "blob", data) : blobHash(data)) + "\n");
  return 0;
}
