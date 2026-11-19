// Port of Commands/Universal/UniversalCmd.Snap.cs – the snap command: installs and manages snap packages
// (Canonical/Ubuntu).

import * as ExtrarepoLib from "../../Extrarepo/ExtrarepoLib.js";
import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { children, dim, flag, isRoot, simBinary, tryNode, windowNote } from "./UniversalCmd.js";

export interface SnapDef {
  name: string;
  version: string;
  rev: number;
  publisher: string;
  summary: string;
  /** Graphical program (otherwise it runs in the terminal). */
  gui: boolean;
  classic?: boolean;
  base?: string | null;
  /** Commands in /snap/bin. */
  apps?: string[] | null;
  notes?: string | null;
  sizeMb: number;
}

export const snaps: SnapDef[] = [
  { name: "bare", version: "1.0", rev: 5, publisher: "canonical✓", summary: "Empty base snap, useful for testing and fully statically linked snaps", gui: false, notes: "base", sizeMb: 0, apps: [] },
  { name: "core22", version: "20250923", rev: 2133, publisher: "canonical✓", summary: "Runtime environment based on Ubuntu 22.04", gui: false, notes: "base", sizeMb: 77, apps: [] },
  { name: "core24", version: "20250926", rev: 1196, publisher: "canonical✓", summary: "Runtime environment based on Ubuntu 24.04", gui: false, notes: "base", sizeMb: 70, apps: [] },
  { name: "snapd", version: "2.71", rev: 25202, publisher: "canonical✓", summary: "Daemon and tooling that enable snap packages", gui: false, notes: "snapd", sizeMb: 50, apps: [] },
  { name: "gtk-common-themes", version: "0.1-81-g442e511", rev: 1535, publisher: "canonical✓", summary: "Common GTK themes for snaps", gui: false, sizeMb: 92, apps: [] },
  { name: "gnome-42-2204", version: "0+git.38ea591", rev: 202, publisher: "canonical✓", summary: "Shared GNOME 42 Ubuntu stack", gui: false, sizeMb: 516, apps: [] },
  { name: "firefox", version: "144.0-2", rev: 7084, publisher: "mozilla✓", summary: "Mozilla Firefox web browser", gui: true, base: "core22", sizeMb: 265 },
  { name: "hello-world", version: "6.4", rev: 29, publisher: "canonical✓", summary: "The 'hello-world' of snaps", gui: false, base: "core22", sizeMb: 1, apps: ["hello-world"] },
  { name: "vlc", version: "3.0.21", rev: 3777, publisher: "videolan✓", summary: "The ultimate media player", gui: true, base: "core22", sizeMb: 340 },
  { name: "gimp", version: "3.0.6", rev: 532, publisher: "snapcrafters✪", summary: "GNU Image Manipulation Program", gui: true, base: "core24", sizeMb: 380 },
  { name: "code", version: "1.105.1", rev: 208, publisher: "vscode✓", summary: "Code editing. Redefined.", gui: true, classic: true, base: "core22", sizeMb: 330 },
  { name: "spotify", version: "1.2.74.477", rev: 88, publisher: "spotify✓", summary: "Music for everyone", gui: true, base: "core22", sizeMb: 190 },
  { name: "calculator", version: "2.3.1", rev: 12, publisher: "calclab", summary: "A simple calculator (also available as an AppImage)", gui: true, base: "core24", sizeMb: 48 },
];

const ubuntuSeed = ["bare", "core22", "core24", "firefox", "gnome-42-2204", "gtk-common-themes", "snapd"];

export function getSnapDef(name: string): SnapDef | null {
  return snaps.find((s) => s.name === name) ?? null;
}

export interface InstalledSnap {
  def: SnapDef;
  rev: number;
  classic: boolean;
}

const classicRe = /confinement: classic/;

/** Installed snaps: /snap/&lt;name&gt;/&lt;revision&gt;/meta/snap.yaml */
export function installedSnaps(sh: Shell): InstalledSnap[] {
  const result: InstalledSnap[] = [];
  for (const name of children(sh, "/snap")) {
    if (name === "bin") continue;
    const def = getSnapDef(name);
    const revs = children(sh, `/snap/${name}`)
      .map((n) => Js.number(n))
      .filter((n) => !Number.isNaN(n));
    if (def === null || revs.length === 0) continue;
    const rev = Math.max(...revs);
    const yaml = tryNode(sh, `/snap/${name}/${Js.num(rev)}/meta/snap.yaml`)?.content ?? "";
    result.push({ def, rev, classic: classicRe.test(yaml) });
  }
  return result;
}

