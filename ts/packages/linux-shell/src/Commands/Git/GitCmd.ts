// Port of Commands/Git/GitCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/git.ts – this part: errors and output, help, the subcommand table and the command itself. Each subcommand is in GitCmd.<Subcommand>.cs; objects, refs, revisions, index, config, work tree, diff and status are in their own GitCmd.*.cs files.  git – a small but real version control system working against the virtual file system. The repository is stored in .git/ as ordinary files: objects (blob, tree, commit, tag) under .git/objects/xx/…, branches under .git/refs/heads/, HEAD, index, config and a simple reflog in .git/logs/HEAD. Everything is text, so the repository is saved with the terminal as JSON. Objects are hashed with SHA-1 like real git – a blob gets the same id as on a real computer. Trees are stored simplified as a flat list of paths.
//
// Wave 2 ports this group: the root file (the C# GitCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file GitCmd.<Name>.cs becomes GitCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * new CommandDef { Name = "git", Summary = "Versionshantering", SummaryEn = "Version control", Man = ManSv, ManEn = ManEn, Run = RunCommand, }
 */
export function all(): CommandDef[] {
  return [];
}
