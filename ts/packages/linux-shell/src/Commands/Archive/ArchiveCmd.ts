// Port of Commands/Archive/ArchiveCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/archive.ts – archives and compression: tar, gzip, gunzip, zcat, zip and unzip – plus du, which shows how much space files and directories take.  The archives are ordinary strings in the virtual file system:      MARKER NUL pretend-size NUL encoded-content  The content is JSON (paths, type, permissions, owner, time and file content) encoded with base64 and a substituted alphabet, so that `cat archive.tar` looks like binary garbage. The pretend size (shown by ls -l and du) is a simple estimate of how well deflate – the algorithm in gzip and zip – would have compressed the content. The markers are recognised by VfsLib.NodeSize().
//
// Wave 2 ports this group: the root file (the C# ArchiveCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file ArchiveCmd.<Name>.cs becomes ArchiveCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Tar, Gzip, Gunzip, Zcat, Zip, Unzip, Du
 */
export function all(): CommandDef[] {
  return [];
}
