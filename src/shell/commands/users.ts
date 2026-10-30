// Användarhantering: useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd,
// chpasswd, chage, adduser/deluser/addgroup/delgroup (Debian), chgrp, who, w, last och getent.
// Allt läser och skriver /etc/passwd, /etc/group och /etc/shadow via users.ts.

import type { Shell } from '../shell';
import type { CmdCtx, CommandDef, Sink } from '../types';
import {
  findGroup,
  findUser,
  hashPassword,
  loadDb,
  nextId,
  passwordStatus,
  ROOT,
  saveDb,
  today,
  validName,
  type GroupEntry,
  type PasswdEntry,
  type ShadowEntry,
  type UserDb,
} from '../users';
import { cloneNode, FsError, type FsNode } from '../vfs';
import { currentProcs } from './procs';
import { badOption, COLOR, fsMessage, parseOpts } from './util';

// ---------- Hjälpfunktioner ----------

const dim = (sh: Shell, sv: string, en: string) => `${COLOR.dim}${sh.msg({ sv, en })}${COLOR.reset}\n`;

const isRoot = (sh: Shell) => sh.currentUser().uid === 0;

/** Som shadow-utils: "useradd: Permission denied." följt av att filen inte kunde låsas. */
function denied(ctx: CmdCtx, file = '/etc/passwd'): number {
  ctx.err(`${ctx.name}: Permission denied.\n${ctx.name}: cannot lock ${file}; try again later.\n`);
  if (ctx.isTTY) ctx.err(dim(ctx.sh, `Tips: det här kräver root – prova med sudo framför.`, `Tip: this needs root – try putting sudo in front.`));
  return 1;
}

/** Standardvärden som skiljer sig mellan familjerna (/etc/default/useradd och /etc/login.defs). */
function defaults(sh: Shell) {
  const fam = sh.distro.family;
  return {
    /** Fedora skapar hemkatalog även utan -m (CREATE_HOME yes). */
    createHome: fam === 'redhat',
    shell: fam === 'debian' ? '/bin/sh' : fam === 'arch' ? '/usr/bin/bash' : '/bin/bash',
    homeMode: fam === 'debian' ? 0o750 : 0o700,
    lockedHash: fam === 'redhat' ? '!!' : '!',
  };
}

function shadowFor(db: UserDb, name: string): ShadowEntry {
  let s = db.shadow.find((e) => e.name === name);
  if (!s) {
    s = { name, hash: '!', lastChange: String(today()), min: '0', max: '99999', warn: '7', inactive: '', expire: '', reserved: '' };
    db.shadow.push(s);
  }
  return s;
}

/** Skapar hemkatalogen och kopierar in filerna från /etc/skel. */
function makeHome(sh: Shell, ctx: Sink, prog: string, entry: PasswdEntry, group: string): void {
  const vfs = sh.vfs;
  if (vfs.tryLookup(entry.home, ROOT)) {
    ctx.err(`${prog}: warning: the home directory ${entry.home} already exists.\n${prog}: Not copying any file from skel directory into it.\n`);
    return;
  }
  try {
    vfs.mkdir(entry.home, ROOT);
  } catch (e) {
    ctx.err(`${prog}: cannot create directory ${entry.home}: ${fsMessage(e)}\n`);
    return;
  }
  const home = vfs.lookup(entry.home, ROOT);
  home.owner = entry.name;
  home.group = group;
  home.mode = defaults(sh).homeMode;
  const skel = vfs.tryLookup('/etc/skel', ROOT);
  const chownTree = (n: FsNode) => {
    n.owner = entry.name;
    n.group = group;
    n.mtime = Date.now();
    for (const c of Object.values(n.children ?? {})) chownTree(c);
  };
  for (const [name, node] of Object.entries(skel?.children ?? {})) {
    const copy = cloneNode(node);
    chownTree(copy);
    home.children![name] = copy;
  }
}

function removeTree(sh: Shell, path: string): boolean {
  try {
    sh.vfs.remove(path, ROOT);
    return true;
  } catch (e) {
    if (e instanceof FsError) return false;
    throw e;
  }
}

interface NewUser {
  name: string;
  uid?: number;
  /** Primär grupp (namn eller nummer). Saknas: en egen grupp med samma namn skapas. */
  group?: string;
  groups: string[];
  comment: string;
  home?: string;
  shell: string;
  createHome: boolean;
  system: boolean;
}

/** Lägger till användaren i databasen (och eventuellt hemkatalogen). Returnerar null vid fel. */
function createUser(sh: Shell, io: Sink, prog: string, opts: NewUser): { entry: PasswdEntry; group: GroupEntry } | null {
  const db = loadDb(sh);
  const uids = db.passwd.map((e) => e.uid);
  const uid = opts.uid ?? nextId(uids, opts.system);
  if (opts.uid !== undefined && uids.includes(opts.uid)) {
    io.err(`${prog}: UID ${opts.uid} is not unique\n`);
    return null;
  }
  let group: GroupEntry | undefined;
  if (opts.group !== undefined) {
    group = db.group.find((g) => g.name === opts.group || String(g.gid) === opts.group);
    if (!group) {
      io.err(`${prog}: group '${opts.group}' does not exist\n`);
      return null;
    }
  } else {
    const gids = db.group.map((g) => g.gid);
    const gid = gids.includes(uid) ? nextId(gids, opts.system) : uid;
    group = { name: opts.name, password: 'x', gid, members: [] };
    db.group.push(group);
  }
  for (const g of opts.groups) {
    const entry = db.group.find((e) => e.name === g);
    if (entry && !entry.members.includes(opts.name)) entry.members.push(opts.name);
  }
  const entry: PasswdEntry = {
    name: opts.name,
    password: 'x',
    uid,
    gid: group.gid,
    gecos: opts.comment,
    home: opts.home ?? `/home/${opts.name}`,
    shell: opts.shell,
  };
  db.passwd.push(entry);
  db.shadow = db.shadow.filter((s) => s.name !== opts.name);
  db.shadow.push({
    name: opts.name,
    hash: defaults(sh).lockedHash,
    lastChange: String(today()),
    min: opts.system ? '' : '0',
    max: opts.system ? '' : '99999',
    warn: opts.system ? '' : '7',
    inactive: '',
    expire: '',
    reserved: '',
  });
  saveDb(sh, db);
  if (opts.createHome) makeHome(sh, io, prog, entry, group.name);
  return { entry, group };
}

function checkGroups(io: Sink, sh: Shell, prog: string, list: string[]): boolean {
  for (const g of list) {
    if (!findGroup(sh, g)) {
      io.err(`${prog}: group '${g}' does not exist\n`);
      return false;
    }
  }
  return true;
}

const splitList = (s: string | undefined) => (s ?? '').split(',').filter(Boolean);

// ---------- useradd ----------

