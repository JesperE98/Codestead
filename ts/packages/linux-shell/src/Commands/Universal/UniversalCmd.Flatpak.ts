// Port of Commands/Universal/UniversalCmd.Flatpak.cs – the flatpak command: installs and runs sandboxed
// applications (Flatpak/Flathub).

import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ReposCmd from "../Repos/ReposCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { dim, flag, isRoot, tryNode, windowNote } from "./UniversalCmd.js";
import {
  configPath,
  type FlatpakApp,
  flathub,
  FlathubUrl,
  flatpakSeed,
  type InstalledRef,
  instBase,
  installedRefs,
  matchApp,
  metaValue,
  mkdirsAs,
  remoteApps,
  remotes,
  runtimes,
  writeRef,
} from "./UniversalCmd.FlatpakStore.js";

const flatpakManSv = `NAMN
       flatpak - installera och kör program i en sandlåda

SYNOPSIS
       flatpak KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       Flatpak är ett paketformat för skrivbordsprogram som fungerar i alla
       distributioner. Programmen kommer från en "remote" – oftast Flathub –
       och körs i en sandlåda med bara de behörigheter de bett om. Gemensamma
       bibliotek finns i delade "runtimes" (t.ex. org.gnome.Platform).

       Program kan installeras för hela systemet (standard) eller bara för
       dig med --user. Användarinstallationen har egna remotes.

KOMMANDON
       remote-add NAMN URL    lägg till en källa (remote)
       remotes                lista källorna
       search ORD             sök efter program
       install REMOTE ID      installera ett program
       list                   lista installerade program och runtimes
       run ID                 starta ett program
       info ID                visa information om ett installerat program
       update                 uppdatera allt
       uninstall ID           ta bort ett program
       uninstall --unused     ta bort runtimes som inget program använder

FLAGGOR
       --user            använd din egen installation i ~/.local/share/flatpak
       --system          använd systemets installation (standard)
       --if-not-exists   inget fel om källan redan finns (remote-add)
       -y, --assumeyes   svara ja på frågor
       --app, --runtime  visa bara program eller runtimes (list)

EXEMPEL
       flatpak remote-add --if-not-exists flathub ${FlathubUrl}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP`;

const flatpakManEn = `NAME
       flatpak - install and run applications in a sandbox

SYNOPSIS
       flatpak COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       Flatpak is a package format for desktop applications that works on
       every distribution. Applications come from a "remote" - usually
       Flathub - and run in a sandbox with only the permissions they asked
       for. Common libraries live in shared "runtimes" (e.g.
       org.gnome.Platform).

       Applications can be installed for the whole system (the default) or
       just for you with --user. The user installation has its own remotes.

COMMANDS
       remote-add NAME URL    add a source (remote)
       remotes                list the remotes
       search WORD            search for applications
       install REMOTE ID      install an application
       list                   list installed applications and runtimes
       run ID                 start an application
       info ID                show information about an installed app
       update                 update everything
       uninstall ID           remove an application
       uninstall --unused     remove runtimes no application uses

OPTIONS
       --user            use your own installation in ~/.local/share/flatpak
       --system          use the system installation (the default)
       --if-not-exists   no error if the remote already exists (remote-add)
       -y, --assumeyes   answer yes to questions
       --app, --runtime  only show applications or runtimes (list)

EXAMPLES
       flatpak remote-add --if-not-exists flathub ${FlathubUrl}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP`;

export const flatpak: CommandDef = {
  name: "flatpak",
  summary: "Installerar och kör program i sandlåda (Flatpak/Flathub)",
  summaryEn: "Installs and runs sandboxed applications (Flatpak/Flathub)",
  man: flatpakManSv,
  manEn: flatpakManEn,
  run: runFlatpak,
};

const unrecognizedRe = /^unrecognized option/;
const epochRe = /^[0-9]+:/;
const flathubRepoFile = /flathub\.org\/repo\/flathub\.flatpakrepo$/;
const flathubRepoDir = /dl\.flathub\.org\/repo\/?$/;
const appPrefix = /^app\//;

