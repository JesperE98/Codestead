// Port of Commands/Universal/UniversalCmd.FlatpakStore.cs – Flatpak: the Flathub catalogue, remotes and installed
// refs in the virtual file system.

import * as ExtrarepoLib from "../../Extrarepo/ExtrarepoLib.js";
import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { children, flag, kids, tryNode } from "./UniversalCmd.js";

export interface FlatpakApp {
  id: string;
  name: string;
  summary: string;
  version: string;
  branch: string;
  runtime: string;
  /** MB to download. */
  sizeMb: number;
  /** Excerpt of the permissions (the sandbox). */
  permissions: string[];
  /** Also in Fedora's own Flatpak remote. */
  inFedora?: boolean;
}

export interface FlatpakRuntime {
  id: string;
  name: string;
  branch: string;
  sizeMb: number;
}

export const runtimes = new Map<string, FlatpakRuntime>([
  ["org.gnome.Platform//49", { id: "org.gnome.Platform", name: "GNOME Application Platform version 49", branch: "49", sizeMb: 381 }],
  ["org.freedesktop.Platform//25.08", { id: "org.freedesktop.Platform", name: "Freedesktop Platform", branch: "25.08", sizeMb: 245 }],
  ["org.kde.Platform//6.9", { id: "org.kde.Platform", name: "KDE Application Platform", branch: "6.9", sizeMb: 412 }],
]);

export const flathub: FlatpakApp[] = [
  { id: "org.gimp.GIMP", name: "GNU Image Manipulation Program", summary: "Create images and edit photographs", version: "3.0.6", branch: "stable", runtime: "org.gnome.Platform//49", sizeMb: 130, permissions: ["ipc", "network", "x11", "wayland", "dri", "file access: host"], inFedora: true },
  { id: "org.videolan.VLC", name: "VLC", summary: "VLC media player, the open-source multimedia player", version: "3.0.21", branch: "stable", runtime: "org.kde.Platform//6.9", sizeMb: 92, permissions: ["ipc", "network", "pulseaudio", "x11", "wayland", "dri", "file access: host"] },
  { id: "org.mozilla.firefox", name: "Firefox", summary: "Fast, Private & Safe Web Browser", version: "144.0", branch: "stable", runtime: "org.freedesktop.Platform//25.08", sizeMb: 105, permissions: ["ipc", "network", "pulseaudio", "wayland", "x11", "dri", "file access: xdg-download"] },
  { id: "org.libreoffice.LibreOffice", name: "LibreOffice", summary: "The LibreOffice productivity suite", version: "25.8.2.2", branch: "stable", runtime: "org.freedesktop.Platform//25.08", sizeMb: 312, permissions: ["ipc", "network", "x11", "wayland", "dri", "file access: host"], inFedora: true },
  { id: "org.inkscape.Inkscape", name: "Inkscape", summary: "Vector Graphics Editor", version: "1.4.2", branch: "stable", runtime: "org.gnome.Platform//49", sizeMb: 118, permissions: ["ipc", "x11", "wayland", "dri", "file access: host"] },
  { id: "com.spotify.Client", name: "Spotify", summary: "Online music streaming service", version: "1.2.74.477", branch: "stable", runtime: "org.freedesktop.Platform//25.08", sizeMb: 180, permissions: ["ipc", "network", "pulseaudio", "x11", "dri", "file access: xdg-music:ro"] },
  { id: "org.kde.krita", name: "Krita", summary: "Digital Painting, Creative Freedom", version: "5.2.13", branch: "stable", runtime: "org.kde.Platform//6.9", sizeMb: 205, permissions: ["ipc", "x11", "wayland", "dri", "file access: host"] },
];

export const FlathubUrl = "https://dl.flathub.org/repo/flathub.flatpakrepo";
const fedoraRemote = "oci+https://registry.fedoraproject.org";

// inst is "system" or "user".
export function instBase(sh: Shell, inst: string): string {
  return inst === "system" ? "/var/lib/flatpak" : `${sh.home}/.local/share/flatpak`;
}

export function configPath(sh: Shell, inst: string): string {
  return `${instBase(sh, inst)}/repo/config`;
}