const useradd: CommandDef = {
  name: 'useradd',
  summary: 'Skapar en ny användare (kräver root)',
  summaryEn: 'Create a new user (needs root)',
  man: `NAMN
       useradd - skapa en ny användare

SYNOPSIS
       useradd [FLAGGOR] ANVÄNDARE

BESKRIVNING
       Lägger till användaren i /etc/passwd, /etc/shadow och (med en egen
       grupp med samma namn) i /etc/group. Nya användare får nästa lediga
       UID från 1000 och uppåt. Kontot har inget lösenord förrän du sätter
       ett med passwd.

       Standardvärdena skiljer sig mellan distributionerna: i Debian och
       Arch skapas ingen hemkatalog utan -m, och i Debian blir skalet
       /bin/sh om du inte anger -s. Fedora skapar hemkatalogen automatiskt.

FLAGGOR
       -m           skapa hemkatalogen (och kopiera filerna i /etc/skel)
       -M           skapa ingen hemkatalog
       -s SKAL      inloggningsskal, t.ex. /bin/bash
       -G GRUPPER   extra grupper, kommaseparerade (t.ex. sudo,utvecklare)
       -g GRUPP     primär grupp i stället för en egen grupp
       -c TEXT      kommentar, oftast det fullständiga namnet
       -d KATALOG   annan hemkatalog än /home/ANVÄNDARE
       -u UID       välj UID själv
       -r           systemanvändare (UID under 1000, ingen hemkatalog)
       -D           visa standardvärdena

EXEMPEL
       sudo useradd -m -s /bin/bash kim
       sudo useradd -m -c "Kim Svensson" -G utvecklare kim`,
  manEn: `NAME
       useradd - create a new user

SYNOPSIS
       useradd [OPTIONS] USER

DESCRIPTION
       Adds the user to /etc/passwd, /etc/shadow and (with a private group
       of the same name) to /etc/group. New users get the next free UID
       from 1000 upwards. The account has no password until you set one
       with passwd.

       The defaults differ between distributions: Debian and Arch create
       no home directory without -m, and on Debian the shell is /bin/sh
       unless you give -s. Fedora creates the home directory by default.

OPTIONS
       -m           create the home directory (copying the files in /etc/skel)
       -M           do not create a home directory
       -s SHELL     login shell, e.g. /bin/bash
       -G GROUPS    supplementary groups, comma separated (e.g. sudo,developers)
       -g GROUP     primary group instead of a private group
       -c TEXT      comment, usually the full name
       -d DIR       home directory other than /home/USER
       -u UID       choose the UID yourself
       -r           system user (UID below 1000, no home directory)
       -D           show the defaults

EXAMPLES
       sudo useradd -m -s /bin/bash kim
       sudo useradd -m -c "Kim Svensson" -G developers kim`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'mMrDUN',
      values: 'sGgcdue',
      long: {
        'create-home': 'm', 'no-create-home': 'M', system: 'r', defaults: 'D', 'user-group': 'U', 'no-user-group': 'N',
        shell: 's', groups: 'G', gid: 'g', comment: 'c', 'home-dir': 'd', uid: 'u', expiredate: 'e',
      },
    });
    if (o.error) return badOption(ctx, o.error, 2);
    const d = defaults(sh);
    if (o.flags.has('D')) {
      ctx.out(`GROUP=100\nHOME=/home\nINACTIVE=-1\nEXPIRE=\nSHELL=${d.shell}\nSKEL=/etc/skel\nCREATE_MAIL_SPOOL=no\n`);
      return 0;
    }
    if (o.operands.length !== 1) {
      ctx.err(`Usage: useradd [options] LOGIN\n       useradd -D\n\nTry 'man useradd' for the options.\n`);
      return 2;
    }
    const name = o.operands[0];
    if (!isRoot(sh)) return denied(ctx);
    if (!validName(name)) {
      ctx.err(`useradd: invalid user name '${name}': use --badname to ignore\n`);
      if (/[A-ZÅÄÖåäö]/.test(name)) ctx.err(dim(sh, 'Tips: användarnamn skrivs med små bokstäver a–z, utan å, ä och ö.', 'Tip: user names use lowercase letters a–z.'));
      return 3;
    }
    if (findUser(sh, name)) {
      ctx.err(`useradd: user '${name}' already exists\n`);
      return 9;
    }
    const groups = splitList(o.values.G);
    if (!checkGroups(ctx, sh, 'useradd', groups)) return 6;
    const uid = o.values.u !== undefined ? Number(o.values.u) : undefined;
    if (uid !== undefined && !Number.isInteger(uid)) {
      ctx.err(`useradd: invalid user ID '${o.values.u}'\n`);
      return 3;
    }
    const system = o.flags.has('r');
    const created = createUser(sh, ctx, 'useradd', {
      name,
      uid,
      group: o.values.g,
      groups,
      comment: o.values.c ?? '',
      home: o.values.d,
      shell: o.values.s ?? d.shell,
      createHome: o.flags.has('m') || (d.createHome && !system && !o.flags.has('M')),
      system,
    });
    if (!created) return 6;
    if (o.values.e) {
      const db = loadDb(sh);
      const days = Math.floor(Date.parse(o.values.e) / 86_400_000);
      if (Number.isFinite(days)) shadowFor(db, name).expire = String(days);
      saveDb(sh, db);
    }
    return 0;
  },
};

// ---------- usermod ----------

const usermod: CommandDef = {
  name: 'usermod',
  summary: 'Ändrar en användare: grupper, skal, låsning (kräver root)',
  summaryEn: 'Modify a user: groups, shell, locking (needs root)',
  man: `NAMN
       usermod - ändra ett användarkonto

SYNOPSIS
       usermod [FLAGGOR] ANVÄNDARE

FLAGGOR
       -aG GRUPPER  lägg till användaren i grupperna (append)
       -G GRUPPER   sätt EXAKT vilka extra grupper användaren har – utan -a
                    försvinner användaren ur alla andra grupper!
       -g GRUPP     byt primär grupp
       -s SKAL      byt inloggningsskal
       -c TEXT      byt kommentar (fullständigt namn)
       -d KATALOG   byt hemkatalog (-m flyttar också innehållet)
       -L           lås kontot (sätter ! framför lösenordshashen)
       -U           lås upp kontot
       -e DATUM     kontot slutar gälla DATUM (ÅÅÅÅ-MM-DD)

BESKRIVNING
       Ändringar i gruppmedlemskap gäller först nästa gång användaren
       loggar in.

EXEMPEL
       sudo usermod -aG sudo kim       (Debian/Ubuntu)
       sudo usermod -aG wheel kim      (Arch/Fedora)
       sudo usermod -s /bin/bash kim
       sudo usermod -L kim`,
  manEn: `NAME
       usermod - modify a user account

SYNOPSIS
       usermod [OPTIONS] USER

OPTIONS
       -aG GROUPS   add the user to the groups (append)
       -G GROUPS    set EXACTLY which supplementary groups the user has –
                    without -a the user is removed from all other groups!
       -g GROUP     change the primary group
       -s SHELL     change the login shell
       -c TEXT      change the comment (full name)
       -d DIR       change the home directory (-m also moves the contents)
       -L           lock the account (puts ! in front of the password hash)
       -U           unlock the account
       -e DATE      the account expires on DATE (YYYY-MM-DD)

DESCRIPTION
       Group membership changes take effect the next time the user logs in.

EXAMPLES
       sudo usermod -aG sudo kim       (Debian/Ubuntu)
       sudo usermod -aG wheel kim      (Arch/Fedora)
       sudo usermod -s /bin/bash kim
       sudo usermod -L kim`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'aLUm',
      values: 'Ggscde',
      long: {
        append: 'a', lock: 'L', unlock: 'U', 'move-home': 'm', groups: 'G', gid: 'g', shell: 's', comment: 'c', home: 'd', expiredate: 'e',
      },
    });
    if (o.error) return badOption(ctx, o.error, 2);
    const changes = ['L', 'U'].some((f) => o.flags.has(f)) || Object.keys(o.values).length > 0;
    if (o.operands.length !== 1 || !changes) {
      ctx.err(`Usage: usermod [options] LOGIN\n\nTry 'man usermod' for the options.\n`);
      return 2;
    }
    if (o.flags.has('a') && o.values.G === undefined) {
      ctx.err(`usermod: -a flag is ONLY allowed with the -G flag\nTry 'man usermod' for the options.\n`);
      return 2;
    }
    const name = o.operands[0];
    if (!isRoot(sh)) return denied(ctx);
    const db = loadDb(sh);
    const entry = db.passwd.find((e) => e.name === name);
    if (!entry) {
      ctx.err(`usermod: user '${name}' does not exist\n`);
      return 6;
    }
    if (o.values.G !== undefined) {
      const list = splitList(o.values.G);
      if (!checkGroups(ctx, sh, 'usermod', list)) return 6;
      for (const g of db.group) {
        const wanted = list.includes(g.name);
        if (wanted && !g.members.includes(name)) g.members.push(name);
        if (!wanted && !o.flags.has('a') && g.members.includes(name)) g.members = g.members.filter((m) => m !== name);
      }
    }
    if (o.values.g !== undefined) {
      const g = db.group.find((e) => e.name === o.values.g || String(e.gid) === o.values.g);
      if (!g) {
        ctx.err(`usermod: group '${o.values.g}' does not exist\n`);
        return 6;
      }
      entry.gid = g.gid;
    }
    if (o.values.s !== undefined) entry.shell = o.values.s;
    if (o.values.c !== undefined) entry.gecos = o.values.c;
    if (o.values.d !== undefined) {
      const old = entry.home;
      entry.home = o.values.d;
      if (o.flags.has('m')) {
        const node = sh.vfs.tryLookup(old, ROOT);
        if (node) {
          try {
            sh.vfs.insert(o.values.d, node, ROOT);
            sh.vfs.remove(old, ROOT);
          } catch (e) {
            ctx.err(`usermod: cannot rename directory ${old} to ${o.values.d}: ${fsMessage(e)}\n`);
            return 12;
          }
        }
      }
    }
    const shadow = shadowFor(db, name);
    if (o.flags.has('L') && !shadow.hash.startsWith('!')) shadow.hash = '!' + shadow.hash;
    if (o.flags.has('U')) {
      const unlocked = shadow.hash.replace(/^!/, '');
      if (unlocked === '' || unlocked === '!') {
        ctx.err(`usermod: unlocking the user's password would result in a passwordless account.\nYou should set a password with usermod -p to unlock this user's password.\n`);
      } else shadow.hash = unlocked;
    }
    if (o.values.e !== undefined) {
      const days = Math.floor(Date.parse(o.values.e) / 86_400_000);
      shadow.expire = o.values.e === '' || o.values.e === '-1' ? '' : Number.isFinite(days) ? String(days) : shadow.expire;
    }
    saveDb(sh, db);
    return 0;
  },
};

