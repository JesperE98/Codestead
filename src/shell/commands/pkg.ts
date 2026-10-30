// Simulerade pakethanterare: apt (Debian/Ubuntu), pacman (Arch) och dnf (Fedora/RHEL).
// Utskrifterna efterliknar de riktiga programmen, men är förenklade.

import {
  availableVersion,
  findPackage,
  formatKb,
  formatMiB,
  installPackage,
  isInstalled,
  PACKAGES,
  removePackage,
  searchPackages,
  upgradable,
  type PackageDef,
} from '../packages';
import type { CmdCtx, CommandDef, Sink } from '../types';
import { COLOR } from './util';

const isRoot = (ctx: CmdCtx) => ctx.sh.currentUser().uid === 0;
const pkgName = (ctx: CmdCtx, p: PackageDef) => p.names[ctx.sh.distro.family]!;
const familyPackages = (ctx: CmdCtx) => PACKAGES.filter((p) => p.names[ctx.sh.distro.family]);

/**
 * Frågar "fortsätt? [Y/n]" om inte -y/--noconfirm angetts.
 * Om indata kommer från en pipe (t.ex. `yes | apt ...`) läses svaret därifrån.
 */
function confirm(
  ctx: CmdCtx,
  question: string,
  defaultYes: boolean,
  assumeYes: boolean,
  onYes: (io: Sink) => number,
  onNo: (io: Sink) => number,
): number {
  if (assumeYes) return onYes(ctx);
  if (ctx.stdin !== null) {
    const answer = ctx.stdin.split('\n')[0].trim();
    ctx.out(question + answer + '\n');
    const yes = answer === '' ? defaultYes : /^(y|yes|j|ja)$/i.test(answer);
    return yes ? onYes(ctx) : onNo(ctx);
  }
  ctx.sh.ask(question, defaultYes, (yes, io) => (yes ? onYes(io) : onNo(io)));
  return 0;
}

// ---------------------------------------------------------------- apt

const APT_READING = 'Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n';

function aptMirror(ctx: CmdCtx): string {
  const d = ctx.sh.distro;
  const base = d.mirrors[0]?.split(' ')[0] ?? 'http://deb.debian.org/debian';
  return `${base} ${d.codename}/main amd64`;
}

function aptUpdate(ctx: CmdCtx): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) {
    ctx.out('Reading package lists... Done\n');
    ctx.err('E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/\n');
    return 100;
  }
  const already = sh.flags.repoSynced;
  sh.distro.mirrors.forEach((m, i) => {
    if (already || i === 0) ctx.out(`Hit:${i + 1} ${m}\n`);
    else ctx.out(`Get:${i + 1} ${m} [${(118.6 + i * 7.3).toFixed(1)} kB]\n`);
  });
  if (!already) ctx.out(`Fetched 1,284 kB in 1s (1,107 kB/s)\n`);
  sh.flags.repoSynced = true;
  ctx.out(APT_READING);
  const n = upgradable(sh).length;
  ctx.out(n ? `${n} packages can be upgraded. Run 'apt list --upgradable' to see them.\n` : 'All packages are up to date.\n');
  return 0;
}

function aptLockError(ctx: CmdCtx): number {
  ctx.err(
    'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n' +
      'E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n',
  );
  return 100;
}

function aptInstall(ctx: CmdCtx, names: string[]): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) return aptLockError(ctx);
  ctx.out(APT_READING);
  const toInstall: PackageDef[] = [];
  for (const n of names) {
    const p = findPackage(sh.distro.family, n);
    // Utan "apt update" är paketlistorna tomma och apt hittar ingenting.
    if (!p || (!sh.flags.repoSynced && !isInstalled(sh, p))) {
      ctx.err(`E: Unable to locate package ${n}\n`);
      if (!sh.flags.repoSynced) {
        ctx.err(`${COLOR.dim}${ctx.sh.msg({ sv: "Tips från simulatorn: paketlistorna är tomma. Kör 'sudo apt update' först.", en: "Tip from the simulator: the package lists are empty. Run 'sudo apt update' first." })}${COLOR.reset}\n`);
      }
      return 100;
    }
    if (isInstalled(sh, p) && sh.installed[p.id] === availableVersion(sh, p)) {
      ctx.out(`${n} is already the newest version (${sh.installed[p.id]}).\n`);
    } else if (!toInstall.includes(p)) {
      toInstall.push(p);
    }
  }
  const notUpgraded = upgradable(sh).length;
  if (!toInstall.length) {
    ctx.out(`0 upgraded, 0 newly installed, 0 to remove and ${notUpgraded} not upgraded.\n`);
    return 0;
  }
  const size = toInstall.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(`The following NEW packages will be installed:\n  ${toInstall.map((p) => pkgName(ctx, p)).join(' ')}\n`);
  ctx.out(
    `0 upgraded, ${toInstall.length} newly installed, 0 to remove and ${notUpgraded} not upgraded.\n` +
      `Need to get ${formatKb(Math.round(size * 0.4))} of archives.\n` +
      `After this operation, ${formatKb(size)} of additional disk space will be used.\n`,
  );
  toInstall.forEach((p, i) => {
    ctx.out(`Get:${i + 1} ${aptMirror(ctx)} ${pkgName(ctx, p)} amd64 ${availableVersion(sh, p)} [${formatKb(Math.round(p.sizeKb * 0.4))}]\n`);
  });
  ctx.out(`Fetched ${formatKb(Math.round(size * 0.4))} in 0s (2,511 kB/s)\n`);
  for (const p of toInstall) {
    const n = pkgName(ctx, p);
    const v = availableVersion(sh, p);
    ctx.out(
      `Selecting previously unselected package ${n}.\n(Reading database ... 74213 files and directories currently installed.)\n` +
        `Preparing to unpack .../${n}_${v}_amd64.deb ...\nUnpacking ${n} (${v}) ...\n`,
    );
  }
  for (const p of toInstall) {
    ctx.out(`Setting up ${pkgName(ctx, p)} (${availableVersion(sh, p)}) ...\n`);
    installPackage(sh, p);
  }
  ctx.out('Processing triggers for man-db (2.12.0-4build2) ...\n');
  return 0;
}

