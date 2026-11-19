// Port of Commands/Fileinfo/FileinfoCmd.cs – links and information about files: ln, readlink, realpath, stat,
// file and umask. This is the group's root file: the shared helpers and the command list. The commands themselves
// are FileinfoCmd.<Name>.ts.

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as ArchiveCmd from "../Archive/ArchiveCmd.js";
import { file } from "./FileinfoCmd.File.js";
import { ln } from "./FileinfoCmd.Ln.js";
import { readlink } from "./FileinfoCmd.Readlink.js";
import { realpath } from "./FileinfoCmd.Realpath.js";
import { stat } from "./FileinfoCmd.Stat.js";
import { umask } from "./FileinfoCmd.Umask.js";

export * from "./FileinfoCmd.File.js";
export * from "./FileinfoCmd.Ln.js";
export * from "./FileinfoCmd.Readlink.js";
export * from "./FileinfoCmd.Realpath.js";
export * from "./FileinfoCmd.Stat.js";
export * from "./FileinfoCmd.Umask.js";

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

/** The path from directory from to to, e.g. "../docs/a.txt". */
export function relativePath(from: string, to: string): string {
  const a = from.split("/").filter((s) => s !== "");
  const b = to.split("/").filter((s) => s !== "");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const parts = [...Array<string>(a.length - i).fill(".."), ...b.slice(i)];
  return parts.length === 0 ? "." : parts.join("/");
}

// ---------- readlink and realpath ----------

/** The path without symbolic links, "." or "..". With lastMayBeMissing the last part need not exist. */
export function canonical(sh: Shell, arg: string, lastMayBeMissing: boolean): string | null {
  const user = sh.currentUser();
  const path = sh.resolve(arg);
  try {
    return sh.vfs.realPath(path, user);
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    if (!lastMayBeMissing || path === "/") return null;
    try {
      const dir = sh.vfs.realPath(VfsLib.dirname(path), user);
      if (sh.vfs.lookup(dir, user).type !== "dir") return null;
      // The last part may be a broken symbolic link: follow it as far as it goes.
      const link = sh.vfs.tryLookupLink(joinPath(dir, VfsLib.basename(path)), user);
      if (link?.type === "link") return VfsLib.resolvePath(dir, link.content ?? "");
      return joinPath(dir, VfsLib.basename(path));
    } catch (e2) {
      if (!(e2 instanceof FsError)) throw e2;
      return null;
    }
  }
}

/** A time the way stat shows it: 2026-11-03 10:15:22.000000000 +0100. */
export function statTime(ms: number): string {
  const local = Js.localDate(ms);
  const off = -local.getTimezoneOffset();
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  const date = `${local.getFullYear()}-${Js.pad2(local.getMonth() + 1)}-${Js.pad2(local.getDate())} ${Js.hhmmss(local)}`;
  const millis = String(((ms % 1000) + 1000) % 1000).padStart(3, "0");
  return `${date}.${millis}000000 ${sign}${Js.pad2(Math.trunc(abs / 60))}${Js.pad2(abs % 60)}`;
}

export function octal(mode: number): string {
  return (mode & Js.oct(7777)).toString(8);
}

// ---------- file ----------

const shebangRe = /^#!\s*(\S+)(?:\s+(\S+))?/;

/** What `file` says about some content (without the name). */
export function describe(content: string, executable: boolean): string {
  if (content === "") return "empty";
  if (content.startsWith(VfsLib.Elf))
    return "ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, stripped";
  const archive = ArchiveCmd.readArchive(content);
  if (archive?.format === "tar") return "POSIX tar archive (GNU)";
  if (archive?.format === "zip") return "Zip archive data, at least v2.0 to extract, compression method=deflate";
  if (content.startsWith("\u001f\u008b")) return "gzip compressed data, from Unix";
  if (content.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")) return "OpenSSH private key";
  if (content.startsWith("ssh-ed25519 ")) return "OpenSSH ED25519 public key";
  if (content.startsWith("ssh-rsa ")) return "OpenSSH RSA public key";
  const ascii = /^[\u0000-\u007f]*$/.test(content);
  const text = ascii ? "ASCII text" : "Unicode text, UTF-8 text";
  const m = shebangRe.exec(content);
  if (m) {
    const prog = VfsLib.basename(m[1] === "/usr/bin/env" && m[2] !== undefined ? m[2] : m[1]!);
    const kind =
      prog === "bash"
        ? "Bourne-Again shell script"
        : prog === "sh" || prog === "dash"
          ? "POSIX shell script"
          : prog === "zsh"
            ? "Paul Falstad's zsh script"
            : prog === "fish"
              ? "fish shell script"
              : prog.startsWith("python")
                ? "Python script"
                : `a ${m[1]} script`;
    return `${kind}, ${text}${executable ? " executable" : ""}`;
  }
  // .NET TrimStart: white space, but not the byte order mark.
  const trimmed = content.replace(/^[^\S\ufeff]+/, "");
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("<!doctype html") || lower.startsWith("<html")) return `HTML document, ${text}`;
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isJson(trimmed)) return "JSON text data";
  const lines = content.split("\n").filter((l) => l !== "");
  const commas = (l: string): number => l.split(",").length - 1;
  if (lines.length >= 2 && lines[0]!.includes(",") && lines.every((l) => commas(l) === commas(lines[0]!))) return `CSV ${text}`;
  return text;
}

function isJson(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [ln, readlink, realpath, stat, file, umask];
}