// ---------- userdel ----------

function deleteUser(sh: Shell, io: Sink, prog: string, name: string, removeHome: boolean, force: boolean): number {
  const db = loadDb(sh);
  const entry = db.passwd.find((e) => e.name === name);
  if (!entry) {
    io.err(`${prog}: user '${name}' does not exist\n`);
    return 6;
  }
  if (sh.userStack.includes(name) && !force) {
    io.err(`${prog}: user ${name} is currently used by process 1290\n`);
    return 8;
  }
  db.passwd = db.passwd.filter((e) => e.name !== name);
  db.shadow = db.shadow.filter((s) => s.name !== name);
  for (const g of db.group) g.members = g.members.filter((m) => m !== name);
  // Den egna gruppen tas bort om ingen annan använder den.
  const own = db.group.find((g) => g.gid === entry.gid && g.name === name);
  if (own && !own.members.length && !db.passwd.some((e) => e.gid === own.gid)) db.group = db.group.filter((g) => g !== own);
  saveDb(sh, db);
  if (removeHome) {
    if (sh.distro.family === 'debian') io.err(`${prog}: ${name} mail spool (/var/mail/${name}) not found\n`);
    if (!removeTree(sh, entry.home)) io.err(`${prog}: ${name} home directory (${entry.home}) not found\n`);
  }
  return 0;
}

const userdel: CommandDef = {
  name: 'userdel',
  summary: 'Tar bort en användare (kräver root)',
  summaryEn: 'Delete a user (needs root)',
  man: `NAMN
       userdel - ta bort ett användarkonto

SYNOPSIS
       userdel [-r] ANVÄNDARE

BESKRIVNING
       Tar bort användaren ur /etc/passwd, /etc/shadow och /etc/group.
       Utan -r ligger hemkatalogen och filerna kvar.

FLAGGOR
       -r    ta också bort hemkatalogen
       -f    ta bort även om användaren är inloggad

EXEMPEL
       sudo userdel -r vikarie`,
  manEn: `NAME
       userdel - delete a user account

SYNOPSIS
       userdel [-r] USER

DESCRIPTION
       Removes the user from /etc/passwd, /etc/shadow and /etc/group.
       Without -r the home directory and files are left behind.

OPTIONS
       -r    also remove the home directory
       -f    remove even if the user is logged in

EXAMPLES
       sudo userdel -r substitute`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'rf', long: { remove: 'r', force: 'f' } });
    if (o.error) return badOption(ctx, o.error, 2);
    if (o.operands.length !== 1) {
      ctx.err(`Usage: userdel [options] LOGIN\n\nOptions:\n  -f, --force    force removal of files, even if not owned by user\n  -r, --remove   remove home directory and mail spool\n`);
      return 2;
    }
    if (!isRoot(ctx.sh)) return denied(ctx);
    return deleteUser(ctx.sh, ctx, 'userdel', o.operands[0], o.flags.has('r'), o.flags.has('f'));
  },
};

// ---------- groupadd, groupdel, gpasswd ----------

function addGroup(sh: Shell, io: Sink, prog: string, name: string, system: boolean, gidArg?: string): number {
  if (!validName(name)) {
    io.err(`${prog}: '${name}' is not a valid group name\n`);
    return 3;
  }
  const db = loadDb(sh);
  if (db.group.some((g) => g.name === name)) {
    io.err(`${prog}: group '${name}' already exists\n`);
    return 9;
  }
  const gids = db.group.map((g) => g.gid);
  const gid = gidArg !== undefined ? Number(gidArg) : nextId(gids, system);
  if (!Number.isInteger(gid)) {
    io.err(`${prog}: invalid group ID '${gidArg}'\n`);
    return 3;
  }
  if (gidArg !== undefined && gids.includes(gid)) {
    io.err(`${prog}: GID '${gid}' already exists\n`);
    return 4;
  }
  db.group.push({ name, password: 'x', gid, members: [] });
  saveDb(sh, db);
  return 0;
}

const groupadd: CommandDef = {
  name: 'groupadd',
  summary: 'Skapar en ny grupp (kräver root)',
  summaryEn: 'Create a new group (needs root)',
  man: `NAMN
       groupadd - skapa en ny grupp

SYNOPSIS
       groupadd [-g GID] [-r] GRUPP

BESKRIVNING
       Lägger till gruppen i /etc/group. Nya grupper får nästa lediga GID
       från 1000 och uppåt. Lägg till medlemmar med "usermod -aG" eller
       "gpasswd -a".

FLAGGOR
       -g GID   välj grupp-id själv
       -r       systemgrupp (GID under 1000)
       -f       inget fel om gruppen redan finns

EXEMPEL
       sudo groupadd utvecklare`,
  manEn: `NAME
       groupadd - create a new group

SYNOPSIS
       groupadd [-g GID] [-r] GROUP

DESCRIPTION
       Adds the group to /etc/group. New groups get the next free GID from
       1000 upwards. Add members with "usermod -aG" or "gpasswd -a".

OPTIONS
       -g GID   choose the group ID yourself
       -r       system group (GID below 1000)
       -f       no error if the group already exists

EXAMPLES
       sudo groupadd developers`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { flags: 'rf', values: 'g', long: { system: 'r', force: 'f', gid: 'g' } });
    if (o.error) return badOption(ctx, o.error, 2);
    if (o.operands.length !== 1) {
      ctx.err(`Usage: groupadd [options] GROUP\n\nTry 'man groupadd' for the options.\n`);
      return 2;
    }
    if (!isRoot(sh)) {
      ctx.err(`groupadd: Permission denied.\ngroupadd: cannot lock /etc/group; try again later.\n`);
      return 10;
    }
    if (o.flags.has('f') && findGroup(sh, o.operands[0])) return 0;
    return addGroup(sh, ctx, 'groupadd', o.operands[0], o.flags.has('r'), o.values.g);
  },
};

function delGroup(sh: Shell, io: Sink, prog: string, name: string): number {
  const db = loadDb(sh);
  const group = db.group.find((g) => g.name === name);
  if (!group) {
    io.err(`${prog}: group '${name}' does not exist\n`);
    return 6;
  }
  const user = db.passwd.find((e) => e.gid === group.gid);
  if (user) {
    io.err(`${prog}: cannot remove the primary group of user '${user.name}'\n`);
    return 8;
  }
  db.group = db.group.filter((g) => g !== group);
  saveDb(sh, db);
  return 0;
}