function aptRemove(ctx: CmdCtx, names: string[], assumeYes: boolean): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) return aptLockError(ctx);
  ctx.out(APT_READING);
  const toRemove: PackageDef[] = [];
  for (const n of names) {
    const p = findPackage(sh.distro.family, n);
    if (!p) {
      ctx.err(`E: Unable to locate package ${n}\n`);
      return 100;
    }
    if (!isInstalled(sh, p)) {
      ctx.out(`Package '${n}' is not installed, so not removed\n`);
      continue;
    }
    if (p.essential) {
      ctx.err(`E: Removing essential system-critical packages is not permitted. This might break the system.\n`);
      ctx.err(`${COLOR.dim}(${ctx.sh.msg({ sv: `${n} är ett systemkritiskt paket – utan det slutar systemet fungera.`, en: `${n} is an essential package – without it the system stops working.` })})${COLOR.reset}\n`);
      return 100;
    }
    toRemove.push(p);
  }
  const notUpgraded = upgradable(sh).length;
  if (!toRemove.length) {
    ctx.out(`0 upgraded, 0 newly installed, 0 to remove and ${notUpgraded} not upgraded.\n`);
    return 0;
  }
  const size = toRemove.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(
    `The following packages will be REMOVED:\n  ${toRemove.map((p) => pkgName(ctx, p)).join(' ')}\n` +
      `0 upgraded, 0 newly installed, ${toRemove.length} to remove and ${notUpgraded} not upgraded.\n` +
      `After this operation, ${formatKb(size)} disk space will be freed.\n`,
  );
  return confirm(
    ctx,
    'Do you want to continue? [Y/n] ',
    true,
    assumeYes,
    (io) => {
      io.out('(Reading database ... 74213 files and directories currently installed.)\n');
      for (const p of toRemove) {
        io.out(`Removing ${pkgName(ctx, p)} (${sh.installed[p.id]}) ...\n`);
        removePackage(sh, p);
      }
      io.out('Processing triggers for man-db (2.12.0-4build2) ...\n');
      return 0;
    },
    (io) => {
      io.out('Abort.\n');
      return 1;
    },
  );
}

function aptUpgrade(ctx: CmdCtx, assumeYes: boolean): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) return aptLockError(ctx);
  ctx.out(APT_READING + 'Calculating upgrade... Done\n');
  const ups = upgradable(sh);
  if (!ups.length) {
    ctx.out('0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n');
    if (sh.flags.repoSynced) sh.flags.upgraded = true;
    else ctx.out(`${COLOR.dim}${ctx.sh.msg({ sv: "Tips från simulatorn: apt vet inte om några nya versioner förrän du kört 'sudo apt update'.", en: "Tip from the simulator: apt doesn't know about any new versions until you have run 'sudo apt update'." })}${COLOR.reset}\n`);
    return 0;
  }
  const size = ups.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(
    `The following packages will be upgraded:\n  ${ups.map((p) => pkgName(ctx, p)).join(' ')}\n` +
      `${ups.length} upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n` +
      `Need to get ${formatKb(Math.round(size * 0.4))} of archives.\n` +
      `After this operation, 12.3 kB of additional disk space will be used.\n`,
  );
  return confirm(
    ctx,
    'Do you want to continue? [Y/n] ',
    true,
    assumeYes,
    (io) => {
      ups.forEach((p, i) => io.out(`Get:${i + 1} ${aptMirror(ctx)} ${pkgName(ctx, p)} amd64 ${availableVersion(sh, p)}\n`));
      for (const p of ups) {
        io.out(`Preparing to unpack .../${pkgName(ctx, p)}_${availableVersion(sh, p)}_amd64.deb ...\n`);
        io.out(`Unpacking ${pkgName(ctx, p)} (${availableVersion(sh, p)}) over (${sh.installed[p.id]}) ...\n`);
      }
      for (const p of ups) {
        io.out(`Setting up ${pkgName(ctx, p)} (${availableVersion(sh, p)}) ...\n`);
        installPackage(sh, p);
      }
      sh.flags.upgraded = true;
      return 0;
    },
    (io) => {
      io.out('Abort.\n');
      return 1;
    },
  );
}

