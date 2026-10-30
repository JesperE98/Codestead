// Universella paketformat som fungerar i alla distributioner: Flatpak, Snap och AppImage.
// Allt tillstånd ligger i det virtuella filsystemet, precis som i ett riktigt system:
//   Flatpak: /var/lib/flatpak (system) och ~/.local/share/flatpak (--user)
//   Snap:    /snap/<namn>/<revision> och /snap/bin
//   AppImage: en enda körbar fil, t.ex. ~/Nedladdningar/Kalkylator.AppImage
// Grafiska program kan inte visas i simulatorn – de skriver en dämpad rad i stället.

import { ensureDir } from '../extrarepo';
import type { Shell } from '../shell';
import type { CmdCtx, CommandDef } from '../types';
import { basename, ELF, FsError, makeDir, makeFile, type FsNode } from '../vfs';
import { askYesNo } from './repos';
import { COLOR, parseOpts } from './util';

const isRoot = (sh: Shell) => sh.currentUser().uid === 0;
const dim = (sh: Shell, text: { sv: string; en: string }) => `${COLOR.dim}${sh.msg(text)}${COLOR.reset}\n`;
/** Raden som visas i stället för ett fönster. */
const windowNote = (sh: Shell, app: string) =>
  dim(sh, {
    sv: `(${app} är ett grafiskt program och skulle nu öppnas i ett eget fönster. Simulatorn har bara en terminal, så här tar det stopp.)`,
    en: `(${app} is a graphical program and would now open in a window of its own. The simulator only has a terminal, so this is where it stops.)`,
  });

function simBinary(impl: string, owner = 'root', mode = 0o755, group = owner, extra = ''): FsNode {
  const node = makeFile(`${ELF}\u0002\u0001\u0001 (simulerad binärfil: ${impl})\n${extra}`, owner, mode, group);
  node.size = 40_000;
  return node;
}

const tryNode = (sh: Shell, path: string) => sh.vfs.tryLookup(path, sh.rootUser());
const children = (sh: Shell, path: string) => Object.keys(tryNode(sh, path)?.children ?? {}).sort();

// ================================================================ Flatpak

interface FlatpakApp {
  id: string;
  name: string;
  summary: string;
  version: string;
  branch: string;
  runtime: string;
  /** MB att ladda ner. */
  sizeMb: number;
  /** Utdrag ur behörigheterna (sandlådan). */
  permissions: string[];
  /** Finns även i Fedoras egen Flatpak-källa. */
  inFedora?: boolean;
}

interface FlatpakRuntime {
  id: string;
  name: string;
  branch: string;
  sizeMb: number;
}

const RUNTIMES: Record<string, FlatpakRuntime> = {
  'org.gnome.Platform//49': { id: 'org.gnome.Platform', name: 'GNOME Application Platform version 49', branch: '49', sizeMb: 381 },
  'org.freedesktop.Platform//25.08': { id: 'org.freedesktop.Platform', name: 'Freedesktop Platform', branch: '25.08', sizeMb: 245 },
  'org.kde.Platform//6.9': { id: 'org.kde.Platform', name: 'KDE Application Platform', branch: '6.9', sizeMb: 412 },
};

const FLATHUB: FlatpakApp[] = [
  { id: 'org.gimp.GIMP', name: 'GNU Image Manipulation Program', summary: 'Create images and edit photographs', version: '3.0.6', branch: 'stable', runtime: 'org.gnome.Platform//49', sizeMb: 130, permissions: ['ipc', 'network', 'x11', 'wayland', 'dri', 'file access: host'], inFedora: true },
  { id: 'org.videolan.VLC', name: 'VLC', summary: 'VLC media player, the open-source multimedia player', version: '3.0.21', branch: 'stable', runtime: 'org.kde.Platform//6.9', sizeMb: 92, permissions: ['ipc', 'network', 'pulseaudio', 'x11', 'wayland', 'dri', 'file access: host'] },
  { id: 'org.mozilla.firefox', name: 'Firefox', summary: 'Fast, Private & Safe Web Browser', version: '144.0', branch: 'stable', runtime: 'org.freedesktop.Platform//25.08', sizeMb: 105, permissions: ['ipc', 'network', 'pulseaudio', 'wayland', 'x11', 'dri', 'file access: xdg-download'] },
  { id: 'org.libreoffice.LibreOffice', name: 'LibreOffice', summary: 'The LibreOffice productivity suite', version: '25.8.2.2', branch: 'stable', runtime: 'org.freedesktop.Platform//25.08', sizeMb: 312, permissions: ['ipc', 'network', 'x11', 'wayland', 'dri', 'file access: host'], inFedora: true },
  { id: 'org.inkscape.Inkscape', name: 'Inkscape', summary: 'Vector Graphics Editor', version: '1.4.2', branch: 'stable', runtime: 'org.gnome.Platform//49', sizeMb: 118, permissions: ['ipc', 'x11', 'wayland', 'dri', 'file access: host'] },
  { id: 'com.spotify.Client', name: 'Spotify', summary: 'Online music streaming service', version: '1.2.74.477', branch: 'stable', runtime: 'org.freedesktop.Platform//25.08', sizeMb: 180, permissions: ['ipc', 'network', 'pulseaudio', 'x11', 'dri', 'file access: xdg-music:ro'] },
  { id: 'org.kde.krita', name: 'Krita', summary: 'Digital Painting, Creative Freedom', version: '5.2.13', branch: 'stable', runtime: 'org.kde.Platform//6.9', sizeMb: 205, permissions: ['ipc', 'x11', 'wayland', 'dri', 'file access: host'] },
];

const FLATHUB_URL = 'https://dl.flathub.org/repo/flathub.flatpakrepo';
const FEDORA_REMOTE = 'oci+https://registry.fedoraproject.org';

type Inst = 'system' | 'user';
const instBase = (sh: Shell, inst: Inst) => (inst === 'system' ? '/var/lib/flatpak' : `${sh.home}/.local/share/flatpak`);
const configPath = (sh: Shell, inst: Inst) => `${instBase(sh, inst)}/repo/config`;

