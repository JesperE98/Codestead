// Port of Commands/Universal/UniversalCmd.cs (src/shell/commands/universal.ts) – universal package formats that
// work on every distribution: Flatpak, Snap and AppImage. All state lives in the virtual file system, just like
// on a real system:
//   Flatpak: /var/lib/flatpak (system) and ~/.local/share/flatpak (--user)
//   Snap:    /snap/<name>/<revision> and /snap/bin
//   AppImage: a single executable file, e.g. ~/Downloads/Calculator.AppImage
// Graphical programs cannot be shown in the simulator – they print a dimmed line instead.
// This is the group's root file (helpers and the command list); the core uses appImageNode for the initial file
// system. The commands themselves are UniversalCmd.<Name>.ts.

import { Js, type Obj } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import type { World } from "../../World.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export function isRoot(sh: Shell): boolean {
  return sh.currentUser().uid === 0;
}

export function dim(sh: Shell, key: string, args?: MsgArgs): string {
  return `${UtilCmd.Color.dim}${sh.msg(key, args)}${UtilCmd.Color.reset}\n`;
}

export function flag(sh: Shell, key: string): boolean {
  return sh.flags.get(key) === true;
}

/** The line shown instead of a window. */
export function windowNote(sh: Shell, app: string): string {
  return dim(sh, "universal.graphicalApp", { app });
}

export function simBinary(impl: string, owner = "root", mode = -1, group: string | null = null, extra = ""): FsNode {
  const node = VfsLib.makeFile(`${VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: ${impl})\n${extra}`, owner, mode < 0 ? Js.oct(755) : mode, group ?? owner);
  node.size = 40_000;
  return node;
}

export function tryNode(sh: Shell, path: string): FsNode | null {
  return sh.vfs.tryLookup(path, sh.rootUser());
}

export function children(sh: Shell, path: string): string[] {
  return [...(tryNode(sh, path)?.children?.keys() ?? [])].sort();
}

export function kids(...items: [string, FsNode][]): Obj<FsNode> {
  return new Map(items);
}

// ================================================================ AppImage

/**
 * A downloaded AppImage (as in the initial file system): a single file, not yet executable.
 * Its name is the world's {{calculator}} in {{downloads}}, e.g. ~/Downloads/Calculator.AppImage.
 */
export function appImageNode(w: World, owner: string, group: string | null = null): FsNode {
  const desktop = w.get("calculator").replaceAll(".AppImage", "").toLowerCase();
  const node = simBinary("appimage-runtime", owner, Js.oct(644), group ?? owner, `AppImage: ${w.get("calcName")} 2.3.1\nDesktop: ${desktop}.desktop\nType 2 AppImage (squashfs)\n`);
  node.size = 48_312_832;
  return node;
}

/** The group's commands, in the C# order: flatpak, snap, appimage-runtime. Wave 2 fills this in (see PORTING.md). */
export function all(): CommandDef[] {
  return [];
}