function makeApt(name: 'apt' | 'apt-get'): CommandDef {
  return {
    name,
    summary: name === 'apt' ? 'Pakethanteraren i Debian och Ubuntu' : 'Äldre, skriptvänlig variant av apt',
    man: `NAMN
       ${name} - pakethanterare för Debian, Ubuntu och liknande

SYNOPSIS
       ${name} [-y] KOMMANDO [PAKET]...

KOMMANDON
       update          hämta nya paketlistor från förråden (repositories)
       upgrade         uppgradera alla installerade paket
       install PAKET   installera paket
       remove PAKET    ta bort paket (inställningsfiler blir kvar)
       purge PAKET     ta bort paket och dess inställningsfiler
       autoremove      ta bort beroenden som inte längre behövs${name === 'apt' ? `
       search ORD      sök efter paket
       show PAKET      visa information om ett paket
       list --installed   lista installerade paket
       list --upgradable  lista paket som kan uppgraderas` : ''}

FLAGGOR
       -y, --yes       svara ja på alla frågor

BESKRIVNING
       De flesta kommandon kräver root, så de körs med sudo:
           sudo apt update && sudo apt upgrade`,
    run(ctx) {
      const sh = ctx.sh;
      const yesFlags = ['-y', '--yes', '--assume-yes'];
      const assumeYes = ctx.args.some((a) => yesFlags.includes(a));
      const args = ctx.args.filter((a) => !yesFlags.includes(a) && a !== '-q');
      const [sub, ...rest] = args;
      const pkgs = rest.filter((a) => !a.startsWith('-'));
      switch (sub) {
        case undefined:
        case '-h':
        case '--help':
          ctx.out(
            `${name} 2.8.3 (amd64)\nUsage: ${name} [options] command\n\nMost used commands:\n` +
              `  list - list packages based on package names\n  search - search in package descriptions\n` +
              `  show - show package details\n  install - install packages\n  remove - remove packages\n` +
              `  autoremove - automatically remove all unused packages\n  update - update list of available packages\n` +
              `  upgrade - upgrade the system by installing/upgrading packages\n`,
          );
          return sub ? 0 : 1;
        case 'update':
          return aptUpdate(ctx);
        case 'install':
          if (!pkgs.length) {
            if (!isRoot(ctx)) return aptLockError(ctx);
            ctx.out(APT_READING + `0 upgraded, 0 newly installed, 0 to remove and ${upgradable(sh).length} not upgraded.\n`);
            return 0;
          }
          return aptInstall(ctx, pkgs);
        case 'remove':
        case 'purge':
          return aptRemove(ctx, pkgs, assumeYes);
        case 'upgrade':
        case 'full-upgrade':
        case 'dist-upgrade':
          return aptUpgrade(ctx, assumeYes);
        case 'autoremove':
          if (!isRoot(ctx)) return aptLockError(ctx);
          ctx.out(APT_READING + `0 upgraded, 0 newly installed, 0 to remove and ${upgradable(sh).length} not upgraded.\n`);
          return 0;
        case 'search': {
          if (name === 'apt-get') break;
          if (!pkgs.length) {
            ctx.err('E: You must give at least one search pattern\n');
            return 100;
          }
          ctx.out('Sorting... Done\nFull Text Search... Done\n');
          const results = searchPackages(sh.distro.family, pkgs.join(' '));
          for (const p of results) {
            const n = ctx.isTTY ? `${COLOR.green}${pkgName(ctx, p)}${COLOR.reset}` : pkgName(ctx, p);
            ctx.out(`${n}/${sh.distro.codename} ${availableVersion(sh, p)} amd64${isInstalled(sh, p) ? ' [installed]' : ''}\n  ${p.description}\n\n`);
          }
          return 0;
        }
        case 'show': {
          if (name === 'apt-get') break;
          let code = 0;
          for (const n of pkgs) {
            const p = findPackage(sh.distro.family, n);
            if (!p) {
              ctx.err(`N: Unable to locate package ${n}\nE: No packages found\n`);
              code = 100;
              continue;
            }
            ctx.out(
              `Package: ${n}\nVersion: ${availableVersion(sh, p)}\nPriority: ${p.essential ? 'required' : 'optional'}\n` +
                `Section: utils\nInstalled-Size: ${formatKb(p.sizeKb)}\n` +
                `APT-Manual-Installed: ${isInstalled(sh, p) ? 'yes' : 'no'}\nDescription: ${p.description}\n\n`,
            );
          }
          return code;
        }
        case 'list': {
          if (name === 'apt-get') break;
          ctx.out('Listing... Done\n');
          const cn = sh.distro.codename;
          if (rest.includes('--upgradable')) {
            for (const p of upgradable(sh)) {
              ctx.out(`${pkgName(ctx, p)}/${cn}-updates ${availableVersion(sh, p)} amd64 [upgradable from: ${sh.installed[p.id]}]\n`);
            }
            return 0;
          }
          const onlyInstalled = rest.includes('--installed');
          for (const p of familyPackages(ctx).sort((a, b) => pkgName(ctx, a).localeCompare(pkgName(ctx, b)))) {
            if (onlyInstalled && !isInstalled(sh, p)) continue;
            const v = isInstalled(sh, p) ? sh.installed[p.id] : availableVersion(sh, p);
            ctx.out(`${pkgName(ctx, p)}/${cn},now ${v} amd64${isInstalled(sh, p) ? ' [installed]' : ''}\n`);
          }
          return 0;
        }
      }
      ctx.err(`E: Invalid operation ${sub}\n`);
      return 100;
    },
  };
}

