// Port of Commands/Disks/DisksCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/disks.ts – commands for disks and file systems: df, lsblk, blkid, mount, umount, findmnt, fdisk, swapon, sync and mkfs (mkfs.ext4, mkfs.vfat ...). The disk model itself is in Disks/ (DisksLib).
//
// Wave 2 ports this group: the root file (the C# DisksCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file DisksCmd.<Name>.cs becomes DisksCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Df, Lsblk, Blkid, MountCmd, Umount, Findmnt, Fdisk, Swapon, Sync, Mkfs, MkfsDef("mkfs.ext4", MkfsExt("ext4")), MkfsDef("mke2fs", MkfsExt()), MkfsDef("mkfs.vfat", MkfsVfatRun), MkfsDef("mkfs.fat", MkfsVfatRun)
 */
export function all(): CommandDef[] {
  return [];
}
