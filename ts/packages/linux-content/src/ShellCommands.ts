// The command groups of @codestead/linux-shell that the checks use but its index does not export (C#: they are public
// classes in Codestead.Shell.Commands). They are imported from the package's sources; loading the package's index
// first keeps its own module order (the group roots and their parts import each other).

import "@codestead/linux-shell";
import type { Obj, Shell } from "@codestead/linux-shell";
import * as GitCmdModule from "../../linux-shell/src/Commands/Git/GitCmd.js";

export * as ArchiveCmd from "../../linux-shell/src/Commands/Archive/ArchiveCmd.js";
export * as CronCmd from "../../linux-shell/src/Commands/Cron/CronCmd.js";
export * as SshCmd from "../../linux-shell/src/Commands/Ssh/SshCmd.js";
export * as TextCmd from "../../linux-shell/src/Commands/Text/TextCmd.js";

/** What GitCmd.gitRepoState returns (C#: GitCmd.RepoState). */
export interface RepoState {
  branch: string | null;
  head: string | null;
  branches: Obj<string>;
  /** The files in the HEAD commit. */
  files: string[];
  /** Number of commits reachable from HEAD. */
  commits: number;
}

/** The helpers of the Git group that the git chapter's checks use (C#: GitCmd.GitRepoState, …). */
export interface GitChecks {
  gitRepoState(sh: Shell, dir: string): RepoState | null;
  gitIsAncestor(sh: Shell, dir: string, a: string, b: string): boolean;
  gitGlobalConfig(sh: Shell, home: string, key: string): string | null;
}

/**
 * The Git group. It is being ported in parallel (branch ts-cmd-a); until it is merged the stub has none of these
 * functions, a call throws and the check counts as "not done" (see ProgressLib.evaluateTasks). Once it is merged
 * the cast is no longer needed: GitCmd.gitRepoState and the others have exactly these signatures.
 */
export const GitCmd = GitCmdModule as unknown as GitChecks;