const groupdel: CommandDef = {
  name: 'groupdel',
  summary: 'Tar bort en grupp (kräver root)',
  summaryEn: 'Delete a group (needs root)',
  man: `NAMN
       groupdel - ta bort en grupp

SYNOPSIS
       groupdel GRUPP

BESKRIVNING
       Det går inte att ta bort en grupp som är någons primära grupp.`,
  manEn: `NAME
       groupdel - delete a group

SYNOPSIS
       groupdel GROUP

DESCRIPTION
       A group that is someone's primary group cannot be removed.`,
  run(ctx) {
    if (ctx.args.length !== 1 || ctx.args[0].startsWith('-')) {
      ctx.err(`Usage: groupdel [options] GROUP\n`);
      return 2;
    }
    if (!isRoot(ctx.sh)) {
      ctx.err(`groupdel: Permission denied.\ngroupdel: cannot lock /etc/group; try again later.\n`);
      return 10;
    }
    return delGroup(ctx.sh, ctx, 'groupdel', ctx.args[0]);
  },
};

const gpasswd: CommandDef = {
  name: 'gpasswd',
  summary: 'Lägger till eller tar bort medlemmar i en grupp',
  summaryEn: 'Add or remove members of a group',
  man: `NAMN
       gpasswd - administrera /etc/group

SYNOPSIS
       gpasswd -a ANVÄNDARE GRUPP
       gpasswd -d ANVÄNDARE GRUPP

FLAGGOR
       -a ANVÄNDARE   lägg till användaren i gruppen
       -d ANVÄNDARE   ta bort användaren ur gruppen
       -M LISTA       sätt hela medlemslistan (kommaseparerad)

EXEMPEL
       sudo gpasswd -a kim utvecklare
       sudo gpasswd -d kim utvecklare`,
  manEn: `NAME
       gpasswd - administer /etc/group

SYNOPSIS
       gpasswd -a USER GROUP
       gpasswd -d USER GROUP

OPTIONS
       -a USER   add the user to the group
       -d USER   remove the user from the group
       -M LIST   set the whole member list (comma separated)

EXAMPLES
       sudo gpasswd -a kim developers
       sudo gpasswd -d kim developers`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { values: 'adM', long: { add: 'a', delete: 'd', members: 'M' } });
    if (o.error || o.operands.length !== 1 || Object.keys(o.values).length !== 1) {
      ctx.err(`Usage: gpasswd [option] GROUP\n\nOptions:\n  -a, --add USER                add USER to GROUP\n  -d, --delete USER             remove USER from GROUP\n  -M, --members USER,...        set the list of members of GROUP\n`);
      return 2;
    }
    const groupName = o.operands[0];
    if (!isRoot(sh)) {
      ctx.err(`gpasswd: Permission denied.\n`);
      return 1;
    }
    const db = loadDb(sh);
    const group = db.group.find((g) => g.name === groupName);
    if (!group) {
      ctx.err(`gpasswd: group '${groupName}' does not exist in /etc/group\n`);
      return 3;
    }
    const users = o.values.M !== undefined ? splitList(o.values.M) : [o.values.a ?? o.values.d];
    for (const u of users) {
      if (!db.passwd.some((e) => e.name === u)) {
        ctx.err(`gpasswd: user '${u}' does not exist\n`);
        return 3;
      }
    }
    if (o.values.a !== undefined) {
      ctx.out(`Adding user ${o.values.a} to group ${groupName}\n`);
      if (!group.members.includes(o.values.a)) group.members.push(o.values.a);
    } else if (o.values.d !== undefined) {
      if (!group.members.includes(o.values.d)) {
        ctx.err(`gpasswd: user '${o.values.d}' is not a member of '${groupName}'\n`);
        return 3;
      }
      ctx.out(`Removing user ${o.values.d} from group ${groupName}\n`);
      group.members = group.members.filter((m) => m !== o.values.d);
    } else {
      group.members = users;
    }
    saveDb(sh, db);
    return 0;
  },
};

// ---------- passwd, chpasswd, chage ----------

/** Frågar efter nytt lösenord två gånger och sparar det. done() anropas efteråt. */
function askNewPassword(sh: Shell, name: string, done: (ok: boolean, io: Sink) => number): void {
  sh.askText(
    'New password: ',
    (first) => {
      sh.askText(
        'Retype new password: ',
        (second, io) => {
          const redhat = sh.distro.family === 'redhat';
          if (first !== second || first === '') {
            io.err(first === '' ? 'No password has been supplied.\n' : 'Sorry, passwords do not match.\n');
            io.err(`passwd: Authentication token manipulation error\n${redhat ? '' : 'passwd: password unchanged\n'}`);
            return done(false, io);
          }
          setPassword(sh, name, first);
          io.out(redhat ? 'passwd: all authentication tokens updated successfully.\n' : 'passwd: password updated successfully\n');
          return done(true, io);
        },
        true,
      );
      return 0;
    },
    true,
  );
}

function setPassword(sh: Shell, name: string, password: string): void {
  const db = loadDb(sh);
  const s = shadowFor(db, name);
  s.hash = hashPassword(password);
  s.lastChange = String(today());
  saveDb(sh, db);
}

