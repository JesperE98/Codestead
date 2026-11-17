// Port of Commands/Git/GitCmd.Init.cs – git init.

import * as VfsLib from "../../Vfs/VfsLib.js";
import { parseArgs } from "./GitCmd.Args.js";
import { configBool, getConfig } from "./GitCmd.Config.js";
import { checkBranchName } from "./GitCmd.Refs.js";
import { initRepo } from "./GitCmd.Subs.js";
import { fail, type G } from "./GitCmd.js";

const DefaultBranchHint =
  "Using 'main' as the name for the initial branch. Older versions of git\n" +
  "use 'master' instead. To choose the initial branch name to use in all\n" +
  "of your new repositories, which will suppress this warning, call:\n" +
  "\n" +
  "\tgit config --global init.defaultBranch <name>\n" +
  "\n" +
  "Names commonly chosen are 'main', 'master', 'trunk' and 'development'.\n" +
  "The just-created branch can be renamed via this command:\n" +
  "\n" +
  "\tgit branch -m <name>\n" +
  "\n" +
  'Disable this message with "git config set advice.defaultBranchName false"';

export function cmdInit(g: G, args: string[]): number {
  const o = parseArgs(args, ["q|quiet", "bare", "b|initial-branch="], "init");
  if (o.operands.length > 1) throw fail("usage: git init [-q | --quiet] [--bare] [-b <branch-name> | --initial-branch=<branch-name>] [<directory>]", 129);
  const dir = VfsLib.resolvePath(g.cwd, o.operands.length > 0 ? o.operands[0]! : ".");
  const configured = getConfig(g, null, "init.defaultBranch");
  const branch = o.get("initial-branch") ?? configured ?? "main";
  checkBranchName(g, branch);
  const { gitDir, existed } = initRepo(g, dir, o.has("bare"), branch);
  if (!existed && !o.has("initial-branch") && !configured && configBool(getConfig(g, null, "advice.defaultBranchName"), true)) {
    g.hint(DefaultBranchHint);
  }
  if (!o.has("quiet")) g.out(`${existed ? "Reinitialized existing" : "Initialized empty"} Git repository in ${gitDir}/\n`);
  return 0;
}