/** Creates a directory (with parents) as the right user: root for the system, the student for --user. */
export function mkdirsAs(sh: Shell, path: string, inst: string): void {
  if (inst === "system") {
    ExtrarepoLib.ensureDir(sh, path);
    return;
  }
  const user = sh.currentUser();
  let cur = "";
  for (const seg of path.split("/").filter((s) => s !== "")) {
    cur += "/" + seg;
    if (sh.vfs.tryLookup(cur, user) === null) sh.vfs.mkdir(cur, user);
  }
}

/** Fedora Workstation has Flatpak and Fedora's own remote from the start. */
export function flatpakSeed(sh: Shell): void {
  if (flag(sh, "flatpak:seeded")) return;
  sh.flags.set("flatpak:seeded", true);
  if (sh.distro.family !== "redhat" || tryNode(sh, configPath(sh, "system")) !== null) return;
  ExtrarepoLib.ensureDir(sh, "/var/lib/flatpak/repo");
  sh.vfs.writeFile(configPath(sh, "system"), `[core]\nrepo_version=1\nmode=bare-user-only\n\n[remote "fedora"]\nurl=${fedoraRemote}\nurl-is-set=true\ncollection-id=org.fedoraproject.Stable\n`, sh.rootUser());
}

const remoteHeader = /^\[remote "([^"]+)"\]/gm;

export function remotes(sh: Shell, inst: string): string[] {
  const c = tryNode(sh, configPath(sh, inst))?.content ?? "";
  return [...c.matchAll(remoteHeader)].map((m) => m[1]!);
}

export function remoteApps(remote: string): FlatpakApp[] {
  if (remote === "flathub") return flathub;
  if (remote === "fedora") return flathub.filter((a) => a.inFedora === true);
  return [];
}

export interface InstalledRef {
  ref: string;
  inst: string;
  /** "app" or "runtime". */
  kind: string;
  id: string;
  branch: string;
  meta: string;
}

export function installedRefs(sh: Shell): InstalledRef[] {
  const result: InstalledRef[] = [];
  for (const inst of ["system", "user"]) {
    const base = instBase(sh, inst);
    for (const kind of ["app", "runtime"]) {
      for (const id of children(sh, `${base}/${kind}`)) {
        for (const branch of children(sh, `${base}/${kind}/${id}/x86_64`)) {
          const meta = tryNode(sh, `${base}/${kind}/${id}/x86_64/${branch}/active/metadata`)?.content ?? "";
          result.push({ ref: `${kind}/${id}/x86_64/${branch}`, inst, kind, id, branch, meta });
        }
      }
    }
  }
  return result;
}

export function metaValue(meta: string, key: string): string {
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(meta);
  return m ? m[1]! : "";
}

/** Finds an app in flatpak's remotes: exact id, or a unique name/last part of the id (e.g. "gimp"). */
export function matchApp(query: string, apps: FlatpakApp[]): FlatpakApp | null {
  const q = query.toLowerCase();
  const exact = apps.find((a) => a.id.toLowerCase() === q);
  if (exact) return exact;
  const loose = apps.filter((a) => a.id.toLowerCase().split(".").at(-1) === q || a.name.toLowerCase() === q);
  return loose.length === 1 ? loose[0]! : null;
}

export function writeRef(sh: Shell, inst: string, kind: string, id: string, branch: string, meta: string, sizeMb: number): void {
  const dir = `${instBase(sh, inst)}/${kind}/${id}/x86_64/${branch}/active`;
  mkdirsAs(sh, dir, inst);
  const user = inst === "system" ? sh.rootUser() : sh.currentUser();
  sh.vfs.writeFile(`${dir}/metadata`, meta, user);
  const files = sh.vfs.lookup(dir, user);
  const blob = VfsLib.makeFile("(simulated program files)\n", user.name, Js.oct(644), user.groups[0] ?? null);
  blob.size = sizeMb * 1_000_000;
  files.children!.set("files", VfsLib.makeDir(user.name, Js.oct(755), kids(["program.bin", blob]), user.groups[0] ?? null));
}