const passwd: CommandDef = {
  name: 'passwd',
  summary: 'Byter lösenord (ditt eget, eller andras som root)',
  summaryEn: "Change a password (your own, or other users' as root)",
  man: `NAMN
       passwd - byt lösenord

SYNOPSIS
       passwd [FLAGGOR] [ANVÄNDARE]

BESKRIVNING
       Utan ANVÄNDARE byter du ditt eget lösenord. Bara root får byta
       lösenord åt andra: sudo passwd kim. Lösenordet skrivs två gånger
       och syns inte när du skriver. Det sparas som en hash i /etc/shadow.

FLAGGOR
       -l    lås lösenordet (kontot går inte att logga in på med lösenord)
       -u    lås upp
       -d    ta bort lösenordet
       -e    tvinga användaren att byta lösenord vid nästa inloggning
       -S    visa status: P (har lösenord), L (låst), NP (inget lösenord)

EXEMPEL
       passwd
       sudo passwd kim
       sudo passwd -S kim`,
  manEn: `NAME
       passwd - change a password

SYNOPSIS
       passwd [OPTIONS] [USER]

DESCRIPTION
       Without USER you change your own password. Only root may change
       other users' passwords: sudo passwd kim. The password is typed
       twice and is not shown as you type. It is stored as a hash in
       /etc/shadow.

OPTIONS
       -l    lock the password (no password logins for the account)
       -u    unlock
       -d    delete the password
       -e    force the user to change password at the next login
       -S    show status: P (has a password), L (locked), NP (no password)

EXAMPLES
       passwd
       sudo passwd kim
       sudo passwd -S kim`,
  run(ctx) {
    const sh = ctx.sh;
    const redhat = sh.distro.family === 'redhat';
    const longs: Record<string, string> = { lock: 'l', unlock: 'u', delete: 'd', expire: 'e', status: 'S' };
    if (redhat) longs.stdin = 'i';
    const o = parseOpts(ctx.args, { flags: 'luedS', long: longs });
    if (o.error) return badOption(ctx, o.error, 2);
    const me = sh.currentUser();
    const name = o.operands[0] ?? me.name;
    if (name !== me.name && me.uid !== 0) {
      ctx.err(redhat ? 'passwd: Only root can specify a user name.\n' : `passwd: You may not view or modify password information for ${name}.\n`);
      return 1;
    }
    if (!findUser(sh, name)) {
      ctx.err(redhat ? `passwd: Unknown user name '${name}'.\n` : `passwd: user '${name}' does not exist\n`);
      return 1;
    }
    const action = ['l', 'u', 'd', 'e', 'S'].find((f) => o.flags.has(f));
    if (action) {
      if (me.uid !== 0 && action !== 'S') {
        ctx.err('passwd: Permission denied.\n');
        return 1;
      }
      const db = loadDb(sh);
      const s = shadowFor(db, name);
      if (action === 'S') {
        const date = s.lastChange ? new Date(Number(s.lastChange) * 86_400_000).toISOString().slice(0, 10) : '';
        ctx.out(`${name} ${passwordStatus(s.hash)} ${date} ${s.min || 0} ${s.max || 99999} ${s.warn || 7} ${s.inactive || -1}\n`);
        return 0;
      }
      const verbs: Record<string, string> = { l: 'Locking password', u: 'Unlocking password', d: 'Removing password', e: 'Expiring password' };
      if (action === 'l' && !s.hash.startsWith('!')) s.hash = '!' + s.hash;
      if (action === 'u') {
        const unlocked = s.hash.replace(/^!/, '');
        if (unlocked === '' || unlocked === '!') {
          ctx.err(`passwd: unlocking the password would result in a passwordless account.\nYou should set a password with usermod -p to unlock the password of this account.\n`);
          return 3;
        }
        s.hash = unlocked;
      }
      if (action === 'd') s.hash = '';
      if (action === 'e') s.lastChange = '0';
      saveDb(sh, db);
      ctx.out(redhat ? `${verbs[action]} for user ${name}.\npasswd: Success\n` : 'passwd: password changed.\n');
      return 0;
    }
    if (o.flags.has('i') || (ctx.stdin !== null && !sh.canAskInteractively())) {
      // Läs lösenordet från stdin (Fedoras passwd --stdin, eller i skript).
      const pw = (ctx.stdin ?? '').split('\n')[0];
      if (!pw) {
        ctx.err('passwd: Authentication token manipulation error\n');
        return 10;
      }
      setPassword(sh, name, pw);
      ctx.out(redhat ? `Changing password for user ${name}.\npasswd: all authentication tokens updated successfully.\n` : 'passwd: password updated successfully\n');
      return 0;
    }
    if (!sh.canAskInteractively()) {
      ctx.err('passwd: Authentication token manipulation error\npasswd: password unchanged\n');
      return 10;
    }
    if (redhat) ctx.out(`Changing password for user ${name}.\n`);
    else if (me.uid !== 0) ctx.out(`Changing password for ${name}.\n`);
    if (me.uid !== 0) {
      ctx.out(dim(sh, '(Current password: – simulatorn hoppar över ditt nuvarande lösenord)', '(Current password: – the simulator skips your current password)'));
    }
    if (ctx.isTTY && !sh.flags.passwdNoticeShown) {
      sh.flags.passwdNoticeShown = true;
      ctx.out(dim(sh, 'Det du skriver syns inte – precis som i en riktig terminal. Skriv lösenordet och tryck Enter.', "What you type isn't shown – just like in a real terminal. Type the password and press Enter."));
    }
    askNewPassword(sh, name, (ok) => (ok ? 0 : 10));
    return 0;
  },
};

const chpasswd: CommandDef = {
  name: 'chpasswd',
  summary: 'Sätter lösenord från rader "användare:lösenord" (kräver root)',
  summaryEn: 'Set passwords from "user:password" lines (needs root)',
  man: `NAMN
       chpasswd - sätt lösenord för många användare på en gång

SYNOPSIS
       echo 'ANVÄNDARE:LÖSENORD' | sudo chpasswd

BESKRIVNING
       Läser rader på formen användare:lösenord från standard in.
       Praktiskt i skript.`,
  manEn: `NAME
       chpasswd - update passwords in batch

SYNOPSIS
       echo 'USER:PASSWORD' | sudo chpasswd

DESCRIPTION
       Reads lines of the form user:password from standard input.
       Handy in scripts.`,
  run(ctx) {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err('chpasswd: Permission denied.\nchpasswd: cannot lock /etc/shadow; try again later.\n');
      return 1;
    }
    let code = 0;
    (ctx.stdin ?? '').split('\n').forEach((line, i) => {
      if (!line.trim()) return;
      const colon = line.indexOf(':');
      const name = line.slice(0, colon);
      if (colon < 0) {
        ctx.err(`chpasswd: line ${i + 1}: missing new password\n`);
        code = 1;
      } else if (!findUser(sh, name)) {
        ctx.err(`chpasswd: line ${i + 1}: user '${name}' does not exist\n`);
        code = 1;
      } else setPassword(sh, name, line.slice(colon + 1));
    });
    return code;
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayDate = (days: number) => {
  const d = new Date(days * 86_400_000);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()}`;
};

const chage: CommandDef = {
  name: 'chage',
  summary: 'Visar eller ändrar när lösenord och konton går ut',
  summaryEn: 'Show or change password and account expiry',
  man: `NAMN
       chage - ändra när lösenord och konton går ut

SYNOPSIS
       chage -l ANVÄNDARE
       chage [FLAGGOR] ANVÄNDARE

FLAGGOR
       -l          visa uppgifterna (fälten i /etc/shadow, i klartext)
       -M DAGAR    lösenordet måste bytas efter så här många dagar
       -m DAGAR    minsta antal dagar mellan byten
       -W DAGAR    varna så här många dagar innan lösenordet går ut
       -E DATUM    kontot slutar gälla (ÅÅÅÅ-MM-DD, -1 = aldrig)
       -d 0        tvinga fram ett lösenordsbyte vid nästa inloggning

EXEMPEL
       chage -l elev
       sudo chage -M 90 kim
       sudo chage -E 2026-12-31 vikarie`,
  manEn: `NAME
       chage - change user password expiry information

SYNOPSIS
       chage -l USER
       chage [OPTIONS] USER

OPTIONS
       -l          list the information (the fields of /etc/shadow, in plain text)
       -M DAYS     the password must be changed after this many days
       -m DAYS     minimum number of days between changes
       -W DAYS     warn this many days before the password expires
       -E DATE     the account expires (YYYY-MM-DD, -1 = never)
       -d 0        force a password change at the next login

EXAMPLES
       chage -l elev
       sudo chage -M 90 kim
       sudo chage -E 2026-12-31 substitute`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'l',
      values: 'MmWEdI',
      long: { list: 'l', maxdays: 'M', mindays: 'm', warndays: 'W', expiredate: 'E', lastday: 'd', inactive: 'I' },
    });
    if (o.error) return badOption(ctx, o.error, 2);
    if (o.operands.length !== 1) {
      ctx.err(`Usage: chage [options] LOGIN\n\nTry 'man chage' for the options.\n`);
      return 2;
    }
    const name = o.operands[0];
    const me = sh.currentUser();
    const list = o.flags.has('l');
    if (me.uid !== 0 && !(list && name === me.name)) {
      ctx.err('chage: Permission denied.\n');
      return 1;
    }
    if (!findUser(sh, name)) {
      ctx.err(`chage: user '${name}' does not exist in /etc/passwd\n`);
      return 1;
    }
    const db = loadDb(sh);
    const s = shadowFor(db, name);
    if (list) {
      const last = s.lastChange === '' ? null : Number(s.lastChange);
      const max = s.max === '' ? 99999 : Number(s.max);
      const inactive = s.inactive === '' ? -1 : Number(s.inactive);
      const expires = last === 0 ? 'password must be changed' : last === null || max >= 99999 ? 'never' : dayDate(last + max);
      const rows: [string, string][] = [
        ['Last password change', last === 0 ? 'password must be changed' : last === null ? 'never' : dayDate(last)],
        ['Password expires', expires],
        ['Password inactive', last && max < 99999 && inactive >= 0 ? dayDate(last + max + inactive) : 'never'],
        ['Account expires', s.expire === '' ? 'never' : dayDate(Number(s.expire))],
        ['Minimum number of days between password change', s.min || '0'],
        ['Maximum number of days between password change', s.max || '99999'],
        ['Number of days of warning before password expires', s.warn || '7'],
      ];
      for (const [k, v] of rows) ctx.out(`${k.padEnd(56)}: ${v}\n`);
      return 0;
    }
    const num = (v: string | undefined, field: keyof ShadowEntry) => {
      if (v !== undefined) (s[field] as string) = v === '-1' ? '' : v;
    };
    num(o.values.M, 'max');
    num(o.values.m, 'min');
    num(o.values.W, 'warn');
    num(o.values.I, 'inactive');
    if (o.values.d !== undefined) s.lastChange = /^\d+$/.test(o.values.d) ? o.values.d : String(Math.floor(Date.parse(o.values.d) / 86_400_000));
    if (o.values.E !== undefined) {
      const days = Math.floor(Date.parse(o.values.E) / 86_400_000);
      if (o.values.E === '-1') s.expire = '';
      else if (Number.isFinite(days)) s.expire = String(days);
      else {
        ctx.err(`chage: invalid date '${o.values.E}'\n`);
        return 2;
      }
    }
    saveDb(sh, db);
    return 0;
  },
};

// ---------- adduser, deluser, addgroup, delgroup (Debian-familjen) ----------

/** Frågar efter fullständigt namn, och sedan om uppgifterna stämmer (som adduser gör). */
function askFullName(sh: Shell, name: string, io: Sink): void {
  io.out(`Changing the user information for ${name}\nEnter the new value, or press ENTER for the default\n`);
  sh.askText('\tFull Name []: ', (fullName, io2) => {
    io2.out(dim(sh, '(Rumsnummer, telefonnummer och "Other" hoppar simulatorn över.)', '(The simulator skips room number, phone numbers and "Other".)'));
    sh.ask('Is the information correct? [Y/n] ', true, (yes, io3) => {
      if (!yes) {
        askFullName(sh, name, io3);
        return 0;
      }
      const db = loadDb(sh);
      const entry = db.passwd.find((e) => e.name === name);
      if (entry) entry.gecos = `${fullName.trim()},,,`;
      const users = db.group.find((g) => g.name === 'users');
      if (users) {
        io3.out(`info: Adding new user \`${name}' to supplemental / extra groups \`users' ...\ninfo: Adding user \`${name}' to group \`users' ...\n`);
        if (!users.members.includes(name)) users.members.push(name);
      }
      saveDb(sh, db);
      return 0;
    });
    return 0;
  });
}

