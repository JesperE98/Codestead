// Port of Commands/Git/GitCmd.Fetch.cs – git fetch.

import { parseArgs } from "./GitCmd.Args.js";
import { getConfig } from "./GitCmd.Config.js";
import { needRepo } from "./GitCmd.Files.js";
import { readHead } from "./GitCmd.Refs.js";
import { fetchRemote, remoteUrl } from "./GitCmd.Remote.js";
import type { G } from "./GitCmd.js";

export function cmdFetch(g: G, args: string[]): number {
  const o = parseArgs(args, ["all", "q|quiet", "prune", "p"], "fetch");
  const r = needRepo(g);
  const head = readHead(r);
  const remote = (o.operands.length > 0 ? o.operands[0]! : null) ?? (head.branch ? getConfig(g, r, `branch.${head.branch}.remote`) : null) ?? "origin";
  if (!remoteUrl(r, remote) && o.operands.length === 0) {
    // No remotes at all: real git says nothing.
    return 0;
  }
  return fetchRemote(r, remote, o.has("quiet"));
}