// ---------------------------------------------------------------- pacman

const bar = (label: string) => `${label.padEnd(48)} [${'#'.repeat(22)}] 100%\n`;

function pacman(): CommandDef {
  return {
    name: 'pacman',
    summary: 'Pakethanteraren i Arch Linux',
    man: `NAMN
       pacman - pakethanterare för Arch Linux och liknande

SYNOPSIS
       pacman ÅTGÄRD [FLAGGOR] [PAKET]...

ÅTGÄRDER (stor bokstav)
       -S    synkronisera: installera paket från förråden
       -R    ta bort paket
       -Q    fråga databasen över installerade paket

VANLIGA KOMBINATIONER
       pacman -Syu          uppdatera paketdatabasen och uppgradera allt
       pacman -S PAKET      installera ett paket
       pacman -Ss ORD       sök efter paket
       pacman -Si PAKET     visa information om ett paket
       pacman -R PAKET      ta bort ett paket
       pacman -Rs PAKET     ta bort paket och beroenden som inte behövs
       pacman -Q            lista installerade paket
       pacman -Qi PAKET     information om ett installerat paket

FLAGGOR
       --noconfirm   fråga inte om bekräftelse
       --needed      installera inte om paket som redan är aktuella

BESKRIVNING
       Arch är en "rolling release": paketen uppdateras hela tiden. Kör
       alltid -Syu i stället för bara -Sy, annars riskerar du att få en
       halvuppgraderad (partial upgrade) och trasig installation.`,
    run(ctx) {
      const sh = ctx.sh;
      const fam = sh.distro.family;
      const noconfirm = ctx.args.includes('--noconfirm');
      const needed = ctx.args.includes('--needed');
      let letters = '';
      const targets: string[] = [];
      for (const a of ctx.args) {
        if (a === '--noconfirm' || a === '--needed') continue;
        if (a === '--help') letters += 'h';
        else if (a === '--version') letters += 'V';
        else if (a.startsWith('--')) {
          ctx.err(`pacman: unrecognized option '${a}'\n`);
          return 1;
        } else if (a.startsWith('-')) letters += a.slice(1);
        else targets.push(a);
      }
      if (letters.includes('V')) {
        ctx.out(`\n .--.                  Pacman v7.0.0 - libalpm v15.0.0\n/ _.-' .-.  .-.  .-.   Copyright (C) 2006-2024 Pacman Development Team\n\\  '-. '-'  '-'  '-'\n '--'\n\n`);
        return 0;
      }
      const op = [...letters].find((c) => c >= 'A' && c <= 'Z');
      if (letters.includes('h') && !op) {
        ctx.out('usage:  pacman <operation> [...]\noperations:\n    pacman {-h --help}\n    pacman {-V --version}\n    pacman {-Q --query}   [options] [package(s)]\n    pacman {-R --remove}  [options] <package(s)>\n    pacman {-S --sync}    [options] [package(s)]\n');
        return 0;
      }
      if (!op) {
        ctx.err('error: no operation specified (use -h for help)\n');
        return 1;
      }
      const mods = letters.replace(op, '');
      const rootError = () => {
        ctx.err('error: you cannot perform this operation unless you are root.\n');
        return 1;
      };
      const repo = (p: PackageDef) => p.archRepo ?? 'extra';
      const full = (p: PackageDef) => `${pkgName(ctx, p)}-${availableVersion(sh, p)}`;

      if (op === 'Q') {
        let list = familyPackages(ctx).filter((p) => isInstalled(sh, p));
        if (mods.includes('s')) {
          const q = targets.join(' ');
          list = searchPackages(fam, q).filter((p) => isInstalled(sh, p));
          for (const p of list) ctx.out(`local/${pkgName(ctx, p)} ${sh.installed[p.id]}\n    ${p.description}\n`);
          return list.length ? 0 : 1;
        }
        if (targets.length) {
          const picked: PackageDef[] = [];
          for (const t of targets) {
            const p = findPackage(fam, t);
            if (!p || !isInstalled(sh, p)) {
              ctx.err(`error: package '${t}' was not found\n`);
              return 1;
            }
            picked.push(p);
          }
          list = picked;
        }
        list.sort((a, b) => pkgName(ctx, a).localeCompare(pkgName(ctx, b)));
        for (const p of list) {
          if (mods.includes('i')) {
            ctx.out(
              `Name            : ${pkgName(ctx, p)}\nVersion         : ${sh.installed[p.id]}\nDescription     : ${p.description}\n` +
                `Architecture    : x86_64\nInstalled Size  : ${formatMiB(p.sizeKb)}\nInstall Reason  : ${p.base ? 'Installed as a dependency for another package' : 'Explicitly installed'}\n\n`,
            );
          } else {
            ctx.out(`${pkgName(ctx, p)} ${sh.installed[p.id]}\n`);
          }
        }
        return 0;
      }

      if (op === 'S') {
        if (mods.includes('s')) {
          const results = searchPackages(fam, targets.join(' '));
          for (const p of results) {
            ctx.out(`${repo(p)}/${pkgName(ctx, p)} ${availableVersion(sh, p)}${isInstalled(sh, p) ? ' [installed]' : ''}\n    ${p.description}\n`);
          }
          return results.length ? 0 : 1;
        }
        if (mods.includes('i')) {
          for (const t of targets) {
            const p = findPackage(fam, t);
            if (!p) {
              ctx.err(`error: package '${t}' was not found\n`);
              return 1;
            }
            ctx.out(
              `Repository      : ${repo(p)}\nName            : ${pkgName(ctx, p)}\nVersion         : ${availableVersion(sh, p)}\n` +
                `Description     : ${p.description}\nArchitecture    : x86_64\nDownload Size   : ${formatMiB(p.sizeKb * 0.4)}\n` +
                `Installed Size  : ${formatMiB(p.sizeKb)}\n\n`,
            );
          }
          return 0;
        }
        if (!isRoot(ctx)) return rootError();
        if (mods.includes('y')) {
          ctx.out(':: Synchronizing package databases...\n');
          for (const r of ['core', 'extra']) ctx.out(sh.flags.repoSynced && !mods.includes('yy') ? ` ${r} is up to date\n` : ` ${r} downloading...\n`);
          sh.flags.repoSynced = true;
        }
        const upgrade = mods.includes('u');
        const list: PackageDef[] = [];
        if (upgrade) {
          ctx.out(':: Starting full system upgrade...\n');
          list.push(...upgradable(sh));
        }
        for (const t of targets) {
          const p = findPackage(fam, t);
          if (!p) {
            ctx.err(`error: target not found: ${t}\n`);
            return 1;
          }
          if (isInstalled(sh, p) && sh.installed[p.id] === availableVersion(sh, p)) {
            if (needed) {
              ctx.err(`warning: ${full(p)} is up to date -- skipping\n`);
              continue;
            }
            ctx.err(`warning: ${full(p)} is up to date -- reinstalling\n`);
          }
          if (!list.includes(p)) list.push(p);
        }
        if (!list.length) {
          if (upgrade) {
            ctx.out(' there is nothing to do\n');
            if (sh.flags.repoSynced) sh.flags.upgraded = true;
            return 0;
          }
          if (mods.includes('y')) return 0;
          if (targets.length) {
            ctx.out(' there is nothing to do\n');
            return 0;
          }
          ctx.err('error: no targets specified (use -h for help)\n');
          return 1;
        }
        const size = list.reduce((s, p) => s + p.sizeKb, 0);
        ctx.out(
          `resolving dependencies...\nlooking for conflicting packages...\n\nPackages (${list.length}) ${list.map(full).join('  ')}\n\n` +
            `Total Download Size:   ${formatMiB(size * 0.4)}\nTotal Installed Size:  ${formatMiB(size)}\n\n`,
        );
        return confirm(
          ctx,
          ':: Proceed with installation? [Y/n] ',
          true,
          noconfirm,
          (io) => {
            const n = list.length;
            io.out(':: Retrieving packages...\n');
            list.forEach((p) => io.out(` ${full(p)}-x86_64 downloading...\n`));
            for (const step of ['checking keys in keyring', 'checking package integrity', 'loading package files', 'checking for file conflicts']) {
              io.out(bar(`(${n}/${n}) ${step}`));
            }
            io.out(':: Processing package changes...\n');
            list.forEach((p, i) => {
              io.out(bar(`(${i + 1}/${n}) ${isInstalled(sh, p) ? 'upgrading' : 'installing'} ${pkgName(ctx, p)}`));
              installPackage(sh, p);
            });
            io.out(':: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n');
            if (upgrade && sh.flags.repoSynced) sh.flags.upgraded = true;
            return 0;
          },
          () => 1,
        );
      }

      if (op === 'R') {
        if (!targets.length) {
          ctx.err('error: no targets specified (use -h for help)\n');
          return 1;
        }
        if (!isRoot(ctx)) return rootError();
        const list: PackageDef[] = [];
        for (const t of targets) {
          const p = findPackage(fam, t);
          if (!p || !isInstalled(sh, p)) {
            ctx.err(`error: target not found: ${t}\n`);
            return 1;
          }
          if (p.essential) {
            ctx.err(`checking dependencies...\nerror: failed to prepare transaction (could not satisfy dependencies)\n:: removing ${t} breaks dependency '${t}' required by base\n`);
            return 1;
          }
          list.push(p);
        }
        const size = list.reduce((s, p) => s + p.sizeKb, 0);
        ctx.out(`checking dependencies...\n\nPackages (${list.length}) ${list.map((p) => `${pkgName(ctx, p)}-${sh.installed[p.id]}`).join('  ')}\n\nTotal Removed Size:  ${formatMiB(size)}\n\n`);
        return confirm(
          ctx,
          ':: Do you want to remove these packages? [Y/n] ',
          true,
          noconfirm,
          (io) => {
            io.out(':: Processing package changes...\n');
            list.forEach((p, i) => {
              io.out(bar(`(${i + 1}/${list.length}) removing ${pkgName(ctx, p)}`));
              removePackage(sh, p);
            });
            return 0;
          },
          () => 1,
        );
      }

      ctx.err(`error: invalid option '-${op}'\n`);
      return 1;
    },
  };
}