function placeSnap(sh: Shell, def: SnapDef, classic: boolean): void {
  ExtrarepoLib.ensureDir(sh, `/snap/${def.name}/${def.rev}/meta`);
  sh.vfs.writeFile(
    `/snap/${def.name}/${def.rev}/meta/snap.yaml`,
    `name: ${def.name}\nversion: '${def.version}'\nsummary: ${def.summary}\n${def.base ? `base: ${def.base}\n` : ""}confinement: ${classic ? "classic" : "strict"}\n`,
    sh.rootUser(),
  );
  ExtrarepoLib.ensureDir(sh, "/var/lib/snapd/snaps");
  const blob = VfsLib.makeFile("hsqs (simulated squashfs image)\n", "root", Js.oct(600));
  blob.size = def.sizeMb * 1_000_000;
  sh.vfs.insert(`/var/lib/snapd/snaps/${def.name}_${def.rev}.snap`, blob, sh.rootUser());
  if (def.notes === "base" || def.notes === "snapd" || def.apps?.length === 0) return;
  ExtrarepoLib.ensureDir(sh, "/snap/bin");
  // Just like for real, /snap/bin/<program> points to the snap command itself.
  for (const app of def.apps ?? [def.name]) sh.vfs.insert(`/snap/bin/${app}`, simBinary("snap"), sh.rootUser());
}

/** Ubuntu ships with a few snaps (Firefox among them). */
function snapSeed(sh: Shell): void {
  if (flag(sh, "snap:seeded")) return;
  sh.flags.set("snap:seeded", true);
  if (sh.distro.id !== "ubuntu" || tryNode(sh, "/snap") !== null) return;
  for (const n of ubuntuSeed) placeSnap(sh, getSnapDef(n)!, false);
}

function runSnapApp(ctx: CmdCtx, name: string): number {
  const sh = ctx.sh;
  const inst = installedSnaps(sh).find((s) => s.def.name === name || (s.def.apps?.includes(name) ?? false));
  if (inst === undefined) {
    ctx.err(`error: cannot find current revision for snap ${name}: readlink /snap/${name}/current: no such file or directory\n`);
    return 1;
  }
  if (inst.def.name === "hello-world") {
    ctx.out("Hello World!\n");
    return 0;
  }
  ctx.out(windowNote(sh, inst.def.name));
  return 0;
}

const snapManSv = `NAMN
       snap - installera och hantera snap-paket

SYNOPSIS
       snap KOMMANDO [FLAGGOR] [SNAP]...

BESKRIVNING
       Snap är Canonicals paketformat och standard i Ubuntu. Snaps kommer
       från Snap Store, körs i en sandlåda (confinement) och uppdateras
       automatiskt i bakgrunden. Tjänsten snapd sköter allt.

       Program som behöver komma åt hela systemet (t.ex. kodeditorer)
       publiceras med "classic confinement" och måste installeras med
       --classic – då körs de utan sandlåda.

KOMMANDON
       find ORD          sök i Snap Store
       info SNAP         visa information och kanaler
       install SNAP      installera (kräver root)
       list              lista installerade snaps
       run SNAP          kör ett program från en snap
       refresh           uppdatera alla snaps nu
       remove SNAP       ta bort en snap

FLAGGOR
       --classic         tillåt classic confinement (ingen sandlåda)
       --channel=KANAL   t.ex. latest/beta eller latest/edge

EXEMPEL
       sudo snap install hello-world
       snap run hello-world
       sudo snap install code --classic`;

const snapManEn = `NAME
       snap - install and manage snap packages

SYNOPSIS
       snap COMMAND [OPTIONS] [SNAP]...

DESCRIPTION
       Snap is Canonical's package format and the default in Ubuntu. Snaps
       come from the Snap Store, run in a sandbox (confinement) and are
       updated automatically in the background. The snapd service handles
       everything.

       Programs that need access to the whole system (e.g. code editors)
       are published with "classic confinement" and must be installed
       with --classic - then they run without a sandbox.

COMMANDS
       find WORD         search the Snap Store
       info SNAP         show information and channels
       install SNAP      install (needs root)
       list              list installed snaps
       run SNAP          run a program from a snap
       refresh           update all snaps now
       remove SNAP       remove a snap

OPTIONS
       --classic         allow classic confinement (no sandbox)
       --channel=CHANNEL e.g. latest/beta or latest/edge

EXAMPLES
       sudo snap install hello-world
       snap run hello-world
       sudo snap install code --classic`;

