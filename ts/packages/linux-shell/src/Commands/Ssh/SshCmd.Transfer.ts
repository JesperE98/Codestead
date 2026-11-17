// Port of Commands/Ssh/SshCmd.Transfer.cs – copying files over ssh: what scp and rsync share. (The list of the
// transfer commands, SshCmd.Transfer in C#, is transfer() in the group root SshCmd.ts, which IndexCmd calls.)

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { Sink } from "../../Types/Sink.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import type { User } from "../../Vfs/User.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { authenticate, parseDest, serverFor, sshConnect } from "./SshCmd.js";

/** One side of a copy: a path on this computer or on the server. */
export interface Place {
  sh: Shell;
  user: User;
  /** The absolute path. */
  path: string;
  /** As the student wrote it (for messages). */
  label: string;
  /** The path ended with / (rsync: copy what is in the directory, not the directory). */
  slash: boolean;
  remote: boolean;
}

// C# $ (without Multiline) also matches before a final \n.
const remoteRe = /^(?:([^@/:]+)@)?([^/:]+):(.*)(?=\n?$)/;

/** "user@host:path" → { raw, path }; null for a local path. */
export function splitRemote(arg: string): { raw: string; path: string } | null {
  const m = remoteRe.exec(arg);
  if (!m) return null;
  const raw = (m[1] !== undefined ? m[1] + "@" : "") + m[2]!;
  return { raw, path: m[3]! };
}

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

export function localPlace(sh: Shell, arg: string): Place {
  return { sh, user: sh.currentUser(), path: sh.resolve(arg === "" ? "." : arg), label: arg, slash: arg.endsWith("/"), remote: false };
}

/** A path on the server: relative paths start in the home directory there. */
export function remotePlace(server: Shell, path: string, label: string): Place {
  const home = server.world.home;
  const abs = path === "" || path === "~" ? home : path.startsWith("~/") ? home + path.slice(1) : path.startsWith("/") ? path : `${home}/${path}`;
  return { sh: server, user: server.currentUser(), path: VfsLib.normalizePath(abs), label, slash: path.endsWith("/"), remote: true };
}

/** A copy of a file or directory tree, owned by owner. */
export function copyFor(node: FsNode, owner: User, keepTimes: boolean): FsNode {
  const copy = VfsLib.cloneNode(node);
  const own = (n: FsNode): void => {
    n.owner = owner.name;
    n.group = owner.groups[0] ?? owner.name;
    if (!keepTimes) n.mtime = Js.now();
    for (const c of n.children?.values() ?? []) own(c);
  };
  own(copy);
  return copy;
}

/** Connects (host key question, password or key) and then runs then with the server. */
export function withServer(ctx: CmdCtx, who: string, raw: string, port: number | null, then: (server: Shell, io: Sink) => number): number {
  const sh = ctx.sh;
  const { dest: d, error: configError } = parseDest(raw, null, sh, port);
  if (d === null) {
    ctx.err(configError!);
    return 255;
  }
  return sshConnect(ctx, d, (io) => {
    if (!authenticate(sh, d, io)) return 255;
    return then(serverFor(sh), io);
  });
}