const adduser: CommandDef = {
  name: 'adduser',
  summary: 'Skapar en användare och frågar efter lösenord och namn (Debian)',
  summaryEn: 'Create a user, asking for password and name (Debian)',
  man: `NAMN
       adduser - lägg till en användare (eller en användare i en grupp)

SYNOPSIS
       adduser ANVÄNDARE
       adduser ANVÄNDARE GRUPP

BESKRIVNING
       adduser är ett vänligare skript runt useradd som finns i Debian och
       Ubuntu. Det skapar hemkatalog, sätter /bin/bash som skal och frågar
       efter lösenord och fullständigt namn.

       "adduser kim sudo" lägger till en befintlig användare i en grupp.

FLAGGOR
       --disabled-password   sätt inget lösenord (fråga inte)
       --comment TEXT        fullständigt namn (fråga inte); även --gecos
       --shell SKAL          annat skal än /bin/bash
       --home KATALOG        annan hemkatalog
       --system              skapa en systemanvändare

EXEMPEL
       sudo adduser kim
       sudo adduser kim sudo`,
  manEn: `NAME
       adduser - add a user (or a user to a group)

SYNOPSIS
       adduser USER
       adduser USER GROUP

DESCRIPTION
       adduser is a friendlier script around useradd found in Debian and
       Ubuntu. It creates the home directory, sets /bin/bash as the shell
       and asks for a password and full name.

       "adduser kim sudo" adds an existing user to a group.

OPTIONS
       --disabled-password   set no password (don't ask)
       --comment TEXT        full name (don't ask); also --gecos
       --shell SHELL         a shell other than /bin/bash
       --home DIR            another home directory
       --system              create a system user

EXAMPLES
       sudo adduser kim
       sudo adduser kim sudo`,
  run(ctx) {
    const sh = ctx.sh;
    // --disabled-password (P), --system (S), --group (G), --no-create-home (N); c, s, h, i och u tar värden.
    const o2 = parseOpts(ctx.args, {
      flags: 'qPSGN',
      values: 'cshiu',
      long: {
        'disabled-password': 'P', 'disabled-login': 'P', comment: 'c', gecos: 'c', shell: 's', home: 'h', system: 'S', quiet: 'q',
        group: 'G', ingroup: 'i', 'no-create-home': 'N', uid: 'u',
      },
    });
    if (o2.error) {
      ctx.err(`adduser: ${o2.error}\n`);
      return 1;
    }
    if (!isRoot(sh)) {
      ctx.err('fatal: Only root may add a user or group to the system.\n');
      return 1;
    }
    const [name, group] = o2.operands;
    if (!name || o2.operands.length > 2) {
      ctx.err('fatal: Only one or two names allowed.\n');
      return 1;
    }
    if (o2.flags.has('G')) return addGroupDeb(sh, ctx, name, o2.flags.has('S'));
    if (group !== undefined) {
      // adduser ANVÄNDARE GRUPP
      const db = loadDb(sh);
      const g = db.group.find((e) => e.name === group);
      if (!db.passwd.some((e) => e.name === name)) {
        ctx.err(`fatal: The user \`${name}' does not exist.\n`);
        return 1;
      }
      if (!g) {
        ctx.err(`fatal: The group \`${group}' does not exist.\n`);
        return 1;
      }
      if (g.members.includes(name)) {
        ctx.err(`info: The user \`${name}' is already a member of \`${group}'.\n`);
        return 0;
      }
      ctx.out(`info: Adding user \`${name}' to group \`${group}' ...\n`);
      g.members.push(name);
      saveDb(sh, db);
      return 0;
    }
    if (!validName(name)) {
      ctx.err(`fatal: Please enter a username matching the regular expression\nconfigured via the NAME_REGEX configuration variable.  Use the \`--allow-bad-names' option to relax this check or reconfigure NAME_REGEX.\n`);
      return 1;
    }
    if (findUser(sh, name)) {
      ctx.err(`fatal: The user \`${name}' already exists.\n`);
      return 1;
    }
    const system = o2.flags.has('S');
    const ingroup = o2.values.i;
    if (ingroup && !findGroup(sh, ingroup)) {
      ctx.err(`fatal: The group \`${ingroup}' does not exist.\n`);
      return 1;
    }
    const uid = o2.values.u !== undefined ? Number(o2.values.u) : undefined;
    const out = (s: string) => ctx.out(s);
    out(`info: Adding ${system ? 'system ' : ''}user \`${name}' ...\n`);
    out(system ? 'info: Selecting UID from range 100 to 999 ...\n' : 'info: Selecting UID/GID from range 1000 to 59999 ...\n');
    const created = createUser(sh, { out, err: (s) => ctx.err(s) }, 'adduser', {
      name,
      uid,
      group: ingroup ?? (system ? 'nogroup' : undefined),
      groups: [],
      comment: o2.values.c ?? '',
      home: o2.values.h ?? (system ? '/nonexistent' : undefined),
      shell: o2.values.s ?? (system ? '/usr/sbin/nologin' : '/bin/bash'),
      createHome: !system && !o2.flags.has('N'),
      system,
    });
    if (!created) return 1;
    const { entry, group: g } = created;
    // Meddelandena skrivs i efterhand men i samma ordning som det riktiga adduser.
    const info = [
      ...(ingroup || system ? [] : [`info: Adding new group \`${name}' (${g.gid}) ...`]),
      `info: Adding new user \`${name}' (${entry.uid}) with group \`${g.name} (${g.gid})' ...`,
      ...(system || o2.flags.has('N') ? [`info: Not creating home directory \`${entry.home}'.`] : [`info: Creating home directory \`${entry.home}' ...`, `info: Copying files from \`/etc/skel' ...`]),
    ];
    out(info.join('\n') + '\n');
    if (system) return 0;
    const afterPassword = (io: Sink) => {
      if (o2.values.c !== undefined) {
        const db = loadDb(sh);
        const users = db.group.find((e) => e.name === 'users');
        if (users && !users.members.includes(name)) {
          io.out(`info: Adding new user \`${name}' to supplemental / extra groups \`users' ...\ninfo: Adding user \`${name}' to group \`users' ...\n`);
          users.members.push(name);
          saveDb(sh, db);
        }
        return 0;
      }
      if (!sh.canAskInteractively()) return 0;
      askFullName(sh, name, io);
      return 0;
    };
    if (o2.flags.has('P') || !sh.canAskInteractively()) return afterPassword(ctx);
    askNewPassword(sh, name, (ok, io) => {
      if (!ok) io.err(dim(sh, `Inget lösenord sattes. Sätt det senare med: sudo passwd ${name}`, `No password was set. Set it later with: sudo passwd ${name}`));
      return afterPassword(io);
    });
    return 0;
  },
};