// ---------------------------------------------------------------- dnf

function dnf(name: 'dnf' | 'dnf5'): CommandDef {
  return {
    name,
    summary: 'Pakethanteraren i Fedora och Red Hat',
    man: `NAMN
       dnf - pakethanterare för Fedora, RHEL, Rocky Linux och liknande

SYNOPSIS
       dnf [-y] KOMMANDO [PAKET]...

KOMMANDON
       install PAKET     installera paket
       remove PAKET      ta bort paket
       upgrade           uppgradera alla paket
       check-update      visa vilka paket som kan uppgraderas
       makecache         hämta ny metadata från förråden
       search ORD        sök efter paket
       info PAKET        visa information om ett paket
       list --installed  lista installerade paket
       repolist          visa aktiverade förråd (repositories)

FLAGGOR
       -y, --assumeyes   svara ja på alla frågor

BESKRIVNING
       dnf uppdaterar metadata automatiskt när den är gammal, så det
       finns inget separat "update"-steg som i apt. Observera att frågan
       "Is this ok [y/N]" har Nej som standard – tryck y och Enter.`,
    run(ctx) {
      const sh = ctx.sh;
      const fam = sh.distro.family;
      const yesFlags = ['-y', '--assumeyes'];
      const assumeYes = ctx.args.some((a) => yesFlags.includes(a));
      const args = ctx.args.filter((a) => !yesFlags.includes(a));
      const [sub, ...rest] = args;
      const targets = rest.filter((a) => !a.startsWith('-'));
      const ver = (p: PackageDef) => availableVersion(sh, p);
      const rootError = () => {
        ctx.err('This command has to be run with superuser privileges (under the root user on most systems).\n');
        return 1;
      };
      const loadRepos = () => {
        if (!sh.flags.repoSynced) {
          ctx.out(
            `Updating and loading repositories:\n Fedora ${sh.distro.version} - x86_64 - Updates   100% |   2.1 MiB/s |   5.3 MiB |  00m03s\n` +
              ` Fedora ${sh.distro.version} - x86_64             100% |   9.8 MiB/s |  35.6 MiB |  00m04s\nRepositories loaded.\n`,
          );
          sh.flags.repoSynced = true;
        } else {
          ctx.out('Updating and loading repositories:\nRepositories loaded.\n');
        }
      };
      const header = 'Package                      Arch    Version                    Repository       Size\n';
      const row = (p: PackageDef, v: string, repo: string) =>
        ` ${pkgName(ctx, p).padEnd(28)} x86_64  ${v.padEnd(26)} ${repo.padEnd(10)} ${formatMiB(p.sizeKb).padStart(10)}\n`;

      switch (sub) {
        case undefined:
        case '--help':
        case 'help':
          ctx.out(`Usage:\n  dnf5 [GLOBAL OPTIONS] <COMMAND> ...\n\nSoftware Management Commands:\n  install    Install software\n  upgrade    Upgrade software\n  remove     Remove (uninstall) software\n  search     Search for software\n  info       Provide detailed information about installed or available packages\n  list       List installed or available packages\n  check-upgrade  Check for available package upgrades\n  makecache  Generate the metadata cache\n  repolist   List repositories\n`);
          return sub ? 0 : 2;
        case 'install':
        case 'in': {
          if (!isRoot(ctx)) return rootError();
          loadRepos();
          const list: PackageDef[] = [];
          for (const t of targets) {
            const p = findPackage(fam, t);
            if (!p) {
              ctx.err(`Failed to resolve the transaction:\nNo match for argument: ${t}\nYou can try to add to command line:\n  --skip-unavailable to skip unavailable packages\n`);
              return 1;
            }
            if (isInstalled(sh, p) && sh.installed[p.id] === ver(p)) ctx.out(`Package "${t}-${ver(p)}.x86_64" is already installed.\n`);
            else if (!list.includes(p)) list.push(p);
          }
          if (!list.length) {
            ctx.out('\nNothing to do.\n');
            return 0;
          }
          const size = list.reduce((s, p) => s + p.sizeKb, 0);
          ctx.out(header + 'Installing:\n' + list.map((p) => row(p, ver(p), 'fedora')).join(''));
          ctx.out(
            `\nTransaction Summary:\n Installing:        ${list.length} package${list.length > 1 ? 's' : ''}\n\n` +
              `Total size of inbound packages is ${formatMiB(size * 0.4)}. Need to download ${formatMiB(size * 0.4)}.\n` +
              `After this operation, ${formatMiB(size)} extra will be used (install ${formatMiB(size)}, remove 0 B).\n`,
          );
          return confirm(
            ctx,
            'Is this ok [y/N]: ',
            false,
            assumeYes,
            (io) => {
              list.forEach((p, i) => io.out(`[${i + 1}/${list.length}] ${pkgName(ctx, p)}-0:${ver(p)}.x86_64          100% |   1.8 MiB/s | ${formatMiB(p.sizeKb * 0.4)} |  00m00s\n`));
              io.out(`Running transaction\n[1/${list.length + 2}] Verify package files            100%\n[2/${list.length + 2}] Prepare transaction             100%\n`);
              list.forEach((p, i) => {
                io.out(`[${i + 3}/${list.length + 2}] Installing ${pkgName(ctx, p)}-0:${ver(p)}.x86_64   100%\n`);
                installPackage(sh, p);
              });
              io.out('Complete!\n');
              return 0;
            },
            (io) => {
              io.out('Operation aborted by the user.\n');
              return 1;
            },
          );
        }
        case 'remove':
        case 'rm':
        case 'erase': {
          if (!isRoot(ctx)) return rootError();
          const list: PackageDef[] = [];
          for (const t of targets) {
            const p = findPackage(fam, t);
            if (!p || !isInstalled(sh, p)) {
              ctx.out(`No packages to remove for argument: ${t}\n`);
              continue;
            }
            if (p.essential) {
              ctx.err(`Failed to resolve the transaction:\nProblem: The operation would result in removing the following protected packages: ${t}\n`);
              return 1;
            }
            list.push(p);
          }
          if (!list.length) {
            ctx.out('\nNothing to do.\n');
            return 0;
          }
          ctx.out(header + 'Removing:\n' + list.map((p) => row(p, sh.installed[p.id], '@System')).join(''));
          ctx.out(`\nTransaction Summary:\n Removing:          ${list.length} package${list.length > 1 ? 's' : ''}\n\nAfter this operation, ${formatMiB(list.reduce((s, p) => s + p.sizeKb, 0))} will be freed.\n`);
          return confirm(
            ctx,
            'Is this ok [y/N]: ',
            false,
            assumeYes,
            (io) => {
              io.out(`Running transaction\n[1/${list.length + 1}] Prepare transaction             100%\n`);
              list.forEach((p, i) => {
                io.out(`[${i + 2}/${list.length + 1}] Removing ${pkgName(ctx, p)}-0:${sh.installed[p.id]}.x86_64   100%\n`);
                removePackage(sh, p);
              });
              io.out('Complete!\n');
              return 0;
            },
            (io) => {
              io.out('Operation aborted by the user.\n');
              return 1;
            },
          );
        }
        case 'upgrade':
        case 'update': {
          if (!isRoot(ctx)) return rootError();
          loadRepos();
          const ups = upgradable(sh);
          if (!ups.length) {
            ctx.out('Nothing to do.\n');
            sh.flags.upgraded = true;
            return 0;
          }
          ctx.out(header + 'Upgrading:\n' + ups.map((p) => row(p, ver(p), 'updates') + `   replacing ${pkgName(ctx, p).padEnd(18)} x86_64  ${sh.installed[p.id]}\n`).join(''));
          ctx.out(`\nTransaction Summary:\n Upgrading:         ${ups.length} packages\n Replacing:         ${ups.length} packages\n`);
          return confirm(
            ctx,
            'Is this ok [y/N]: ',
            false,
            assumeYes,
            (io) => {
              io.out('Running transaction\n');
              ups.forEach((p, i) => {
                io.out(`[${i + 1}/${ups.length}] Upgrading ${pkgName(ctx, p)}-0:${ver(p)}.x86_64   100%\n`);
                installPackage(sh, p);
              });
              sh.flags.upgraded = true;
              io.out('Complete!\n');
              return 0;
            },
            (io) => {
              io.out('Operation aborted by the user.\n');
              return 1;
            },
          );
        }
        case 'check-update':
        case 'check-upgrade': {
          loadRepos();
          const ups = upgradable(sh);
          for (const p of ups) ctx.out(`${(pkgName(ctx, p) + '.x86_64').padEnd(30)} ${ver(p).padEnd(26)} updates\n`);
          // Precis som riktiga dnf: slutkod 100 betyder "det finns uppdateringar".
          return ups.length ? 100 : 0;
        }
        case 'makecache':
          loadRepos();
          ctx.out('Metadata cache created.\n');
          return 0;
        case 'repolist':
          ctx.out(`repo id                          repo name\nfedora                           Fedora ${sh.distro.version} - x86_64\nupdates                          Fedora ${sh.distro.version} - x86_64 - Updates\n`);
          return 0;
        case 'search': {
          loadRepos();
          const results = searchPackages(fam, targets.join(' '));
          if (!results.length) {
            ctx.out('No matches found.\n');
            return 1;
          }
          ctx.out('Matched fields: name, summary\n');
          for (const p of results) ctx.out(` ${pkgName(ctx, p)}.x86_64\t${p.description}\n`);
          return 0;
        }
        case 'info': {
          loadRepos();
          let code = 0;
          for (const t of targets) {
            const p = findPackage(fam, t);
            if (!p) {
              ctx.err(`No matching packages to list\n`);
              code = 1;
              continue;
            }
            const installedNow = isInstalled(sh, p);
            const [version, release] = (installedNow ? sh.installed[p.id] : ver(p)).split(/-(?=[^-]+$)/);
            ctx.out(
              `${installedNow ? 'Installed' : 'Available'} packages\nName            : ${t}\nVersion         : ${version}\n` +
                `Release         : ${release ?? '1'}\nArchitecture    : x86_64\nInstalled size  : ${formatMiB(p.sizeKb)}\n` +
                `Repository      : ${installedNow ? '@System' : 'fedora'}\nSummary         : ${p.description}\n\n`,
            );
          }
          return code;
        }
        case 'list': {
          loadRepos();
          const installedOnly = rest.includes('--installed') || rest.includes('installed');
          const upgradesOnly = rest.includes('--upgrades') || rest.includes('upgrades');
          const list = familyPackages(ctx).sort((a, b) => pkgName(ctx, a).localeCompare(pkgName(ctx, b)));
          const line = (p: PackageDef, v: string, repo: string) => `${(pkgName(ctx, p) + '.x86_64').padEnd(30)} ${v.padEnd(26)} ${repo}\n`;
          if (upgradesOnly) {
            ctx.out('Available upgrades\n');
            upgradable(sh).forEach((p) => ctx.out(line(p, ver(p), 'updates')));
            return 0;
          }
          ctx.out('Installed packages\n');
          list.filter((p) => isInstalled(sh, p)).forEach((p) => ctx.out(line(p, sh.installed[p.id], 'anaconda')));
          if (!installedOnly) {
            ctx.out('\nAvailable packages\n');
            list.filter((p) => !isInstalled(sh, p)).forEach((p) => ctx.out(line(p, ver(p), 'fedora')));
          }
          return 0;
        }
      }
      ctx.err(`Unknown argument "${sub}" for command "dnf5". Add "--help" for more information about the arguments.\n`);
      return 2;
    },
  };
}

export const PKG_COMMANDS: CommandDef[] = [makeApt('apt'), makeApt('apt-get'), pacman(), dnf('dnf'), dnf('dnf5')];
