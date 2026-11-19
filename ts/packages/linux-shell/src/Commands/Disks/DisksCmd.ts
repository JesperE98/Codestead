// Port of Commands/Disks/DisksCmd.cs (src/shell/commands/disks.ts) – commands for disks and file systems: df, lsblk,
// blkid, mount, umount, findmnt, fdisk, swapon, sync and mkfs (mkfs.ext4, mkfs.vfat ...). The disk model itself is
// in Disks/ (DisksLib). This is the group's root file: the shared helpers and the list of the group's commands.

import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { blkid } from "./DisksCmd.Blkid.js";
import { df } from "./DisksCmd.Df.js";
import { fdisk } from "./DisksCmd.Fdisk.js";
import { findmnt } from "./DisksCmd.Findmnt.js";
import { lsblk } from "./DisksCmd.Lsblk.js";
import { mkfs, mkfsDef, mkfsExt, mkfsVfatRun } from "./DisksCmd.Mkfs.js";
import { mountCmd } from "./DisksCmd.Mount.js";
import { swapon } from "./DisksCmd.Swapon.js";
import { sync } from "./DisksCmd.Sync.js";
import { umount } from "./DisksCmd.Umount.js";

export * from "./DisksCmd.Blkid.js";
export * from "./DisksCmd.Df.js";
export * from "./DisksCmd.Fdisk.js";
export * from "./DisksCmd.Findmnt.js";
export * from "./DisksCmd.Lsblk.js";
export * from "./DisksCmd.Mkfs.js";
export * from "./DisksCmd.Mount.js";
export * from "./DisksCmd.Swapon.js";
export * from "./DisksCmd.Sync.js";
export * from "./DisksCmd.Umount.js";

export function isRoot(ctx: CmdCtx): boolean {
  return ctx.sh.currentUser().uid === 0;
}

export function tip(ctx: CmdCtx, key: string, args?: MsgArgs): void {
  ctx.err(`${UtilCmd.Color.dim}${ctx.sh.msg(key, args)}${UtilCmd.Color.reset}\n`);
}

/**
 * Writes a table with columns. Cells may have several lines (\n), e.g. when a partition is
 * mounted in several places. The last column is not padded. align is 'l' or 'r'.
 */
export function table(rows: string[][], align: readonly string[], minWidths: readonly number[] = []): string {
  const sep = " ";
  const widths = align.map((_, i) => {
    let w = i < minWidths.length ? minWidths[i]! : 0;
    for (const r of rows) {
      const cell = i < r.length ? (r[i] ?? "") : "";
      for (const s of cell.split("\n")) w = Math.max(w, s.length);
    }
    return w;
  });
  let out = "";
  for (const row of rows) {
    const cells = row.map((c) => (c ?? "").split("\n"));
    const height = cells.length === 0 ? 0 : Math.max(...cells.map((c) => c.length));
    for (let line = 0; line < height; line++) {
      const parts = align.map((a, i) => {
        const text = i < cells.length && line < cells[i]!.length ? cells[i]![line]! : "";
        if (i === align.length - 1 && a === "l") return text;
        return a === "r" ? text.padStart(widths[i]!) : text.padEnd(widths[i]!);
      });
      out += parts.join(sep).trimEnd() + "\n";
    }
  }
  return out;
}

/** Tree branches drawn by lsblk and findmnt. */
export function branch(isLast: boolean): string {
  return isLast ? "└─" : "├─";
}

/** Long options for OptSpec ({ long: short }). */
export function long(...pairs: [string, string][]): Record<string, string> {
  return Object.fromEntries(pairs);
}

/** A table column: its alignment ('l' or 'r') and how to get a row's cell (full: lsblk -p). */
export interface Column<T> {
  align: string;
  get: (row: T, full: boolean) => string;
}

export const labelUuidPrefix = /^(LABEL|UUID)=/;

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [
    df,
    lsblk,
    blkid,
    mountCmd,
    umount,
    findmnt,
    fdisk,
    swapon,
    sync,
    mkfs,
    mkfsDef("mkfs.ext4", mkfsExt("ext4")),
    mkfsDef("mke2fs", mkfsExt()),
    mkfsDef("mkfs.vfat", mkfsVfatRun),
    mkfsDef("mkfs.fat", mkfsVfatRun),
  ];
}