/** n.ToString(CultureInfo.InvariantCulture).PadLeft(2) */
function num2(n: number): string {
  return String(n).padStart(2);
}

function runFlatpak(ctx: CmdCtx): number {
  const sh = ctx.sh;
  flatpakSeed(sh);
  const cmd = ctx.args.length > 0 ? ctx.args[0]! : null;
  const rest = ctx.args.slice(1);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    ctx.out(
      "Usage:\n  flatpak [OPTION…] COMMAND\n\nBuiltin Commands:\n Manage installed applications and runtimes\n  install        Install an application or runtime\n  update         Update an installed application or runtime\n  uninstall      Uninstall an installed application or runtime\n  list           List installed apps and/or runtimes\n  info           Show info for installed app or runtime\n  run            Run an application\n  search         Search for remote apps/runtimes\n  remotes        List all configured remotes\n  remote-add     Add a new remote repository (by URL)\n  remote-delete  Delete a configured remote\n",
    );
    return cmd ? 0 : 1;
  }
  if (cmd === "--version") {
    ctx.out(`Flatpak ${(sh.installed.get("flatpak") ?? "1.16.1").replace(epochRe, "").split("-")[0]}\n`);
    return 0;
  }
  const o = UtilCmd.parseOpts(rest, {
    flags: "y",
    long: {
      user: "U", system: "S", "if-not-exists": "E", assumeyes: "y", noninteractive: "y", app: "a",
      runtime: "r", unused: "u", "show-permissions": "P", columns: "c", from: "F",
    },
    values: "c",
  });
  if (o.error !== null) {
    ctx.err(`error: ${o.error.replace(unrecognizedRe, "Unknown option")}\n`);
    return 1;
  }
  const inst = o.flags.has("U") ? "user" : "system";
  const where = inst === "system" ? "system" : "user";
  const args = o.operands;

  const needRoot = (): void => {
    // On a desktop polkit asks for the password in a window; here we pretend you answered.
    if (inst === "system" && !isRoot(sh) && !flag(sh, "flatpak:polkitNote")) {
      sh.flags.set("flatpak:polkitNote", true);
      ctx.out(dim(sh, "universal.flatpakPolkit"));
    }
  };

  switch (cmd) {
    case "remote-add": {
      const name = args.length > 0 ? args[0]! : null;
      const url = args.length > 1 ? args[1]! : null;
      if (!name || !url) {
        ctx.err("error: NAME and LOCATION must be specified\n");
        return 1;
      }
      if (remotes(sh, inst).includes(name)) {
        if (o.flags.has("E")) return 0;
        ctx.err(`error: Remote ${name} already exists\n`);
        return 1;
      }
      if (!flathubRepoFile.test(url) && !flathubRepoDir.test(url)) {
        ctx.err(`error: Can't load uri ${url}: Could not resolve hostname\n`);
        ctx.err(dim(sh, "universal.flathubOnly", { url: FlathubUrl }));
        return 1;
      }
      needRoot();
      const path = configPath(sh, inst);
      mkdirsAs(sh, path.slice(0, path.lastIndexOf("/")), inst);
      const user = inst === "system" ? sh.rootUser() : sh.currentUser();
      const old = tryNode(sh, path)?.content ?? "[core]\nrepo_version=1\nmode=bare-user-only\n";
      sh.vfs.writeFile(path, `${old}\n[remote "${name}"]\nurl=https://dl.flathub.org/repo/\ngpg-verify=true\ngpg-verify-summary=true\nxa.title=Flathub\nxa.homepage=https://flathub.org/\n`, user);
      return 0;
    }
    case "remote-delete": {
      const name = args.length > 0 ? args[0]! : null;
      if (!name || !remotes(sh, inst).includes(name)) {
        ctx.err(`error: Remote "${name ?? ""}" not found\n`);
        return 1;
      }
      needRoot();
      const user = inst === "system" ? sh.rootUser() : sh.currentUser();
      const path = configPath(sh, inst);
      const re = new RegExp(`\\n?\\[remote "${name.replaceAll(".", "\\.")}"\\][^\\[]*`);
      const content = sh.vfs.readFile(path, sh.rootUser()).replace(re, "\n");
      sh.vfs.writeFile(path, content, user);
      return 0;
    }
    case "remotes":
    case "remote-list": {
      const both = o.flags.has("U") || o.flags.has("S") ? [inst] : ["system", "user"];
      if (ctx.isTTY) ctx.out("Name    Options\n");
      for (const i of both) for (const r of remotes(sh, i)) ctx.out(`${r.padEnd(8)}${i}${r === "fedora" ? ",oci" : ""}\n`);
      return 0;
    }
    case "search": {
      const q = args.join(" ").toLowerCase();
      if (q === "") {
        ctx.err("error: TEXT must be specified\n");
        return 1;
      }
      const rs = [...new Set([...remotes(sh, "system"), ...remotes(sh, "user")])];
      const hits = flathub
        .filter((a) => (a.id + " " + a.name + " " + a.summary).toLowerCase().includes(q))
        .map((a) => ({ a, in: rs.filter((r) => remoteApps(r).includes(a)) }))
        .filter((h) => h.in.length !== 0);
      if (hits.length === 0) {
        ctx.out("No matches found\n");
        if (rs.length === 0) ctx.out(dim(sh, "universal.noRemotes"));
        return 0;
      }
      if (ctx.isTTY) ctx.out("Name                              Description                                          Application ID                 Version    Branch  Remotes\n");
      for (const h of hits) {
        ctx.out(`${h.a.name.padEnd(33)} ${h.a.summary.padEnd(52)} ${h.a.id.padEnd(30)} ${h.a.version.padEnd(10)} ${h.a.branch.padEnd(7)} ${h.in.join(",")}\n`);
      }
      return 0;
    }
    case "install": {
      if (args.length === 0) {
        ctx.err("error: At least one REF must be specified\n");
        return 1;
      }
      const rs = remotes(sh, inst);
      let remote: string | null = null;
      let refs = args;
      if (args.length > 1 && (rs.includes(args[0]!) || ["flathub", "fedora", "flathub-beta"].includes(args[0]!))) {
        remote = args[0]!;
        refs = args.slice(1);
      }
      ctx.out("Looking for matches…\n");
      if (remote !== null && !rs.includes(remote)) {
        ctx.err(`error: No remote refs found for ‘${remote}’\n`);
        if (inst === "user" && remotes(sh, "system").includes(remote)) {
          ctx.err(dim(sh, "universal.remoteSystemOnly", { remote }));
        } else {
          ctx.err(dim(sh, "universal.addRemoteFirst", { url: FlathubUrl }));
        }
        return 1;
      }
      const plan: { app: FlatpakApp; remote: string }[] = [];
      for (const r of refs) {
        const searchIn = remote !== null ? [remote] : rs;
        const query = r.replace(appPrefix, "").split("/")[0]!;
        const found = searchIn.map((rem) => ({ rem, app: matchApp(query, remoteApps(rem)) })).find((x) => x.app !== null);
        if (found === undefined || found.app === null) {
          ctx.err(`error: Nothing matches ${r} in ${remote !== null ? `remote ${remote}` : `${where} installation`}\n`);
          return 1;
        }
        const app = found.app;
        if (remote === null) ctx.out(`Found ref ‘app/${app.id}/x86_64/${app.branch}’ in remote ‘${found.rem}’ (${where}).\n`);
        if (installedRefs(sh).some((i) => i.inst === inst && i.id === app.id)) {
          ctx.out(`Skipping: ${app.id}/x86_64/${app.branch} is already installed\n`);
          continue;
        }
        plan.push({ app, remote: found.rem });
      }
      if (plan.length === 0) return 0;
      needRoot();
      const have = installedRefs(sh)
        .filter((i) => i.inst === inst && i.kind === "runtime")
        .map((i) => `${i.id}//${i.branch}`);
      const needed = [...new Set(plan.map((p) => p.app.runtime))].filter((r) => !have.includes(r));
      const rows: string[] = [];
      for (const rt of needed) {
        const r = runtimes.get(rt)!;
        rows.push(`${r.id}.Locale`.padEnd(43) + ` ${r.branch.padEnd(9)} i    ${plan[0]!.remote.padEnd(9)} < 18.5 kB`);
        rows.push(`${r.id}`.padEnd(43) + ` ${r.branch.padEnd(9)} i    ${plan[0]!.remote.padEnd(9)} < ${r.sizeMb} MB`);
      }
      for (const p of plan) rows.push(`${p.app.id}`.padEnd(43) + ` ${p.app.branch.padEnd(9)} i    ${p.remote.padEnd(9)} < ${p.app.sizeMb} MB`);
      for (const p of plan) {
        ctx.out(`\n${p.app.id} permissions:\n    ${p.app.permissions.join("    ")}\n`);
      }
      ctx.out(`\n        ${"ID".padEnd(43)} ${"Branch".padEnd(9)} Op   ${"Remote".padEnd(9)} Download\n`);
      for (let i = 0; i < rows.length; i++) ctx.out(` ${num2(i + 1)}. [ ] ${rows[i]}\n`);
      ctx.out("\n");
      return ReposCmd.askYesNo(
        ctx,
        `Proceed with these changes to the ${where} installation? [Y/n]: `,
        true,
        o.flags.has("y"),
        (io) => {
          for (const rt of needed) {
            const r = runtimes.get(rt)!;
            writeRef(sh, inst, "runtime", r.id, r.branch, `[Runtime]\nname=${r.id}\nbranch=${r.branch}\ntitle=${r.name}\n`, r.sizeMb);
          }
          for (const p of plan) {
            const runtime = replaceFirst(p.app.runtime, "//", "/x86_64/");
            const shared = p.app.permissions.filter((x) => !x.includes(":")).join(";");
            writeRef(
              sh,
              inst,
              "app",
              p.app.id,
              p.app.branch,
              `[Application]\nname=${p.app.id}\ntitle=${p.app.name}\nversion=${p.app.version}\nruntime=${runtime}\norigin=${p.remote}\n\n[Context]\nshared=${shared};\n`,
              p.app.sizeMb,
            );
          }
          for (let i = 0; i < rows.length; i++) io.out(` ${num2(i + 1)}. [✓] ${rows[i]}\n`);
          io.out("\nInstallation complete.\n");
          return 0;
        },
        (io) => {
          io.out("error: Aborted by user\n");
          return 1;
        },
      );
    }
    case "list": {
      let list = installedRefs(sh);
      if (o.flags.has("U")) list = list.filter((i) => i.inst === "user");
      if (o.flags.has("S")) list = list.filter((i) => i.inst === "system");
      if (o.flags.has("a")) list = list.filter((i) => i.kind === "app");
      if (o.flags.has("r")) list = list.filter((i) => i.kind === "runtime");
      if (ctx.isTTY && list.length !== 0) ctx.out(`${"Name".padEnd(40)} ${"Application ID".padEnd(30)} ${"Version".padEnd(10)} ${"Branch".padEnd(7)} Installation\n`);
      for (const i of list) {
        let title = metaValue(i.meta, "title");
        if (title === "") title = i.id;
        const version = metaValue(i.meta, "version");
        ctx.out(ctx.isTTY ? `${title.padEnd(40)} ${i.id.padEnd(30)} ${version.padEnd(10)} ${i.branch.padEnd(7)} ${i.inst}\n` : `${title}\t${i.id}\t${version}\t${i.branch}\t${i.inst}\n`);
      }
      return 0;
    }
    case "info": {
      const id = args.length > 0 ? args[0]! : null;
      const i = installedRefs(sh).find((x) => x.id === id || (id !== null && x.id.toLowerCase() === id.toLowerCase())) ?? null;
      if (!id || i === null) {
        ctx.err(`error: ${id ?? ""}/*unspecified*/*unspecified* not installed\n`);
        return 1;
      }
      if (o.flags.has("P")) {
        const parts = i.meta.split("[Context]");
        const context = parts.length > 1 ? parts[1]!.trim() : "";
        ctx.out(context !== "" ? `[Context]\n${context}\n` : "");
        return 0;
      }
      const title = metaValue(i.meta, "title");
      const version = metaValue(i.meta, "version");
      const origin = metaValue(i.meta, "origin");
      const runtime = metaValue(i.meta, "runtime");
      ctx.out(
        `\n${title !== "" ? title : i.id}\n\n          ID: ${i.id}\n         Ref: ${i.ref}\n        Arch: x86_64\n      Branch: ${i.branch}\n` +
          (version !== "" ? `     Version: ${version}\n` : "") +
          `      Origin: ${origin !== "" ? origin : "flathub"}\nInstallation: ${i.inst}\n` +
          (i.kind === "app" ? `     Runtime: ${runtime}\n     Sdk: ${replaceFirst(runtime, "Platform", "Sdk")}\n` : "") +
          "\n",
      );
      return 0;
    }
    case "run": {
      const id = args.length > 0 ? args[0]! : null;
      if (!id) {
        ctx.err("error: APP must be specified\n");
        return 1;
      }
      const i = installedRefs(sh).find((x) => x.kind === "app" && x.id === id) ?? null;
      if (i === null) {
        ctx.err(`error: app/${id}/x86_64/master not installed\n`);
        return 1;
      }
      const title = metaValue(i.meta, "title");
      ctx.out(windowNote(sh, title !== "" ? title : id));
      return 0;
    }
    case "update":
    case "upgrade": {
      ctx.out("Looking for updates…\n");
      // Everything in the simulator is already the latest version.
      ctx.out("Nothing to do.\n");
      return 0;
    }
    case "uninstall":
    case "remove": {
      const installed = installedRefs(sh).filter((i) => i.inst === inst);
      let targets: InstalledRef[];
      if (o.flags.has("u")) {
        const used = installed.filter((i) => i.kind === "app").map((i) => metaValue(i.meta, "runtime").split("/x86_64/"));
        targets = installed.filter((i) => i.kind === "runtime" && !used.some((u) => u[0] === i.id && u.length > 1 && u[1] === i.branch));
        if (targets.length === 0) {
          ctx.out("Nothing unused to uninstall\n");
          return 0;
        }
      } else {
        if (args.length === 0) {
          ctx.err("error: Must specify at least one REF, --unused, --all or --delete-data\n");
          return 1;
        }
        targets = [];
        for (const a of args) {
          const i = installed.find((x) => x.id === a);
          if (i === undefined) {
            ctx.err(`error: ${a}/*unspecified*/*unspecified* not installed\n`);
            return 1;
          }
          targets.push(i);
        }
      }
      needRoot();
      ctx.out(`\n        ${"ID".padEnd(43)} ${"Branch".padEnd(9)} Op\n`);
      for (let i = 0; i < targets.length; i++) ctx.out(` ${num2(i + 1)}. [-] ${targets[i]!.id.padEnd(43)} ${targets[i]!.branch.padEnd(9)} r\n`);
      ctx.out("\n");
      const chosen = targets;
      return ReposCmd.askYesNo(
        ctx,
        `Proceed with these changes to the ${where} installation? [Y/n]: `,
        true,
        o.flags.has("y"),
        (io) => {
          const user = inst === "system" ? sh.rootUser() : sh.currentUser();
          for (const t of chosen) {
            const dir = `${instBase(sh, inst)}/${t.kind}/${t.id}`;
            sh.vfs.remove(dir, user);
          }
          io.out("Uninstall complete.\n");
          if (!o.flags.has("u") && chosen.some((t) => t.kind === "app")) {
            io.out(dim(sh, "universal.unusedRuntimes"));
          }
          return 0;
        },
        (io) => {
          io.out("error: Aborted by user\n");
          return 1;
        },
      );
    }
  }
  ctx.err(`error: Unknown command '${cmd}'\n\nSee 'flatpak --help'\n`);
  return 1;
}

function replaceFirst(s: string, find: string, replacement: string): string {
  const i = s.indexOf(find);
  return i < 0 ? s : s.slice(0, i) + replacement + s.slice(i + find.length);
}