export const snap: CommandDef = {
  name: "snap",
  summary: "Installerar och hanterar snap-paket (Canonical/Ubuntu)",
  summaryEn: "Installs and manages snap packages (Canonical/Ubuntu)",
  man: snapManSv,
  manEn: snapManEn,
  run: runSnap,
};

const publisherMark = /[✓✪]$/;

function runSnap(ctx: CmdCtx): number {
  const sh = ctx.sh;
  snapSeed(sh);
  // /snap/bin/hello-world is really snap itself – then run the program.
  const invokedAs = VfsLib.basename(ctx.name);
  if (invokedAs !== "snap") return runSnapApp(ctx, invokedAs);

  const cmd = ctx.args.length > 0 ? ctx.args[0]! : null;
  const rest = ctx.args.slice(1);
  const o = UtilCmd.parseOpts(rest, {
    long: { classic: "c", channel: "C", beta: "b", edge: "e", candidate: "d", stable: "s", all: "a", purge: "p", list: "l" },
    values: "C",
  });
  if (o.error !== null) {
    ctx.err(`error: ${o.error}\n`);
    return 1;
  }
  const denied = (): number => {
    ctx.err("error: access denied (try with sudo)\n");
    return 1;
  };
  switch (cmd) {
    case null:
    case "help":
    case "--help":
      ctx.out(
        "The snap command lets you install, configure, refresh and remove snaps.\nSnaps are packages that work across many different Linux distributions,\nenabling secure delivery and operation of the latest apps and utilities.\n\nUsage: snap <command> [<options>...]\n\nCommonly used commands can be classified as follows:\n\n         Basics: find, info, install, remove, list\n        ...more: refresh, revert, switch, disable, enable\n            Run: run\n",
      );
      return cmd !== null ? 0 : 1;
    case "version":
    case "--version":
      ctx.out(`snap    2.71\nsnapd   2.71\nseries  16\n${sh.distro.id}  ${sh.distro.version}\nkernel  ${sh.distro.kernel}\n`);
      return 0;
    case "list": {
      const list = installedSnaps(sh);
      if (list.length === 0) {
        ctx.out("No snaps are installed yet. Try 'snap install hello-world'.\n");
        return 0;
      }
      ctx.out(`${"Name".padEnd(19)}${"Version".padEnd(17)}${"Rev".padEnd(7)}${"Tracking".padEnd(17)}${"Publisher".padEnd(14)}Notes\n`);
      for (const s of list) {
        const notes = s.classic ? "classic" : (s.def.notes ?? "-");
        ctx.out(`${s.def.name.padEnd(19)}${s.def.version.padEnd(17)}${Js.num(s.rev).padEnd(7)}${"latest/stable".padEnd(17)}${s.def.publisher.padEnd(14)}${notes}\n`);
      }
      return 0;
    }
    case "find":
    case "search": {
      const q = o.operands.join(" ").toLowerCase();
      const hits = snaps.filter((s) => !s.notes && (s.name.includes(q) || s.summary.toLowerCase().includes(q)));
      if (hits.length === 0) {
        ctx.err(`No matching snaps for "${q}"\n`);
        return 1;
      }
      ctx.out(`${"Name".padEnd(13)}${"Version".padEnd(13)}${"Publisher".padEnd(15)}${"Notes".padEnd(9)}Summary\n`);
      for (const s of hits) ctx.out(`${s.name.padEnd(13)}${s.version.padEnd(13)}${s.publisher.padEnd(15)}${(s.classic === true ? "classic" : "-").padEnd(9)}${s.summary}\n`);
      return 0;
    }
    case "info": {
      const def = o.operands.length > 0 && o.operands[0] !== "" ? getSnapDef(o.operands[0]!) : null;
      if (def === null) {
        ctx.err(`error: no snap found for "${o.operands.length > 0 ? o.operands[0] : ""}"\n`);
        return 1;
      }
      const inst = installedSnaps(sh).find((s) => s.def === def);
      const classic = def.classic === true;
      ctx.out(
        `name:      ${def.name}\nsummary:   ${def.summary}\npublisher: ${def.publisher.replace(publisherMark, "")}\nlicense:   unset\n` +
          (classic ? "notes:     classic confinement – runs without the sandbox\n" : "") +
          `channels:\n  latest/stable:    ${def.version.padEnd(16)} (${def.rev}) ${def.sizeMb}MB${classic ? " classic" : ""}\n` +
          `  latest/candidate: ↑\n  latest/beta:      ↑\n  latest/edge:      ${def.version}+git (${def.rev + 7}) ${def.sizeMb}MB${classic ? " classic" : ""}\n` +
          (inst !== undefined ? `installed:          ${def.version.padEnd(16)} (${Js.num(inst.rev)}) ${def.sizeMb}MB${inst.classic ? " classic" : ""}\n` : ""),
      );
      return 0;
    }
    case "install": {
      if (o.operands.length === 0) {
        ctx.err("error: the required argument `<snap> (at least 1 argument)` was not provided\n");
        return 1;
      }
      if (!isRoot(sh)) return denied();
      let code = 0;
      for (const name of o.operands) {
        const def = getSnapDef(name);
        if (def === null) {
          ctx.err(`error: snap "${name}" not found\n`);
          code = 1;
          continue;
        }
        if (installedSnaps(sh).some((s) => s.def === def)) {
          ctx.out(`snap "${name}" is already installed, see 'snap help refresh'\n`);
          continue;
        }
        if (def.classic === true && !o.flags.has("c")) {
          ctx.err(
            `error: This revision of snap "${name}" was published using classic confinement and thus may\n` +
              "       perform arbitrary system changes outside of the security sandbox that snaps are usually\n" +
              "       confined to, which may put your system at risk.\n\n       If you understand and want to proceed repeat the command including --classic.\n",
          );
          code = 1;
          continue;
        }
        // The base (core22, core24 ...) and snapd come along if they are missing.
        for (const dep of ["snapd", def.base].filter((x): x is string => !!x)) {
          if (!installedSnaps(sh).some((s) => s.def.name === dep)) placeSnap(sh, getSnapDef(dep)!, false);
        }
        placeSnap(sh, def, def.classic === true);
        const channel = o.values.get("C") ?? (o.flags.has("b") ? "beta" : o.flags.has("e") ? "edge" : o.flags.has("d") ? "candidate" : "");
        ctx.out(`${name}${channel !== "" ? ` (${channel})` : ""} ${def.version} from ${def.publisher} installed\n`);
      }
      if (!(sh.env.get("PATH") ?? "").split(":").includes("/snap/bin")) {
        sh.env.set("PATH", `${sh.env.get("PATH") ?? "/usr/bin:/bin"}:/snap/bin`);
        ctx.out(dim(sh, "universal.snapPathAdded"));
      }
      return code;
    }
    case "remove": {
      if (o.operands.length === 0) {
        ctx.err("error: the required argument `<snap> (at least 1 argument)` was not provided\n");
        return 1;
      }
      if (!isRoot(sh)) return denied();
      for (const name of o.operands) {
        const inst = installedSnaps(sh).find((s) => s.def.name === name);
        if (inst === undefined) {
          ctx.out(`snap "${name}" is not installed\n`);
          continue;
        }
        sh.vfs.remove(`/snap/${name}`, sh.rootUser());
        for (const app of inst.def.apps ?? [name]) {
          if (tryNode(sh, `/snap/bin/${app}`) !== null) sh.vfs.remove(`/snap/bin/${app}`, sh.rootUser());
        }
        const blob = `/var/lib/snapd/snaps/${name}_${Js.num(inst.rev)}.snap`;
        if (tryNode(sh, blob) !== null) sh.vfs.remove(blob, sh.rootUser());
        ctx.out(`${name} removed${o.flags.has("p") ? "" : " (snap data snapshot saved)"}\n`);
      }
      return 0;
    }
    case "refresh": {
      if (o.flags.has("l")) {
        ctx.out("All snaps up to date.\n");
        return 0;
      }
      if (!isRoot(sh)) return denied();
      ctx.out("All snaps up to date.\n");
      return 0;
    }
    case "run": {
      const name = o.operands.length > 0 ? o.operands[0]! : null;
      if (!name) {
        ctx.err("error: need the application to run as argument\n");
        return 1;
      }
      return runSnapApp(ctx, name);
    }
  }
  ctx.err(`error: unknown command "${cmd ?? ""}", see 'snap help'.\n`);
  return 1;
}
