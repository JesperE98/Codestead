// Port of Commands/Repos/ReposCmd.AddAptRepository.cs – the add-apt-repository command: adds a repository (e.g. a
// PPA) for apt.

import { parsePpa, ppaSourcesPath, PpaSuite, ppaUri } from "../../Extrarepo/ExtrarepoLib.js";
import type { Ppa } from "../../Extrarepo/Ppa.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { IO } from "../../Types/IO.js";
import type { Sink } from "../../Types/Sink.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { askYesNo, dim, isRoot, writeRootFile } from "./ReposCmd.js";
import { ppaKey, ppas } from "./ReposCmd.Ppa.js";

/** An IO for running another command from an answer to a question. */
export function asIO(io: Sink): IO {
  return new IO(io.outFn, io.errFn, null, true);
}

function ppaSources(p: Ppa): string {
  return (
    `Types: deb\nURIs: ${ppaUri(p)}\nSuites: ${PpaSuite}\nComponents: main\nSigned-By:\n` +
    " -----BEGIN PGP PUBLIC KEY BLOCK-----\n .\n mQINBGcx5aEBEADJq3s1mUlEf0lunatoolsimuleradnyckel4QkZb9TnW0c2Lm\n" +
    " =x7Qe\n -----END PGP PUBLIC KEY BLOCK-----\n"
  );
}

const urisRe = /^URIs:\s*(\S+)/m;
const suitesRe = /^Suites:\s*(.+)$/m;
const componentsRe = /^Components:\s*(.+)$/m;
const wsRe = /\s+/;
const componentRe = /^(main|restricted|universe|multiverse)$/;

const addAptUsage = "usage: add-apt-repository [-h] [-d] [-r] [-s] [-c COMPONENT] [-p POCKET] [-y] [-n] [-L] [line]";

export const addAptRepository: CommandDef = {
  name: "add-apt-repository",
  summary: "Lägger till ett förråd (t.ex. ett PPA) för apt",
  summaryEn: "Adds a repository (e.g. a PPA) for apt",
  man: `NAMN
       add-apt-repository - lägg till eller ta bort förråd för apt

SYNOPSIS
       add-apt-repository [-y] [-n] [-r] FÖRRÅD

BESKRIVNING
       Lägger till ett förråd, oftast ett PPA (Personal Package Archive)
       från Launchpad: ppa:användare/namn. En fil skapas i
       /etc/apt/sources.list.d/ och därefter körs "apt update" så att de
       nya paketen syns. Kommandot finns i paketet
       software-properties-common.

       PPA:er byggs för Ubuntu. I Debian kan de krocka med systemets egna
       bibliotek. Lägg bara till PPA:er från utvecklare du litar på – de
       kan ersätta vilket paket som helst på datorn.

FLAGGOR
       -y, --yes         fråga inte om bekräftelse
       -r, --remove      ta bort förrådet i stället
       -n, --no-update   kör inte "apt update" efteråt
       -L, --list        lista förråden som är tillagda

EXEMPEL
       sudo add-apt-repository ppa:lunatool/moonphase
       sudo add-apt-repository --remove ppa:lunatool/moonphase`,
  manEn: `NAME
       add-apt-repository - add or remove apt repositories

SYNOPSIS
       add-apt-repository [-y] [-n] [-r] REPOSITORY

DESCRIPTION
       Adds a repository, usually a PPA (Personal Package Archive) from
       Launchpad: ppa:user/name. A file is created in
       /etc/apt/sources.list.d/ and "apt update" is then run so that the
       new packages show up. The command is in the package
       software-properties-common.

       PPAs are built for Ubuntu. On Debian they may clash with the
       system's own libraries. Only add PPAs from developers you trust -
       they can replace any package on the computer.

OPTIONS
       -y, --yes         don't ask for confirmation
       -r, --remove      remove the repository instead
       -n, --no-update   don't run "apt update" afterwards
       -L, --list        list the repositories that have been added

EXAMPLES
       sudo add-apt-repository ppa:lunatool/moonphase
       sudo add-apt-repository --remove ppa:lunatool/moonphase`,
  run: runAddAptRepository,
};

function runAddAptRepository(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: "yrnhL",
    long: { yes: "y", remove: "r", "no-update": "n", help: "h", list: "L" },
  });
  if (o.error !== null) {
    ctx.err(`${addAptUsage}\nadd-apt-repository: error: ${o.error}\n`);
    return 2;
  }
  if (o.flags.has("h")) {
    ctx.out(`${addAptUsage}\n\nOnly ONE operation can be performed per invocation.\n`);
    return 0;
  }
  if (o.flags.has("L")) {
    const node = sh.vfs.tryLookup("/etc/apt/sources.list.d", sh.rootUser());
    for (const f of node?.children?.values() ?? []) {
      const c = f.content ?? "";
      const um = urisRe.exec(c);
      const uri = um ? um[1]! : null;
      const sm = suitesRe.exec(c);
      const suites = sm ? sm[1]!.split(wsRe) : [];
      const cm = componentsRe.exec(c);
      const comps = cm ? cm[1]! : "";
      for (const s of suites) if (uri) ctx.out(`deb ${uri} ${s} ${comps}\n`);
    }
    return 0;
  }
  const spec = o.operands.join(" ");
  if (spec === "") {
    ctx.err("Error: need a repository as argument\n");
    return 1;
  }
  if (!isRoot(sh)) {
    ctx.err("Error: must run as root\n");
    return 1;
  }
  if (componentRe.test(spec)) {
    if (sh.distro.id === "ubuntu") {
      ctx.out(`'${spec}' distribution component is already enabled for all sources.\n`);
      return 0;
    }
    ctx.out(`Adding component(s) '${spec}' to all repositories.\n`);
    ctx.out(dim(sh, "repos.ubuntuOnlyComponent", { component: spec }));
    return 0;
  }
  const ppa = parsePpa(spec);
  if (ppa === null) {
    ctx.err(`Error: '${spec}' invalid\n`);
    ctx.err(dim(sh, "repos.ppaFormat"));
    return 1;
  }
  const info = ppas.get(ppaKey(ppa)) ?? null;
  const path = ppaSourcesPath(ppa);
  const removing = o.flags.has("r");
  if (info === null && !removing) {
    ctx.err(`ERROR: ppa '${ppaKey(ppa)}' not found (use --login if private)\n`);
    return 1;
  }
  if (removing && sh.vfs.tryLookup(path, sh.rootUser()) === null) {
    ctx.err(`Error: repository '${spec}' is not present\n`);
    return 1;
  }
  ctx.out(`Repository: 'Types: deb\nURIs: ${ppaUri(ppa)}\nSuites: ${PpaSuite}\nComponents: main\n'\n`);
  if (info !== null) ctx.out(`Description:\n${info.description}\nMore info: https://launchpad.net/~${ppa.user}/+archive/ubuntu/${ppa.name}\n`);
  ctx.out(removing ? "Removing repository.\n" : "Adding repository.\n");
  if (!removing && sh.distro.id !== "ubuntu") {
    ctx.out(dim(sh, "repos.ppaWarning", { suite: PpaSuite, distro: sh.distro.name }));
  }
  const apply = (io: Sink): number => {
    if (removing) sh.vfs.remove(path, sh.rootUser());
    else writeRootFile(sh, path, ppaSources(ppa));
    if (o.flags.has("n")) return 0;
    return sh.invoke(["apt", "update"], asIO(io));
  };
  return askYesNo(ctx, "Press [ENTER] to continue or Ctrl-c to cancel.", true, o.flags.has("y"), apply, (io) => {
    io.out("Aborted.\n");
    return 1;
  });
}
