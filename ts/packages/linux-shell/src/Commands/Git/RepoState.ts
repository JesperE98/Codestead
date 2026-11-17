// Port of Commands/Git/RepoState.cs – a summary of a repository (see GitCmd.gitRepoState).

import type { Obj } from "../../Js.js";

/** A summary of a repository (see gitRepoState). */
export interface RepoState {
  branch: string | null;
  head: string | null;
  branches: Obj<string>;
  /** The files in the HEAD commit. */
  files: string[];
  /** Number of commits reachable from HEAD. */
  commits: number;
}