function addGroupDeb(sh: Shell, ctx: Sink, name: string, system: boolean): number {
  if (findGroup(sh, name)) {
    ctx.err(`fatal: The group \`${name}' already exists.\n`);
    return 1;
  }
  const code = addGroup(sh, ctx, 'addgroup', name, system);
  if (code === 0) ctx.out(`info: Selecting GID from range ${system ? '100 to 999' : '1000 to 59999'} ...\ninfo: Adding group \`${name}' (GID ${findGroup(sh, name)!.gid}) ...\n`);
  return code;
}

const addgroup: CommandDef = {
  name: 'addgroup',
  summary: 'Skapar en grupp (Debian)',
  summaryEn: 'Create a group (Debian)',
  man: `NAMN
       addgroup - skapa en grupp

SYNOPSIS
       addgroup [--system] GRUPP

BESKRIVNING
       Debians vänligare variant av groupadd.`,
  manEn: `NAME
       addgroup - create a group

SYNOPSIS
       addgroup [--system] GROUP

DESCRIPTION
       Debian's friendlier variant of groupadd.`,
  run(ctx) {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err('fatal: Only root may add a user or group to the system.\n');
      return 1;
    }
    const system = ctx.args.includes('--system');
    const names = ctx.args.filter((a) => !a.startsWith('--'));
    if (names.length === 2) return COMMANDS_BY_NAME.adduser.run({ ...ctx, name: 'adduser', args: names });
    if (names.length !== 1) {
      ctx.err('fatal: Only one or two names allowed.\n');
      return 1;
    }
    return addGroupDeb(sh, ctx, names[0], system);
  },
};

const deluser: CommandDef = {
  name: 'deluser',
  summary: 'Tar bort en användare, eller en användare ur en grupp (Debian)',
  summaryEn: 'Remove a user, or a user from a group (Debian)',
  man: `NAMN
       deluser - ta bort en användare (eller en användare ur en grupp)

SYNOPSIS
       deluser [--remove-home] ANVÄNDARE
       deluser ANVÄNDARE GRUPP

EXEMPEL
       sudo deluser --remove-home vikarie
       sudo deluser kim sudo`,
  manEn: `NAME
       deluser - remove a user (or a user from a group)

SYNOPSIS
       deluser [--remove-home] USER
       deluser USER GROUP

EXAMPLES
       sudo deluser --remove-home substitute
       sudo deluser kim sudo`,
  run(ctx) {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err('fatal: Only root may remove a user or group from the system.\n');
      return 1;
    }
    const removeHome = ctx.args.includes('--remove-home') || ctx.args.includes('--remove-all-files');
    const [name, group] = ctx.args.filter((a) => !a.startsWith('--'));
    if (!name) {
      ctx.err('fatal: No options allowed after names.\n');
      return 1;
    }
    const db = loadDb(sh);
    if (!db.passwd.some((e) => e.name === name)) {
      ctx.err(`fatal: The user \`${name}' does not exist.\n`);
      return 2;
    }
    if (group !== undefined) {
      const g = db.group.find((e) => e.name === group);
      if (!g) {
        ctx.err(`fatal: The group \`${group}' does not exist.\n`);
        return 3;
      }
      if (!g.members.includes(name)) {
        ctx.err(`fatal: The user \`${name}' is not a member of group \`${group}'.\n`);
        return 6;
      }
      ctx.out(`info: Removing user \`${name}' from group \`${group}' ...\n`);
      g.members = g.members.filter((m) => m !== name);
      saveDb(sh, db);
      return 0;
    }
    if (removeHome) ctx.out(`info: Looking for files to backup/remove ...\ninfo: Removing files ...\n`);
    ctx.out(`info: Removing crontab ...\ninfo: Removing user \`${name}' ...\n`);
    const quiet: Sink = { out: () => {}, err: (s) => (s.includes('mail spool') ? undefined : ctx.err(s)) };
    return deleteUser(sh, quiet, 'userdel', name, removeHome, false);
  },
};

const delgroup: CommandDef = {
  name: 'delgroup',
  summary: 'Tar bort en grupp (Debian)',
  summaryEn: 'Remove a group (Debian)',
  man: `NAMN
       delgroup - ta bort en grupp

SYNOPSIS
       delgroup GRUPP`,
  manEn: `NAME
       delgroup - remove a group

SYNOPSIS
       delgroup GROUP`,
  run(ctx) {
    const sh = ctx.sh;
    if (!isRoot(sh)) {
      ctx.err('fatal: Only root may remove a user or group from the system.\n');
      return 1;
    }
    const [name] = ctx.args;
    if (!name) return 1;
    if (!findGroup(sh, name)) {
      ctx.err(`fatal: The group \`${name}' does not exist.\n`);
      return 3;
    }
    const code = delGroup(sh, { out: (s) => ctx.out(s), err: (s) => ctx.err(s.replace('groupdel: ', 'fatal: ')) }, 'groupdel', name);
    if (code === 0) ctx.out(`info: Removing group \`${name}' ...\n`);
    return code;
  },
};

// ---------- chgrp ----------

