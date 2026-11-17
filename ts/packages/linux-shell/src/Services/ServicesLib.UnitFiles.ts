// Port of Services/ServicesLib.UnitFiles.cs – ServicesLib: parsing, writing, finding and loading unit files, and
// enabled/preset state.

import { Js } from "../Js.js";
import type { Shell } from "../Shell/Shell.js";
import type { FsNode } from "../Vfs/FsNode.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { ParsedUnit } from "./ParsedUnit.js";
import { AdminUnitDir, SystemUnitDir } from "./ServicesLib.js";
import { ReportdExample, serviceDefs, unitFile } from "./ServicesLib.Defs.js";
import type { UnitRt } from "./UnitRt.js";

// ---------- Unit files ----------

const sectionRe = /^\[(.+)\]$/;
const execPrefixRe = /^[-@:+!]+/;
const truthyRe = /^(yes|true|1|on)$/i;

/** Reads the most important settings from a unit file. */
export function parseUnit(text: string): ParsedUnit {
  const values = new Map<string, string[]>();
  let section = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const sec = sectionRe.exec(line);
    if (sec) {
      section = sec[1]!;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = `${section}.${line.slice(0, eq).trim()}`;
    let list = values.get(key);
    if (!list) values.set(key, (list = []));
    list.push(line.slice(eq + 1).trim());
  }
  const last = (k: string): string | null => {
    const v = values.get(k);
    return v && v.length > 0 ? v.at(-1)! : null;
  };
  const listOf = (k: string): string[] =>
    (values.get(k) ?? []).flatMap((x) => x.split(/\s+/)).filter((x) => x !== "");
  const type = last("Service.Type") ?? "simple";
  const wantedBy = listOf("Install.WantedBy");
  wantedBy.push(...listOf("Install.RequiredBy"));
  return {
    description: last("Unit.Description") ?? "",
    docs: listOf("Unit.Documentation"),
    type,
    exec: (last("Service.ExecStart") ?? "").replace(execPrefixRe, ""),
    reload: last("Service.ExecReload"),
    user: last("Service.User"),
    remainAfterExit: truthyRe.test(last("Service.RemainAfterExit") ?? ""),
    wantedBy,
    alias: listOf("Install.Alias"),
  };
}

export function ensureDir(sh: Shell, path: string): FsNode {
  const root = sh.rootUser();
  let cur = "";
  let node = sh.vfs.root;
  for (const seg of path.split("/").filter((s) => s !== "")) {
    cur += "/" + seg;
    let next = node.children!.get(seg);
    if (!next) {
      next = VfsLib.makeDir("root", Js.oct(755));
      node.children!.set(seg, next);
    }
    node = next;
  }
  return sh.vfs.lookup(cur === "" ? "/" : cur, root);
}

export function wantsPath(target: string, unit: string): string {
  return `${AdminUnitDir}/${target}.wants/${unit}`;
}

export function writeUnitFiles(sh: Shell): void {
  const sys = ensureDir(sh, SystemUnitDir);
  const admin = ensureDir(sh, AdminUnitDir);
  for (const def of serviceDefs(sh.distro)) {
    const dir = def.admin ? admin : sys;
    dir.children!.set(def.name, VfsLib.makeFile(unitFile(def)));
    if (def.enabled && def.wantedBy) {
      const wants = ensureDir(sh, `${AdminUnitDir}/${def.wantedBy}.wants`);
      wants.children!.set(def.name, VfsLib.makeLink(`${def.admin ? AdminUnitDir : SystemUnitDir}/${def.name}`));
    }
  }
  const etc = sh.vfs.lookup("/etc", sh.rootUser());
  if (!etc.children!.has("reportd.conf.example")) etc.children!.set("reportd.conf.example", VfsLib.makeFile(ReportdExample));
}

/** Finds the unit file of a service (the administrator's copy wins over the package's). */
function findUnitFile(sh: Shell, name: string): { path: string; content: string } | null {
  for (const dir of [AdminUnitDir, SystemUnitDir]) {
    const node = sh.vfs.tryLookup(`${dir}/${name}`, sh.rootUser());
    if (node?.type === "file") return { path: `${dir}/${name}`, content: node.content ?? "" };
  }
  return null;
}

/** Loads (or reloads) a service from its unit file. */
export function loadUnit(sh: Shell, name: string): UnitRt | null {
  const file = findUnitFile(sh, name);
  const st = sh.services;
  if (file === null) return null;
  const existing = st.units.get(name);
  if (existing) {
    existing.path = file.path;
    existing.loaded = file.content;
    return existing;
  }
  const rt: UnitRt = { name, path: file.path, loaded: file.content, active: "inactive", sub: "dead" };
  st.units.set(name, rt);
  return rt;
}

const digitsRe = /^[0-9]+$/;
const hasSuffixRe = /\.[a-z]+$/;

/** Translates "myserver", "sshd" (alias) or "myserver.service" to a loaded service. */
export function resolveUnit(sh: Shell, arg: string): UnitRt | null {
  const st = sh.services;
  if (digitsRe.test(arg)) {
    const n = Js.number(arg);
    return [...st.units.values()].find((u) => u.pid !== null && u.pid !== undefined && u.pid === n) ?? null;
  }
  const name = hasSuffixRe.test(arg) ? arg : `${arg}.service`;
  if (!name.endsWith(".service")) return null;
  const found = st.units.get(name);
  if (found) return found;
  for (const u of st.units.values()) if (parseUnit(u.loaded).alias.includes(name)) return u;
  return loadUnit(sh, name);
}

/** The full name of the service for error messages ("myserver" → "myserver.service"). */
export function unitName(arg: string): string {
  return hasSuffixRe.test(arg) ? arg : `${arg}.service`;
}

export function unitInfo(rt: UnitRt): ParsedUnit {
  return parseUnit(rt.loaded);
}

/** Has the unit file changed since it was loaded? */
export function changedOnDisk(sh: Shell, rt: UnitRt): boolean {
  const file = findUnitFile(sh, rt.name);
  return file !== null && file.content !== rt.loaded;
}

/** "enabled", "disabled", "static" or "alias". */
export function enabledState(sh: Shell, rt: UnitRt, asked: string | null = null): string {
  if (asked && unitName(asked) !== rt.name) return "alias";
  const info = unitInfo(rt);
  if (info.wantedBy.length === 0) return "static";
  return info.wantedBy.some((t) => sh.vfs.tryLookup(wantsPath(t, rt.name), sh.rootUser()) !== null) ? "enabled" : "disabled";
}

/** "preset" in the status output: Debian enables new services, Arch and Fedora do not. */
export function presetState(sh: Shell): string {
  return sh.distro.family === "debian" ? "enabled" : "disabled";
}