/** Gör en katalog (med föräldrar) som rätt användare: root för systemet, eleven för --user. */
function mkdirsAs(sh: Shell, path: string, inst: Inst): void {
  if (inst === 'system') return ensureDir(sh, path);
  const user = sh.currentUser();
  let cur = '';
  for (const seg of path.split('/').filter(Boolean)) {
    cur += '/' + seg;
    if (!sh.vfs.tryLookup(cur, user)) sh.vfs.mkdir(cur, user);
  }
}

/** Fedora Workstation har Flatpak och Fedoras egen källa från början. */
function flatpakSeed(sh: Shell): void {
  if (sh.flags['flatpak:seeded']) return;
  sh.flags['flatpak:seeded'] = true;
  if (sh.distro.family !== 'redhat' || tryNode(sh, configPath(sh, 'system'))) return;
  ensureDir(sh, '/var/lib/flatpak/repo');
  sh.vfs.writeFile(configPath(sh, 'system'), `[core]\nrepo_version=1\nmode=bare-user-only\n\n[remote "fedora"]\nurl=${FEDORA_REMOTE}\nurl-is-set=true\ncollection-id=org.fedoraproject.Stable\n`, sh.rootUser());
}

function remotes(sh: Shell, inst: Inst): string[] {
  const c = tryNode(sh, configPath(sh, inst))?.content ?? '';
  return [...c.matchAll(/^\[remote "([^"]+)"\]/gm)].map((m) => m[1]);
}

function remoteApps(remote: string): FlatpakApp[] {
  if (remote === 'flathub') return FLATHUB;
  if (remote === 'fedora') return FLATHUB.filter((a) => a.inFedora);
  return [];
}

interface Installed {
  ref: string;
  inst: Inst;
  kind: 'app' | 'runtime';
  id: string;
  branch: string;
  meta: string;
}

function installedRefs(sh: Shell): Installed[] {
  const out: Installed[] = [];
  for (const inst of ['system', 'user'] as Inst[]) {
    const base = instBase(sh, inst);
    for (const kind of ['app', 'runtime'] as const) {
      for (const id of children(sh, `${base}/${kind}`)) {
        for (const branch of children(sh, `${base}/${kind}/${id}/x86_64`)) {
          const meta = tryNode(sh, `${base}/${kind}/${id}/x86_64/${branch}/active/metadata`)?.content ?? '';
          out.push({ ref: `${kind}/${id}/x86_64/${branch}`, inst, kind, id, branch, meta });
        }
      }
    }
  }
  return out;
}

const metaValue = (meta: string, key: string) => new RegExp(`^${key}=(.*)$`, 'm').exec(meta)?.[1] ?? '';

/** Hittar en app i flatpaks källor: exakt id, eller ett unikt namn/sista del av id (t.ex. "gimp"). */
function matchApp(query: string, apps: FlatpakApp[]): FlatpakApp | undefined {
  const q = query.toLowerCase();
  const exact = apps.find((a) => a.id.toLowerCase() === q);
  if (exact) return exact;
  const loose = apps.filter((a) => a.id.toLowerCase().split('.').pop() === q || a.name.toLowerCase() === q);
  return loose.length === 1 ? loose[0] : undefined;
}

function writeRef(sh: Shell, inst: Inst, kind: 'app' | 'runtime', id: string, branch: string, meta: string, sizeMb: number): void {
  const dir = `${instBase(sh, inst)}/${kind}/${id}/x86_64/${branch}/active`;
  mkdirsAs(sh, dir, inst);
  const user = inst === 'system' ? sh.rootUser() : sh.currentUser();
  sh.vfs.writeFile(`${dir}/metadata`, meta, user);
  const files = sh.vfs.lookup(dir, user);
  const blob = makeFile('(simulerade programfiler)\n', user.name, 0o644, user.groups[0]);
  blob.size = sizeMb * 1_000_000;
  files.children!.files = makeDir(user.name, 0o755, { 'program.bin': blob }, user.groups[0]);
}

const FLATPAK_MAN_SV = `NAMN
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
       flatpak remote-add --if-not-exists flathub ${FLATHUB_URL}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP`;

const FLATPAK_MAN_EN = `NAME
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
       flatpak remote-add --if-not-exists flathub ${FLATHUB_URL}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP`;

const flatpak: CommandDef = {
  name: 'flatpak',
  summary: 'Installerar och kör program i sandlåda (Flatpak/Flathub)',
  summaryEn: 'Installs and runs sandboxed applications (Flatpak/Flathub)',
  man: FLATPAK_MAN_SV,
  manEn: FLATPAK_MAN_EN,
  run(ctx) {
    const sh = ctx.sh;
    flatpakSeed(sh);
    const [cmd, ...rest] = ctx.args;
    if (!cmd || cmd === '--help' || cmd === '-h') {
      ctx.out('Usage:\n  flatpak [OPTION…] COMMAND\n\nBuiltin Commands:\n Manage installed applications and runtimes\n  install        Install an application or runtime\n  update         Update an installed application or runtime\n  uninstall      Uninstall an installed application or runtime\n  list           List installed apps and/or runtimes\n  info           Show info for installed app or runtime\n  run            Run an application\n  search         Search for remote apps/runtimes\n  remotes        List all configured remotes\n  remote-add     Add a new remote repository (by URL)\n  remote-delete  Delete a configured remote\n');
      return cmd ? 0 : 1;
    }
    if (cmd === '--version') {
      ctx.out(`Flatpak ${(sh.installed.flatpak ?? '1.16.1').replace(/^\d+:/, '').split('-')[0]}\n`);
      return 0;
    }
    const o = parseOpts(rest, {
      flags: 'y',
      long: { user: 'U', system: 'S', 'if-not-exists': 'E', assumeyes: 'y', noninteractive: 'y', app: 'a', runtime: 'r', unused: 'u', 'show-permissions': 'P', columns: 'c', 'from': 'F' },
      values: 'c',
    });
    if (o.error) {
      ctx.err(`error: ${o.error.replace(/^unrecognized option/, 'Unknown option')}\n`);
      return 1;
    }
    const inst: Inst = o.flags.has('U') ? 'user' : 'system';
    const where = inst === 'system' ? 'system' : 'user';
    const args = o.operands;

    const needRoot = () => {
      // På ett skrivbord frågar polkit efter lösenordet i ett fönster; här låtsas vi att du svarade.
      if (inst === 'system' && !isRoot(sh) && !sh.flags['flatpak:polkitNote']) {
        sh.flags['flatpak:polkitNote'] = true;
        ctx.out(dim(sh, { sv: '(Utan sudo frågar Flatpak efter ditt lösenord i ett fönster (polkit). Simulatorn hoppar över det.)', en: '(Without sudo, Flatpak asks for your password in a window (polkit). The simulator skips that.)' }));
      }
    };

    switch (cmd) {
      case 'remote-add': {
        const [name, url] = args;
        if (!name || !url) {
          ctx.err('error: NAME and LOCATION must be specified\n');
          return 1;
        }
        if (remotes(sh, inst).includes(name)) {
          if (o.flags.has('E')) return 0;
          ctx.err(`error: Remote ${name} already exists\n`);
          return 1;
        }
        if (!/flathub\.org\/repo\/flathub\.flatpakrepo$/.test(url) && !/dl\.flathub\.org\/repo\/?$/.test(url)) {
          ctx.err(`error: Can't load uri ${url}: Could not resolve hostname\n`);
          ctx.err(dim(sh, { sv: `(Simulatorn känner bara till Flathub: ${FLATHUB_URL})`, en: `(The simulator only knows about Flathub: ${FLATHUB_URL})` }));
          return 1;
        }
        needRoot();
        const path = configPath(sh, inst);
        mkdirsAs(sh, path.slice(0, path.lastIndexOf('/')), inst);
        const user = inst === 'system' ? sh.rootUser() : sh.currentUser();
        const old = tryNode(sh, path)?.content ?? '[core]\nrepo_version=1\nmode=bare-user-only\n';
        sh.vfs.writeFile(path, `${old}\n[remote "${name}"]\nurl=https://dl.flathub.org/repo/\ngpg-verify=true\ngpg-verify-summary=true\nxa.title=Flathub\nxa.homepage=https://flathub.org/\n`, user);
        return 0;
      }
      case 'remote-delete': {
        const [name] = args;
        if (!name || !remotes(sh, inst).includes(name)) {
          ctx.err(`error: Remote "${name ?? ''}" not found\n`);
          return 1;
        }
        needRoot();
        const user = inst === 'system' ? sh.rootUser() : sh.currentUser();
        const path = configPath(sh, inst);
        const content = sh.vfs.readFile(path, sh.rootUser()).replace(new RegExp(`\\n?\\[remote "${name.replace(/\./g, '\\.')}"\\][^[]*`), '\n');
        sh.vfs.writeFile(path, content, user);
        return 0;
      }
      case 'remotes':
      case 'remote-list': {
        const both = o.flags.has('U') || o.flags.has('S') ? [inst] : (['system', 'user'] as Inst[]);
        if (ctx.isTTY) ctx.out('Name    Options\n');
        for (const i of both) for (const r of remotes(sh, i)) ctx.out(`${r.padEnd(8)}${i}${r === 'fedora' ? ',oci' : ''}\n`);
        return 0;
      }
      case 'search': {
        const q = args.join(' ').toLowerCase();
        if (!q) {
          ctx.err('error: TEXT must be specified\n');
          return 1;
        }
        const rs = [...new Set([...remotes(sh, 'system'), ...remotes(sh, 'user')])];
        const hits = FLATHUB.filter((a) => (a.id + ' ' + a.name + ' ' + a.summary).toLowerCase().includes(q))
          .map((a) => ({ a, in: rs.filter((r) => remoteApps(r).includes(a)) }))
          .filter((h) => h.in.length);
        if (!hits.length) {
          ctx.out('No matches found\n');
          if (!rs.length) ctx.out(dim(sh, { sv: 'Tips från simulatorn: du har inga källor ännu. Lägg till Flathub med flatpak remote-add.', en: 'Simulator tip: you have no remotes yet. Add Flathub with flatpak remote-add.' }));
          return 0;
        }
        if (ctx.isTTY) ctx.out('Name                              Description                                          Application ID                 Version    Branch  Remotes\n');
        for (const h of hits) {
          ctx.out(`${h.a.name.padEnd(33)} ${h.a.summary.padEnd(52)} ${h.a.id.padEnd(30)} ${h.a.version.padEnd(10)} ${h.a.branch.padEnd(7)} ${h.in.join(',')}\n`);
        }
        return 0;
      }
      case 'install': {
        if (!args.length) {
          ctx.err('error: At least one REF must be specified\n');
          return 1;
        }
        const rs = remotes(sh, inst);
        let remote: string | undefined;
        let refs = args;
        if (args.length > 1 && (rs.includes(args[0]) || ['flathub', 'fedora', 'flathub-beta'].includes(args[0]))) {
          remote = args[0];
          refs = args.slice(1);
        }
        ctx.out('Looking for matches…\n');
        if (remote && !rs.includes(remote)) {
          ctx.err(`error: No remote refs found for ‘${remote}’\n`);
          if (inst === 'user' && remotes(sh, 'system').includes(remote)) {
            ctx.err(dim(sh, { sv: `(${remote} finns bara i systemets installation. Användarinstallationen har egna källor – lägg till den med --user.)`, en: `(${remote} only exists in the system installation. The user installation has its own remotes - add it with --user.)` }));
          } else {
            ctx.err(dim(sh, { sv: `Tips från simulatorn: lägg till källan först: flatpak remote-add --if-not-exists flathub ${FLATHUB_URL}`, en: `Simulator tip: add the remote first: flatpak remote-add --if-not-exists flathub ${FLATHUB_URL}` }));
          }
          return 1;
        }
        const plan: { app: FlatpakApp; remote: string }[] = [];
        for (const r of refs) {
          const searchIn = remote ? [remote] : rs;
          const found = searchIn.map((rem) => ({ rem, app: matchApp(r.replace(/^app\//, '').split('/')[0], remoteApps(rem)) })).find((x) => x.app);
          if (!found) {
            ctx.err(`error: Nothing matches ${r} in ${remote ? `remote ${remote}` : `${where} installation`}\n`);
            return 1;
          }
          if (!remote) ctx.out(`Found ref ‘app/${found.app!.id}/x86_64/${found.app!.branch}’ in remote ‘${found.rem}’ (${where}).\n`);
          if (installedRefs(sh).some((i) => i.inst === inst && i.id === found.app!.id)) {
            ctx.out(`Skipping: ${found.app!.id}/x86_64/${found.app!.branch} is already installed\n`);
            continue;
          }
          plan.push({ app: found.app!, remote: found.rem });
        }
        if (!plan.length) return 0;
        needRoot();
        const have = installedRefs(sh).filter((i) => i.inst === inst && i.kind === 'runtime').map((i) => `${i.id}//${i.branch}`);
        const runtimes = [...new Set(plan.map((p) => p.app.runtime))].filter((r) => !have.includes(r));
        const rows: string[] = [];
        for (const rt of runtimes) {
          const r = RUNTIMES[rt];
          rows.push(`${r.id}.Locale`.padEnd(43) + ` ${r.branch.padEnd(9)} i    ${plan[0].remote.padEnd(9)} < 18.5 kB`);
          rows.push(`${r.id}`.padEnd(43) + ` ${r.branch.padEnd(9)} i    ${plan[0].remote.padEnd(9)} < ${r.sizeMb} MB`);
        }
        for (const p of plan) rows.push(`${p.app.id}`.padEnd(43) + ` ${p.app.branch.padEnd(9)} i    ${p.remote.padEnd(9)} < ${p.app.sizeMb} MB`);
        for (const p of plan) {
          ctx.out(`\n${p.app.id} permissions:\n    ${p.app.permissions.join('    ')}\n`);
        }
        ctx.out(`\n        ${'ID'.padEnd(43)} ${'Branch'.padEnd(9)} Op   ${'Remote'.padEnd(9)} Download\n`);
        rows.forEach((r, i) => ctx.out(` ${String(i + 1).padStart(2)}. [ ] ${r}\n`));
        ctx.out('\n');
        return askYesNo(
          ctx,
          `Proceed with these changes to the ${where} installation? [Y/n]: `,
          true,
          o.flags.has('y'),
          (io) => {
            for (const rt of runtimes) {
              const r = RUNTIMES[rt];
              writeRef(sh, inst, 'runtime', r.id, r.branch, `[Runtime]\nname=${r.id}\nbranch=${r.branch}\ntitle=${r.name}\n`, r.sizeMb);
            }
            for (const p of plan) {
              writeRef(sh, inst, 'app', p.app.id, p.app.branch, `[Application]\nname=${p.app.id}\ntitle=${p.app.name}\nversion=${p.app.version}\nruntime=${p.app.runtime.replace('//', '/x86_64/')}\norigin=${p.remote}\n\n[Context]\nshared=${p.app.permissions.filter((x) => !x.includes(':')).join(';')};\n`, p.app.sizeMb);
            }
            rows.forEach((r, i) => io.out(` ${String(i + 1).padStart(2)}. [✓] ${r}\n`));
            io.out('\nInstallation complete.\n');
            return 0;
          },
          (io) => {
            io.out('error: Aborted by user\n');
            return 1;
          },
        );
      }
      case 'list': {
        let list = installedRefs(sh);
        if (o.flags.has('U')) list = list.filter((i) => i.inst === 'user');
        if (o.flags.has('S')) list = list.filter((i) => i.inst === 'system');
        if (o.flags.has('a')) list = list.filter((i) => i.kind === 'app');
        if (o.flags.has('r')) list = list.filter((i) => i.kind === 'runtime');
        if (ctx.isTTY && list.length) ctx.out(`${'Name'.padEnd(40)} ${'Application ID'.padEnd(30)} ${'Version'.padEnd(10)} ${'Branch'.padEnd(7)} Installation\n`);
        for (const i of list) {
          const title = metaValue(i.meta, 'title') || i.id;
          const version = metaValue(i.meta, 'version');
          ctx.out(ctx.isTTY ? `${title.padEnd(40)} ${i.id.padEnd(30)} ${version.padEnd(10)} ${i.branch.padEnd(7)} ${i.inst}\n` : `${title}\t${i.id}\t${version}\t${i.branch}\t${i.inst}\n`);
        }
        return 0;
      }
      case 'info': {
        const id = args[0];
        const i = installedRefs(sh).find((x) => x.id === id || x.id.toLowerCase() === id?.toLowerCase());
        if (!id || !i) {
          ctx.err(`error: ${id ?? ''}/*unspecified*/*unspecified* not installed\n`);
          return 1;
        }
        if (o.flags.has('P')) {
          ctx.out(i.meta.split('[Context]')[1]?.trim() ? `[Context]\n${i.meta.split('[Context]')[1].trim()}\n` : '');
          return 0;
        }
        ctx.out(
          `\n${metaValue(i.meta, 'title') || i.id}\n\n          ID: ${i.id}\n         Ref: ${i.ref}\n        Arch: x86_64\n      Branch: ${i.branch}\n` +
            (metaValue(i.meta, 'version') ? `     Version: ${metaValue(i.meta, 'version')}\n` : '') +
            `      Origin: ${metaValue(i.meta, 'origin') || 'flathub'}\nInstallation: ${i.inst}\n` +
            (i.kind === 'app' ? `     Runtime: ${metaValue(i.meta, 'runtime')}\n     Sdk: ${metaValue(i.meta, 'runtime').replace('Platform', 'Sdk')}\n` : '') +
            '\n',
        );
        return 0;
      }
      case 'run': {
        const id = args[0];
        if (!id) {
          ctx.err('error: APP must be specified\n');
          return 1;
        }
        const i = installedRefs(sh).find((x) => x.kind === 'app' && x.id === id);
        if (!i) {
          ctx.err(`error: app/${id}/x86_64/master not installed\n`);
          return 1;
        }
        ctx.out(windowNote(sh, metaValue(i.meta, 'title') || id));
        return 0;
      }
      case 'update':
      case 'upgrade': {
        ctx.out('Looking for updates…\n');
        // Allt i simulatorn är redan senaste versionen.
        ctx.out('Nothing to do.\n');
        return 0;
      }
      case 'uninstall':
      case 'remove': {
        const installed = installedRefs(sh).filter((i) => i.inst === inst);
        let targets: Installed[];
        if (o.flags.has('u')) {
          const used = installed.filter((i) => i.kind === 'app').map((i) => metaValue(i.meta, 'runtime').split('/x86_64/'));
          targets = installed.filter((i) => i.kind === 'runtime' && !used.some(([id, br]) => id === i.id && br === i.branch));
          if (!targets.length) {
            ctx.out('Nothing unused to uninstall\n');
            return 0;
          }
        } else {
          if (!args.length) {
            ctx.err('error: Must specify at least one REF, --unused, --all or --delete-data\n');
            return 1;
          }
          targets = [];
          for (const a of args) {
            const i = installed.find((x) => x.id === a);
            if (!i) {
              ctx.err(`error: ${a}/*unspecified*/*unspecified* not installed\n`);
              return 1;
            }
            targets.push(i);
          }
        }
        needRoot();
        ctx.out(`\n        ${'ID'.padEnd(43)} ${'Branch'.padEnd(9)} Op\n`);
        targets.forEach((t, i) => ctx.out(` ${String(i + 1).padStart(2)}. [-] ${t.id.padEnd(43)} ${t.branch.padEnd(9)} r\n`));
        ctx.out('\n');
        return askYesNo(
          ctx,
          `Proceed with these changes to the ${where} installation? [Y/n]: `,
          true,
          o.flags.has('y'),
          (io) => {
            const user = inst === 'system' ? sh.rootUser() : sh.currentUser();
            for (const t of targets) {
              const dir = `${instBase(sh, inst)}/${t.kind}/${t.id}`;
              sh.vfs.remove(dir, user);
            }
            io.out('Uninstall complete.\n');
            if (!o.flags.has('u') && targets.some((t) => t.kind === 'app')) {
              io.out(dim(sh, { sv: 'Tips: runtimes ligger kvar. Ta bort dem som inget program använder med: flatpak uninstall --unused', en: 'Tip: the runtimes are still there. Remove those no app uses with: flatpak uninstall --unused' }));
            }
            return 0;
          },
          (io) => {
            io.out('error: Aborted by user\n');
            return 1;
          },
        );
      }
    }
    ctx.err(`error: Unknown command '${cmd}'\n\nSee 'flatpak --help'\n`);
    return 1;
  },
};

// ================================================================ Snap

interface SnapDef {
  name: string;
  version: string;
  rev: number;
  publisher: string;
  summary: string;
  /** Grafiskt program (annars körs det i terminalen). */
  gui: boolean;
  classic?: boolean;
  base?: string;
  /** Kommandon i /snap/bin. */
  apps?: string[];
  notes?: string;
  sizeMb: number;
}

const SNAPS: SnapDef[] = [
  { name: 'bare', version: '1.0', rev: 5, publisher: 'canonical✓', summary: 'Empty base snap, useful for testing and fully statically linked snaps', gui: false, notes: 'base', sizeMb: 0, apps: [] },
  { name: 'core22', version: '20250923', rev: 2133, publisher: 'canonical✓', summary: 'Runtime environment based on Ubuntu 22.04', gui: false, notes: 'base', sizeMb: 77, apps: [] },
  { name: 'core24', version: '20250926', rev: 1196, publisher: 'canonical✓', summary: 'Runtime environment based on Ubuntu 24.04', gui: false, notes: 'base', sizeMb: 70, apps: [] },
  { name: 'snapd', version: '2.71', rev: 25202, publisher: 'canonical✓', summary: 'Daemon and tooling that enable snap packages', gui: false, notes: 'snapd', sizeMb: 50, apps: [] },
  { name: 'gtk-common-themes', version: '0.1-81-g442e511', rev: 1535, publisher: 'canonical✓', summary: 'Common GTK themes for snaps', gui: false, sizeMb: 92, apps: [] },
  { name: 'gnome-42-2204', version: '0+git.38ea591', rev: 202, publisher: 'canonical✓', summary: 'Shared GNOME 42 Ubuntu stack', gui: false, sizeMb: 516, apps: [] },
  { name: 'firefox', version: '144.0-2', rev: 7084, publisher: 'mozilla✓', summary: 'Mozilla Firefox web browser', gui: true, base: 'core22', sizeMb: 265 },
  { name: 'hello-world', version: '6.4', rev: 29, publisher: 'canonical✓', summary: 'The \'hello-world\' of snaps', gui: false, base: 'core22', sizeMb: 1, apps: ['hello-world'] },
  { name: 'vlc', version: '3.0.21', rev: 3777, publisher: 'videolan✓', summary: 'The ultimate media player', gui: true, base: 'core22', sizeMb: 340 },
  { name: 'gimp', version: '3.0.6', rev: 532, publisher: 'snapcrafters✪', summary: 'GNU Image Manipulation Program', gui: true, base: 'core24', sizeMb: 380 },
  { name: 'code', version: '1.105.1', rev: 208, publisher: 'vscode✓', summary: 'Code editing. Redefined.', gui: true, classic: true, base: 'core22', sizeMb: 330 },
  { name: 'spotify', version: '1.2.74.477', rev: 88, publisher: 'spotify✓', summary: 'Music for everyone', gui: true, base: 'core22', sizeMb: 190 },
  { name: 'kalkylator', version: '2.3.1', rev: 12, publisher: 'kalkylab', summary: 'A simple calculator (also available as an AppImage)', gui: true, base: 'core24', sizeMb: 48 },
];
const UBUNTU_SEED = ['bare', 'core22', 'core24', 'firefox', 'gnome-42-2204', 'gtk-common-themes', 'snapd'];

const snapDef = (name: string) => SNAPS.find((s) => s.name === name);

/** Installerade snaps: /snap/<namn>/<revision>/meta/snap.yaml */
function installedSnaps(sh: Shell): { def: SnapDef; rev: number; classic: boolean }[] {
  const out: { def: SnapDef; rev: number; classic: boolean }[] = [];
  for (const name of children(sh, '/snap')) {
    if (name === 'bin') continue;
    const def = snapDef(name);
    const revs = children(sh, `/snap/${name}`).map(Number).filter((n) => !Number.isNaN(n));
    if (!def || !revs.length) continue;
    const rev = Math.max(...revs);
    const yaml = tryNode(sh, `/snap/${name}/${rev}/meta/snap.yaml`)?.content ?? '';
    out.push({ def, rev, classic: /confinement: classic/.test(yaml) });
  }
  return out;
}

function placeSnap(sh: Shell, def: SnapDef, classic: boolean): void {
  ensureDir(sh, `/snap/${def.name}/${def.rev}/meta`);
  sh.vfs.writeFile(
    `/snap/${def.name}/${def.rev}/meta/snap.yaml`,
    `name: ${def.name}\nversion: '${def.version}'\nsummary: ${def.summary}\n${def.base ? `base: ${def.base}\n` : ''}confinement: ${classic ? 'classic' : 'strict'}\n`,
    sh.rootUser(),
  );
  ensureDir(sh, '/var/lib/snapd/snaps');
  const blob = makeFile('hsqs (simulerad squashfs-avbild)\n', 'root', 0o600);
  blob.size = def.sizeMb * 1_000_000;
  sh.vfs.insert(`/var/lib/snapd/snaps/${def.name}_${def.rev}.snap`, blob, sh.rootUser());
  if (def.notes === 'base' || def.notes === 'snapd' || def.apps?.length === 0) return;
  ensureDir(sh, '/snap/bin');
  // Precis som på riktigt pekar /snap/bin/<program> på själva snap-kommandot.
  for (const app of def.apps ?? [def.name]) sh.vfs.insert(`/snap/bin/${app}`, simBinary('snap'), sh.rootUser());
}

/** Ubuntu levereras med några snaps (bl.a. Firefox). */
function snapSeed(sh: Shell): void {
  if (sh.flags['snap:seeded']) return;
  sh.flags['snap:seeded'] = true;
  if (sh.distro.id !== 'ubuntu' || tryNode(sh, '/snap')) return;
  for (const n of UBUNTU_SEED) placeSnap(sh, snapDef(n)!, false);
}

function runSnapApp(ctx: CmdCtx, name: string): number {
  const sh = ctx.sh;
  const inst = installedSnaps(sh).find((s) => s.def.name === name || s.def.apps?.includes(name));
  if (!inst) {
    ctx.err(`error: cannot find current revision for snap ${name}: readlink /snap/${name}/current: no such file or directory\n`);
    return 1;
  }
  if (inst.def.name === 'hello-world') {
    ctx.out('Hello World!\n');
    return 0;
  }
  ctx.out(windowNote(sh, inst.def.name));
  return 0;
}

const SNAP_MAN_SV = `NAMN
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

const SNAP_MAN_EN = `NAME
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

const snap: CommandDef = {
  name: 'snap',
  summary: 'Installerar och hanterar snap-paket (Canonical/Ubuntu)',
  summaryEn: 'Installs and manages snap packages (Canonical/Ubuntu)',
  man: SNAP_MAN_SV,
  manEn: SNAP_MAN_EN,
  run(ctx) {
    const sh = ctx.sh;
    snapSeed(sh);
    // /snap/bin/hello-world är egentligen snap själv – kör då programmet.
    const invokedAs = basename(ctx.name);
    if (invokedAs !== 'snap') return runSnapApp(ctx, invokedAs);

    const [cmd, ...rest] = ctx.args;
    const o = parseOpts(rest, { long: { classic: 'c', channel: 'C', beta: 'b', edge: 'e', candidate: 'd', stable: 's', all: 'a', purge: 'p', list: 'l' }, values: 'C' });
    if (o.error) {
      ctx.err(`error: ${o.error}\n`);
      return 1;
    }
    const denied = () => {
      ctx.err('error: access denied (try with sudo)\n');
      return 1;
    };
    switch (cmd) {
      case undefined:
      case 'help':
      case '--help':
        ctx.out('The snap command lets you install, configure, refresh and remove snaps.\nSnaps are packages that work across many different Linux distributions,\nenabling secure delivery and operation of the latest apps and utilities.\n\nUsage: snap <command> [<options>...]\n\nCommonly used commands can be classified as follows:\n\n         Basics: find, info, install, remove, list\n        ...more: refresh, revert, switch, disable, enable\n            Run: run\n');
        return cmd ? 0 : 1;
      case 'version':
      case '--version':
        ctx.out(`snap    2.71\nsnapd   2.71\nseries  16\n${sh.distro.id}  ${sh.distro.version}\nkernel  ${sh.distro.kernel}\n`);
        return 0;
      case 'list': {
        const list = installedSnaps(sh);
        if (!list.length) {
          ctx.out('No snaps are installed yet. Try \'snap install hello-world\'.\n');
          return 0;
        }
        ctx.out(`${'Name'.padEnd(19)}${'Version'.padEnd(17)}${'Rev'.padEnd(7)}${'Tracking'.padEnd(17)}${'Publisher'.padEnd(14)}Notes\n`);
        for (const s of list) {
          const notes = s.classic ? 'classic' : (s.def.notes ?? '-');
          ctx.out(`${s.def.name.padEnd(19)}${s.def.version.padEnd(17)}${String(s.rev).padEnd(7)}${'latest/stable'.padEnd(17)}${s.def.publisher.padEnd(14)}${notes}\n`);
        }
        return 0;
      }
      case 'find':
      case 'search': {
        const q = o.operands.join(' ').toLowerCase();
        const hits = SNAPS.filter((s) => !s.notes && (s.name.includes(q) || s.summary.toLowerCase().includes(q)));
        if (!hits.length) {
          ctx.err(`No matching snaps for "${q}"\n`);
          return 1;
        }
        ctx.out(`${'Name'.padEnd(13)}${'Version'.padEnd(13)}${'Publisher'.padEnd(15)}${'Notes'.padEnd(9)}Summary\n`);
        for (const s of hits) ctx.out(`${s.name.padEnd(13)}${s.version.padEnd(13)}${s.publisher.padEnd(15)}${(s.classic ? 'classic' : '-').padEnd(9)}${s.summary}\n`);
        return 0;
      }
      case 'info': {
        const def = o.operands[0] ? snapDef(o.operands[0]) : undefined;
        if (!def) {
          ctx.err(`error: no snap found for "${o.operands[0] ?? ''}"\n`);
          return 1;
        }
        const inst = installedSnaps(sh).find((s) => s.def === def);
        ctx.out(
          `name:      ${def.name}\nsummary:   ${def.summary}\npublisher: ${def.publisher.replace(/[✓✪]$/, '')}\nlicense:   unset\n` +
            (def.classic ? 'notes:     classic confinement – runs without the sandbox\n' : '') +
            `channels:\n  latest/stable:    ${def.version.padEnd(16)} (${def.rev}) ${def.sizeMb}MB${def.classic ? ' classic' : ''}\n` +
            `  latest/candidate: ↑\n  latest/beta:      ↑\n  latest/edge:      ${def.version}+git (${def.rev + 7}) ${def.sizeMb}MB${def.classic ? ' classic' : ''}\n` +
            (inst ? `installed:          ${def.version.padEnd(16)} (${inst.rev}) ${def.sizeMb}MB${inst.classic ? ' classic' : ''}\n` : ''),
        );
        return 0;
      }
      case 'install': {
        if (!o.operands.length) {
          ctx.err('error: the required argument `<snap> (at least 1 argument)` was not provided\n');
          return 1;
        }
        if (!isRoot(sh)) return denied();
        let code = 0;
        for (const name of o.operands) {
          const def = snapDef(name);
          if (!def) {
            ctx.err(`error: snap "${name}" not found\n`);
            code = 1;
            continue;
          }
          if (installedSnaps(sh).some((s) => s.def === def)) {
            ctx.out(`snap "${name}" is already installed, see 'snap help refresh'\n`);
            continue;
          }
          if (def.classic && !o.flags.has('c')) {
            ctx.err(
              `error: This revision of snap "${name}" was published using classic confinement and thus may\n` +
                `       perform arbitrary system changes outside of the security sandbox that snaps are usually\n` +
                `       confined to, which may put your system at risk.\n\n       If you understand and want to proceed repeat the command including --classic.\n`,
            );
            code = 1;
            continue;
          }
          // Basen (core22, core24 ...) och snapd följer med om de saknas.
          for (const dep of ['snapd', def.base].filter((x): x is string => !!x)) {
            if (!installedSnaps(sh).some((s) => s.def.name === dep)) placeSnap(sh, snapDef(dep)!, false);
          }
          placeSnap(sh, def, !!def.classic);
          const channel = o.values.C ?? (o.flags.has('b') ? 'beta' : o.flags.has('e') ? 'edge' : o.flags.has('d') ? 'candidate' : '');
          ctx.out(`${name}${channel ? ` (${channel})` : ''} ${def.version} from ${def.publisher} installed\n`);
        }
        if (!(sh.env.PATH ?? '').split(':').includes('/snap/bin')) {
          sh.env.PATH = `${sh.env.PATH ?? '/usr/bin:/bin'}:/snap/bin`;
          ctx.out(dim(sh, { sv: '(/snap/bin lades till i PATH. I ett riktigt system händer det nästa gång du loggar in.)', en: '(/snap/bin was added to PATH. On a real system that happens the next time you log in.)' }));
        }
        return code;
      }
      case 'remove': {
        if (!o.operands.length) {
          ctx.err('error: the required argument `<snap> (at least 1 argument)` was not provided\n');
          return 1;
        }
        if (!isRoot(sh)) return denied();
        for (const name of o.operands) {
          const inst = installedSnaps(sh).find((s) => s.def.name === name);
          if (!inst) {
            ctx.out(`snap "${name}" is not installed\n`);
            continue;
          }
          sh.vfs.remove(`/snap/${name}`, sh.rootUser());
          for (const app of inst.def.apps ?? [name]) if (tryNode(sh, `/snap/bin/${app}`)) sh.vfs.remove(`/snap/bin/${app}`, sh.rootUser());
          const blob = `/var/lib/snapd/snaps/${name}_${inst.rev}.snap`;
          if (tryNode(sh, blob)) sh.vfs.remove(blob, sh.rootUser());
          ctx.out(`${name} removed${o.flags.has('p') ? '' : ` (snap data snapshot saved)`}\n`);
        }
        return 0;
      }
      case 'refresh': {
        if (o.flags.has('l')) {
          ctx.out('All snaps up to date.\n');
          return 0;
        }
        if (!isRoot(sh)) return denied();
        ctx.out('All snaps up to date.\n');
        return 0;
      }
      case 'run': {
        const name = o.operands[0];
        if (!name) {
          ctx.err('error: need the application to run as argument\n');
          return 1;
        }
        return runSnapApp(ctx, name);
      }
    }
    ctx.err(`error: unknown command "${cmd}", see 'snap help'.\n`);
    return 1;
  },
};

// ================================================================ AppImage

export const APPIMAGE_DIR = 'Nedladdningar';
export const APPIMAGE_NAME = 'Kalkylator.AppImage';

/** En nedladdad AppImage (som i startfilsystemet): en enda fil, ännu inte körbar. */
export function appImageNode(owner: string, group = owner): FsNode {
  const node = simBinary('appimage-runtime', owner, 0o644, group, 'AppImage: Kalkylator 2.3.1\nDesktop: kalkylator.desktop\nType 2 AppImage (squashfs)\n');
  node.size = 48_312_832;
  return node;
}

const FUSE_ERROR =
  'dlopen(): error loading libfuse.so.2\n\nAppImages require FUSE to run. \nYou might still be able to extract the contents of this AppImage \n' +
  'if you run it with the --appimage-extract option. \nSee https://github.com/AppImage/AppImageKit/wiki/FUSE \nfor more information\n';

const FUSE_PKG: Record<string, string> = { debian: 'libfuse2t64', arch: 'fuse2', redhat: 'fuse-libs' };

/** Körs när en AppImage (eller dess uppackade AppRun) startas. */
const appImageRuntime: CommandDef = {
  name: 'appimage-runtime',
  summary: 'Startprogrammet inuti en AppImage',
  summaryEn: 'The launcher inside an AppImage',
  man: `NAMN
       AppImage - ett helt program i en enda körbar fil

BESKRIVNING
       En AppImage startas som vilket program som helst: gör filen körbar
       med chmod +x och kör den med ./Fil.AppImage. Den monterar sig själv
       med FUSE (biblioteket libfuse.so.2).

FLAGGOR
       --appimage-extract           packa upp innehållet till squashfs-root/
       --appimage-extract-and-run   packa upp tillfälligt och kör (utan FUSE)`,
  manEn: `NAME
       AppImage - a whole program in a single executable file

DESCRIPTION
       An AppImage is started like any program: make the file executable
       with chmod +x and run it with ./File.AppImage. It mounts itself
       with FUSE (the library libfuse.so.2).

OPTIONS
       --appimage-extract           unpack the contents to squashfs-root/
       --appimage-extract-and-run   unpack temporarily and run (no FUSE)`,
  run(ctx) {
    const sh = ctx.sh;
    const path = sh.resolve(ctx.name);
    const self = sh.vfs.tryLookup(path, sh.currentUser())?.content ?? '';
    const appName = /^AppImage: (\S+)/m.exec(self)?.[1] ?? basename(path).replace(/\.AppImage$/i, '').split('-')[0];
    const extracted = basename(path) === 'AppRun' || path.includes('/squashfs-root/');
    const arg = ctx.args[0];
    if (arg === '--appimage-version') {
      ctx.out('AppImage runtime version: continuous build\n');
      return 0;
    }
    if (arg === '--appimage-help') {
      ctx.out('AppImage options:\n\n  --appimage-extract [<pattern>]  Extract content from embedded filesystem image\n  --appimage-extract-and-run      Temporarily extract and run without FUSE\n  --appimage-help                 Print this help\n  --appimage-version              Print version of AppImage runtime\n');
      return 0;
    }
    if (arg === '--appimage-extract' && !extracted) {
      const user = sh.currentUser();
      const g = user.groups[0];
      const lower = appName.toLowerCase();
      const files: [string, FsNode][] = [
        ['AppRun', simBinary('appimage-runtime', user.name, 0o755, g, `AppImage: ${appName}\n`)],
        [`${lower}.desktop`, makeFile(`[Desktop Entry]\nType=Application\nName=${appName}\nExec=${lower}\nIcon=${lower}\nCategories=Utility;Calculator;\n`, user.name, 0o644, g)],
        [`${lower}.png`, makeFile('\u0089PNG (simulerad ikon)\n', user.name, 0o644, g)],
        ['.DirIcon', makeFile('\u0089PNG (simulerad ikon)\n', user.name, 0o644, g)],
      ];
      const tree = makeDir(user.name, 0o755, Object.fromEntries(files), g);
      tree.children!.usr = makeDir(user.name, 0o755, {
        bin: makeDir(user.name, 0o755, { [lower]: simBinary('appimage-runtime', user.name, 0o755, g, `AppImage: ${appName}\n`) }, g),
        lib: makeDir(user.name, 0o755, { 'libQt6Core.so.6': makeFile('(simulerat bibliotek)\n', user.name, 0o644, g) }, g),
      }, g);
      try {
        sh.vfs.insert(sh.resolve('squashfs-root'), tree, user);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`Failed to create squashfs-root: ${e.message}\n`);
        return 1;
      }
      for (const [n] of files) ctx.out(`squashfs-root/${n}\n`);
      ctx.out(`squashfs-root/usr\nsquashfs-root/usr/bin\nsquashfs-root/usr/bin/${lower}\nsquashfs-root/usr/lib\nsquashfs-root/usr/lib/libQt6Core.so.6\n`);
      return 0;
    }
    if (!extracted && arg !== '--appimage-extract-and-run' && !sh.installed.fuse2) {
      ctx.err(FUSE_ERROR);
      ctx.err(
        dim(sh, {
          sv: `Tips från simulatorn: installera FUSE 2-biblioteket – i ${sh.distro.name} heter paketet ${FUSE_PKG[sh.distro.family]}. Eller kör med --appimage-extract-and-run.`,
          en: `Simulator tip: install the FUSE 2 library - on ${sh.distro.name} the package is called ${FUSE_PKG[sh.distro.family]}. Or run it with --appimage-extract-and-run.`,
        }),
      );
      return 127;
    }
    ctx.out(windowNote(sh, appName));
    return 0;
  },
};

export const UNIVERSAL_COMMANDS: CommandDef[] = [flatpak, snap, appImageRuntime];