const chgrp: CommandDef = {
  name: 'chgrp',
  summary: 'Byter grupp på filer',
  summaryEn: 'Change the group of files',
  man: `NAMN
       chgrp - byt grupp på filer

SYNOPSIS
       chgrp [-R] GRUPP FIL...

BESKRIVNING
       Du får byta grupp på dina egna filer till en grupp som du själv är
       medlem i. root får byta till vilken grupp som helst.

FLAGGOR
       -R    ändra rekursivt i kataloger

EXEMPEL
       chgrp utvecklare projekt.txt
       sudo chgrp -R utvecklare /srv/projekt`,
  manEn: `NAME
       chgrp - change the group of files

SYNOPSIS
       chgrp [-R] GROUP FILE...

DESCRIPTION
       You may change the group of your own files to a group you are a
       member of. root may change to any group.

OPTIONS
       -R    operate recursively on directories

EXAMPLES
       chgrp developers project.txt
       sudo chgrp -R developers /srv/project`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { flags: 'Rv', long: { recursive: 'R', verbose: 'v' } });
    if (o.error) return badOption(ctx, o.error);
    const [group, ...files] = o.operands;
    if (group === undefined) return badOption(ctx, 'missing operand');
    if (!files.length) return badOption(ctx, `missing operand after '${group}'`);
    if (!findGroup(sh, group)) {
      ctx.err(`chgrp: invalid group: '${group}'\n`);
      return 1;
    }
    const user = sh.currentUser();
    let code = 0;
    const apply = (label: string, node: FsNode) => {
      if (user.uid !== 0 && (node.owner !== user.name || !user.groups.includes(group))) {
        ctx.err(`chgrp: changing group of '${label}': Operation not permitted\n`);
        code = 1;
        return;
      }
      node.group = group;
      if (o.flags.has('R') && node.type === 'dir') for (const [n, c] of Object.entries(node.children!)) apply(`${label}/${n}`, c);
    };
    for (const f of files) {
      try {
        apply(f, sh.vfs.lookup(sh.resolve(f), user));
      } catch (e) {
        ctx.err(`chgrp: cannot access '${f}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

// ---------- who, w, last ----------

/** Klockslaget då eleven "loggade in" i dag. */
const LOGIN_TIME = '08:12';
const isoDay = (offsetDays = 0) => {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Den som är inloggad i terminalen – inte den man bytt till med su. */
const loginName = (sh: Shell) => sh.userStack[0] ?? 'elev';

const who: CommandDef = {
  name: 'who',
  summary: 'Visar vilka som är inloggade',
  summaryEn: 'Show who is logged in',
  man: `NAMN
       who - visa vilka som är inloggade

SYNOPSIS
       who [-b] [am i]

BESKRIVNING
       Visar en rad per inloggning: användare, terminal och tid.
       "su" och "sudo" räknas inte som nya inloggningar.

FLAGGOR
       -b    när datorn startades`,
  manEn: `NAME
       who - show who is logged on

SYNOPSIS
       who [-b] [am i]

DESCRIPTION
       Prints one line per login: user, terminal and time.
       "su" and "sudo" do not count as new logins.

OPTIONS
       -b    time of last system boot`,
  run(ctx) {
    if (ctx.args.includes('-b')) {
      ctx.out(`         system boot  ${isoDay()} 08:11\n`);
      return 0;
    }
    ctx.out(`${loginName(ctx.sh).padEnd(8)} pts/0        ${isoDay()} ${LOGIN_TIME}\n`);
    return 0;
  },
};

const w: CommandDef = {
  name: 'w',
  summary: 'Visar vilka som är inloggade och vad de gör',
  summaryEn: 'Show who is logged on and what they are doing',
  man: `NAMN
       w - visa vilka som är inloggade och vad de gör

BESKRIVNING
       Första raden är samma som uptime. Sedan kommer en rad per
       inloggning med kommandot som körs just nu (WHAT).

FLAGGOR
       -h    utan rubrikrader`,
  manEn: `NAME
       w - show who is logged on and what they are doing

DESCRIPTION
       The first line is the same as uptime. Then comes one line per login
       with the command currently running (WHAT).

OPTIONS
       -h    no header lines`,
  run(ctx) {
    if (!ctx.args.includes('-h')) {
      const load = currentProcs(ctx).reduce((s, p) => s + p.cpu, 0) / 100;
      ctx.out(` ${new Date().toTimeString().slice(0, 8)} up  2:14,  1 user,  load average: ${load.toFixed(2)}, ${(load * 0.9).toFixed(2)}, ${(load * 0.8).toFixed(2)}\n`);
      ctx.out('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT\n');
    }
    ctx.out(`${loginName(ctx.sh).padEnd(8)} pts/0    -                ${LOGIN_TIME}    0.00s  0.05s  0.00s ${['w', ...ctx.args].join(' ')}\n`);
    return 0;
  },
};

const last: CommandDef = {
  name: 'last',
  summary: 'Visar de senaste inloggningarna',
  summaryEn: 'Show the latest logins',
  man: `NAMN
       last - visa de senaste inloggningarna

SYNOPSIS
       last [-n ANTAL] [ANVÄNDARE]

BESKRIVNING
       Läser loggen /var/log/wtmp och visar inloggningar och omstarter,
       nyaste först.`,
  manEn: `NAME
       last - show a listing of the latest logins

SYNOPSIS
       last [-n NUMBER] [USER]

DESCRIPTION
       Reads the log /var/log/wtmp and shows logins and reboots, newest
       first.`,
  run(ctx) {
    const o = parseOpts(ctx.args, { values: 'n' });
    if (o.error) return badOption(ctx, o.error);
    const kernel = ctx.sh.distro.kernel.slice(0, 16).padEnd(16);
    const day = (offset: number) => {
      const d = new Date(Date.now() - offset * 86_400_000);
      return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)}`;
    };
    const me = loginName(ctx.sh);
    const rows = [
      { user: me, line: `${me.padEnd(8)} pts/0        :0               ${day(0)} ${LOGIN_TIME}   still logged in` },
      { user: 'reboot', line: `reboot   system boot  ${kernel} ${day(0)} 08:11   still running` },
      { user: me, line: `${me.padEnd(8)} pts/0        :0               ${day(1)} 13:55 - 17:02  (03:07)` },
      { user: 'reboot', line: `reboot   system boot  ${kernel} ${day(1)} 13:54 - 17:03  (03:08)` },
    ].filter((r) => !o.operands.length || o.operands.includes(r.user));
    const n = o.values.n !== undefined ? Number(o.values.n) : rows.length;
    for (const r of rows.slice(0, n)) ctx.out(r.line + '\n');
    ctx.out(`\nwtmp begins ${day(10)} 10:10:12 ${new Date().getFullYear()}\n`);
    return 0;
  },
};

// ---------- getent ----------

const getent: CommandDef = {
  name: 'getent',
  summary: 'Slår upp användare, grupper och värdnamn',
  summaryEn: 'Look up users, groups and host names',
  man: `NAMN
       getent - slå upp poster i systemets databaser

SYNOPSIS
       getent DATABAS [NYCKEL]...

BESKRIVNING
       Databaserna passwd, group, shadow och hosts. Utan NYCKEL visas
       alla poster. Fungerar även när användarna kommer från en server
       (t.ex. LDAP) och inte bara från /etc/passwd.

EXEMPEL
       getent passwd kim
       getent group sudo`,
  manEn: `NAME
       getent - get entries from the system databases

SYNOPSIS
       getent DATABASE [KEY]...

DESCRIPTION
       The databases passwd, group, shadow and hosts. Without KEY all
       entries are shown. Also works when users come from a server (e.g.
       LDAP) and not just from /etc/passwd.

EXAMPLES
       getent passwd kim
       getent group sudo`,
  run(ctx) {
    const sh = ctx.sh;
    const [db, ...keys] = ctx.args;
    if (!db) {
      ctx.err(`getent: wrong number of arguments\nTry \`getent --help' or \`getent --usage' for more information.\n`);
      return 1;
    }
    let lines: { keys: string[]; line: string }[];
    if (db === 'passwd' || db === 'group' || db === 'shadow') {
      const path = `/etc/${db}`;
      let text = '';
      try {
        text = sh.vfs.readFile(path, sh.currentUser());
      } catch {
        return 2;
      }
      lines = text
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => {
          const f = l.split(':');
          return { keys: db === 'shadow' ? [f[0]] : [f[0], f[2]], line: l };
        });
    } else if (db === 'hosts') {
      const text = sh.vfs.tryLookup('/etc/hosts', ROOT)?.content ?? '';
      lines = text
        .split('\n')
        .map((l) => l.replace(/#.*/, '').trim())
        .filter(Boolean)
        .map((l) => {
          const [ip, ...names] = l.split(/\s+/);
          return { keys: [ip, ...names], line: `${ip.padEnd(15)} ${names.join(' ')}` };
        });
    } else {
      ctx.err(`Unknown database: ${db}\nTry \`getent --help' or \`getent --usage' for more information.\n`);
      return 1;
    }
    if (!keys.length) {
      for (const l of lines) ctx.out(l.line + '\n');
      return 0;
    }
    let code = 0;
    for (const k of keys) {
      const hit = lines.find((l) => l.keys.includes(k));
      if (hit) ctx.out(hit.line + '\n');
      else code = 2;
    }
    return code;
  },
};

const COMMANDS_LIST: CommandDef[] = [
  useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd, chpasswd, chage,
  adduser, deluser, addgroup, delgroup, chgrp, who, w, last, getent,
];

const COMMANDS_BY_NAME: Record<string, CommandDef> = Object.fromEntries(COMMANDS_LIST.map((c) => [c.name, c]));

export const USER_COMMANDS: CommandDef[] = COMMANDS_LIST;

