// ssh, ssh-keygen och ssh-copy-id. Servern server.lan (192.168.1.10) är ett eget,
// litet skal (Debian) som lever i minnet så länge sidan är öppen. Kommandon som
// skickas med "ssh elev@server.lan KOMMANDO" körs där på riktigt.

import type { Shell } from '../shell';
import type { CmdCtx, CommandDef, Sink } from '../types';
import { connect, isLocal, markAsServer, MY_IP, resolveErrorText, resolveHost, service, SERVER_IP, SERVER_NAME } from '../network';
import { RUNAWAY_PID } from '../procs';
import { makeDir } from '../vfs';
import { COLOR, fsMessage, parseOpts } from './util';

const dim = (sh: Shell, text: { sv: string; en: string }) => `${COLOR.dim}${sh.msg(text)}${COLOR.reset}\n`;

const HOST_FP = 'SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw';
const HOST_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk3c2VydmVyLmxhbi1zaW11bGVyYWQtdsOkcmRueWNrZWw';

// ---------- Servern ----------

const SERVERS = new WeakMap<Shell, Shell>();
const keyFlag = (sh: Shell) => `net:ssh-key:${sh.currentUser().name}@${SERVER_NAME}`;

/** Servern som hör till elevens dator (skapas första gången den behövs). */
export function serverFor(sh: Shell): Shell {
  let server = SERVERS.get(sh);
  if (!server) {
    // Shell.create via konstruktorn – undviker en cirkulär import av shell.ts.
    server = (sh.constructor as typeof Shell).create('debian');
    server.distro = { ...server.distro, hostname: SERVER_NAME };
    markAsServer(server);
    const root = server.rootUser();
    server.vfs.writeFile('/etc/hostname', `${SERVER_NAME}\n`, root);
    server.vfs.writeFile('/etc/hosts', `127.0.0.1\tlocalhost\n127.0.1.1\t${SERVER_NAME}.lan ${SERVER_NAME}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n`, root);
    server.vfs.writeFile('/home/elev/välkommen.txt', 'Välkommen till servern! / Welcome to the server!\n', server.currentUser());
    server.proc.procs = server.proc.procs.filter((p) => p.pid !== RUNAWAY_PID);
    SERVERS.set(sh, server);
  }
  server.lang = sh.lang;
  // Nyckeln som ssh-copy-id lagt in (flaggan sparas, serverns filsystem gör det inte).
  const pub = publicKey(sh);
  if (sh.flags[keyFlag(sh)] && pub) addAuthorizedKey(server, pub);
  return server;
}

function addAuthorizedKey(server: Shell, pub: string): void {
  const user = server.getUser('elev');
  const dir = '/home/elev/.ssh';
  if (!server.vfs.tryLookup(dir, user)) server.vfs.insert(dir, makeDir('elev', 0o700, {}, 'elev'), user);
  const file = `${dir}/authorized_keys`;
  const existing = server.vfs.tryLookup(file, user)?.content ?? '';
  if (!existing.includes(pub.trim())) server.vfs.writeFile(file, existing + pub.trim() + '\n', user);
}

// ---------- Nycklar ----------

const sshDir = (sh: Shell) => `${sh.currentUser().home}/.ssh`;

function publicKey(sh: Shell, path?: string): string | null {
  const user = sh.currentUser();
  for (const p of path ? [path.endsWith('.pub') ? path : path + '.pub'] : ['id_ed25519.pub', 'id_ecdsa.pub', 'id_rsa.pub'].map((n) => `${sshDir(sh)}/${n}`)) {
    const node = sh.vfs.tryLookup(sh.resolve(p), user);
    if (node?.type === 'file' && node.content) return node.content;
  }
  return null;
}

function hasPrivateKey(sh: Shell): boolean {
  return ['id_ed25519', 'id_ecdsa', 'id_rsa'].some((n) => sh.vfs.tryLookup(`${sshDir(sh)}/${n}`, sh.currentUser())?.type === 'file');
}

function ensureSshDir(sh: Shell, io: Sink, announce: boolean): boolean {
  const dir = sshDir(sh);
  const user = sh.currentUser();
  if (sh.vfs.tryLookup(dir, user)) return true;
  try {
    sh.vfs.insert(dir, makeDir(user.name, 0o700, {}, user.groups[0]), user);
    if (announce) io.out(`Created directory '${dir}'.\n`);
    return true;
  } catch (e) {
    io.err(`${dir}: ${fsMessage(e)}\n`);
    return false;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const randomB64 = (n: number) => Array.from({ length: n }, () => B64[Math.floor(Math.random() * 64)]).join('');

/** "Randomart" som ssh-keygen ritar (drunken bishop-algoritmen). */
function randomArt(type: string, bits: number, fp: string): string {
  const field = Array.from({ length: 9 }, () => Array<number>(17).fill(0));
  let x = 8;
  let y = 4;
  for (const ch of fp.slice(7)) {
    let b = ch.charCodeAt(0);
    for (let i = 0; i < 4; i++) {
      x = Math.max(0, Math.min(16, x + (b & 1 ? 1 : -1)));
      y = Math.max(0, Math.min(8, y + (b & 2 ? 1 : -1)));
      field[y][x]++;
      b >>= 2;
    }
  }
  const chars = ' .o+=*BOX@%&#/^';
  const rows = field.map((row, ry) =>
    row.map((v, rx) => (rx === 8 && ry === 4 ? 'S' : rx === x && ry === y ? 'E' : chars[Math.min(v, chars.length - 1)])).join(''),
  );
  const title = `[${type.toUpperCase()} ${bits}]`;
  const top = '+' + title.padStart(Math.floor((17 + title.length) / 2), '-').padEnd(17, '-') + '+';
  return [top, ...rows.map((r) => `|${r}|`), '+----[SHA256]-----+'].join('\n') + '\n';
}

// ---------- known_hosts och inloggning ----------

interface Dest {
  user: string;
  host: string;
  port: number;
}

const hostKeyName = (d: Dest) => (d.port === 22 ? d.host : `[${d.host}]:${d.port}`);

function isKnown(sh: Shell, d: Dest): boolean {
  const content = sh.vfs.tryLookup(`${sshDir(sh)}/known_hosts`, sh.currentUser())?.content ?? '';
  return content.split('\n').some((l) => l.split(' ')[0].split(',').includes(hostKeyName(d)));
}

/**
 * Ansluter till servern: namnuppslag, TCP, värdnyckel (frågar "yes/no" första
 * gången) och sedan `then`. Returnerar slutkoden, eller 0 om en fråga väntar.
 */
function sshConnect(ctx: CmdCtx, d: Dest, then: (io: Sink) => number): number {
  const sh = ctx.sh;
  const r = resolveHost(sh, d.host);
  if (!r.ok) {
    ctx.err(`ssh: Could not resolve hostname ${d.host}: ${resolveErrorText(r.error)}\n`);
    return 255;
  }
  const c = connect(sh, r.ip, d.port);
  if (c !== 'ok') {
    const why = { refused: 'Connection refused', timeout: 'Connection timed out', netunreach: 'Network is unreachable', hostunreach: 'No route to host' }[c];
    ctx.err(`ssh: connect to host ${d.host} port ${d.port}: ${why}\n`);
    return 255;
  }
  if (service(sh, r.ip, d.port) !== 'ssh') {
    ctx.err(`kex_exchange_identification: Connection closed by remote host\nConnection closed by ${r.ip} port ${d.port}\n`);
    return 255;
  }
  if (r.ip !== SERVER_IP) {
    ctx.err(
      dim(sh, {
        sv: isLocal(sh, r.ip)
          ? '(Det här är din egen dator – sshd lyssnar, men i simulatorn kan du bara logga in på server.lan, 192.168.1.10.)'
          : '(I simulatorn kan du bara logga in på server.lan, 192.168.1.10.)',
        en: isLocal(sh, r.ip)
          ? '(This is your own computer – sshd is listening, but in the simulator you can only log in to server.lan, 192.168.1.10.)'
          : '(In the simulator you can only log in to server.lan, 192.168.1.10.)',
      }),
    );
    return 255;
  }
  if (isKnown(sh, d)) return then(ctx);
  if (!sh.canAskInteractively() || !ctx.isTTY) {
    ctx.err('Host key verification failed.\n');
    return 255;
  }
  const shown = r.ip === d.host ? d.host : `${d.host} (${r.ip})`;
  ctx.out(`The authenticity of host '${shown}' can't be established.\nED25519 key fingerprint is ${HOST_FP}.\nThis key is not known by any other names.\n`);
  const answer = (text: string, io: Sink): number => {
    const a = text.trim();
    if (a === 'yes' || a === HOST_FP) {
      if (!ensureSshDir(sh, io, false)) return 255;
      try {
        sh.vfs.writeFile(`${sshDir(sh)}/known_hosts`, `${hostKeyName(d)} ${HOST_KEY}\n`, sh.currentUser(), true);
      } catch (e) {
        io.err(`${sshDir(sh)}/known_hosts: ${fsMessage(e)}\n`);
      }
      io.err(`Warning: Permanently added '${hostKeyName(d)}' (ED25519) to the list of known hosts.\n`);
      return then(io);
    }
    if (a === 'no') {
      io.err('Host key verification failed.\n');
      return 255;
    }
    sh.askText("Please type 'yes', 'no' or the fingerprint: ", answer);
    return 0;
  };
  sh.askText('Are you sure you want to continue connecting (yes/no/[fingerprint])? ', answer);
  return 0;
}

/** Lösenord eller nyckel. Falskt om inloggningen nekas. */
function authenticate(sh: Shell, d: Dest, io: Sink): boolean {
  const keyLogin = !!sh.flags[keyFlag(sh)] && hasPrivateKey(sh);
  if (!keyLogin) {
    io.err(`${d.user}@${d.host}'s password: ${dim(sh, { sv: '(simulatorn hoppar över lösenordet)', en: '(the simulator skips the password)' })}`);
  }
  if (d.user !== 'elev') {
    io.err(`${d.user}@${d.host}: Permission denied (publickey,password).\n`);
    return false;
  }
  return true;
}

function parseDest(raw: string, loginName: string | undefined, sh: Shell, port: number): Dest {
  const at = raw.lastIndexOf('@');
  const user = at >= 0 ? raw.slice(0, at) : (loginName ?? sh.currentUser().name);
  return { user, host: (at >= 0 ? raw.slice(at + 1) : raw).toLowerCase(), port };
}

const ssh: CommandDef = {
  name: 'ssh',
  summary: 'Loggar in på eller kör kommandon på en annan dator',
  summaryEn: 'Log in to or run commands on another computer',
  man: `NAMN
       ssh - Secure Shell: logga in på en annan dator krypterat

SYNOPSIS
       ssh [-p PORT] [ANVÄNDARE@]VÄRD [KOMMANDO]

BESKRIVNING
       Ansluter till SSH-servern (sshd, port 22) på en annan dator. Med ett
       KOMMANDO körs det på den andra datorn och resultatet visas här.
       Första gången frågar ssh om du litar på datorns värdnyckel; svaret
       sparas i ~/.ssh/known_hosts.

       I simulatorn finns servern server.lan (192.168.1.10) med
       användaren elev. Interaktiva inloggningar stöds inte – skriv
       kommandot efter värden.

FLAGGOR
       -p PORT   anslut till en annan port än 22
       -l NAMN   användarnamn (samma som NAMN@VÄRD)

EXEMPEL
       ssh elev@server.lan hostname
       ssh elev@server.lan 'ls -l; cat välkommen.txt'
       ssh elev@192.168.1.10 uptime`,
  manEn: `NAME
       ssh - Secure Shell: log in to another computer, encrypted

SYNOPSIS
       ssh [-p PORT] [USER@]HOST [COMMAND]

DESCRIPTION
       Connects to the SSH server (sshd, port 22) on another computer. With
       a COMMAND, it runs on the other computer and the result is shown
       here. The first time, ssh asks whether you trust the computer's host
       key; the answer is saved in ~/.ssh/known_hosts.

       The simulator has the server server.lan (192.168.1.10) with the user
       elev. Interactive logins are not supported – put the command after
       the host.

OPTIONS
       -p PORT   connect to a port other than 22
       -l NAME   user name (same as NAME@HOST)

EXAMPLES
       ssh elev@server.lan hostname
       ssh elev@server.lan 'ls -l; cat välkommen.txt'
       ssh elev@192.168.1.10 uptime`,
  run(ctx) {
    const sh = ctx.sh;
    const args = [...ctx.args];
    let port = 22;
    let login: string | undefined;
    let dest: string | undefined;
    while (args.length) {
      const a = args.shift()!;
      if (a === '-V') {
        ctx.err('OpenSSH_10.0p2, OpenSSL 3.5.1 1 Jul 2025\n');
        return 0;
      }
      if (/^-[pliFoJLRDEWbcmQSweB]$/.test(a)) {
        const v = args.shift();
        if (v === undefined) {
          ctx.err(`ssh: option requires an argument -- ${a[1]}\n`);
          return 255;
        }
        if (a === '-p') port = Number(v);
        if (a === '-l') login = v;
        continue;
      }
      if (/^-p\d+$/.test(a)) {
        port = Number(a.slice(2));
        continue;
      }
      if (a.startsWith('-')) continue;
      dest = a;
      break;
    }
    if (!dest) {
      ctx.err(
        'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file]\n           [-J destination] [-L address] [-l login_name] [-m mac_spec]\n           [-O ctl_cmd] [-o option] [-P tag] [-p port] [-R address]\n           [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]]\n           destination [command [argument ...]]\n',
      );
      return 255;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      ctx.err(`Bad port '${port}'\n`);
      return 255;
    }
    const d = parseDest(dest, login, sh, port);
    const command = args.join(' ');
    return sshConnect(ctx, d, (io) => {
      if (!authenticate(sh, d, io)) return 255;
      const server = serverFor(sh);
      if (!command.trim()) {
        io.out(
          `Linux ${SERVER_NAME} ${server.distro.kernel} #1 SMP PREEMPT_DYNAMIC Debian x86_64\n\n` +
            'The programs included with the Debian GNU/Linux system are free software;\n' +
            'the exact distribution terms for each program are described in the\n' +
            'individual files in /usr/share/doc/*/copyright.\n\n' +
            'Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent\npermitted by applicable law.\n' +
            `Last login: Thu Oct 29 18:03:12 2026 from ${MY_IP}\n`,
        );
        io.err(
          dim(sh, {
            sv: `(I simulatorn kan du inte få ett interaktivt skal på servern. Skriv kommandot direkt efter värden, t.ex.  ssh ${dest} 'ls -l')`,
            en: `(The simulator can't give you an interactive shell on the server. Put the command right after the host, e.g.  ssh ${dest} 'ls -l')`,
          }),
        );
        io.err(`Connection to ${d.host} closed.\n`);
        return 0;
      }
      const result = server.execute(command);
      server.cancel();
      io.out(result.output);
      return result.exitCode;
    });
  },
};

// ---------- ssh-keygen ----------

const sshKeygen: CommandDef = {
  name: 'ssh-keygen',
  summary: 'Skapar ett SSH-nyckelpar',
  summaryEn: 'Generate an SSH key pair',
  man: `NAMN
       ssh-keygen - skapa och hantera SSH-nycklar

SYNOPSIS
       ssh-keygen [-t ed25519|rsa] [-f FIL] [-N LÖSENFRAS] [-C KOMMENTAR]
       ssh-keygen -R VÄRD

BESKRIVNING
       Skapar ett nyckelpar: en privat nyckel (t.ex. ~/.ssh/id_ed25519)
       som aldrig får lämna datorn, och en publik nyckel (.pub) som du
       lägger på servrar du vill logga in på, t.ex. med ssh-copy-id.

FLAGGOR
       -t TYP     nyckeltyp, ed25519 (standard) eller rsa
       -f FIL     var den privata nyckeln sparas
       -N FRAS    lösenfras ('' för ingen)
       -C TEXT    kommentar i den publika nyckeln
       -R VÄRD    ta bort VÄRD ur ~/.ssh/known_hosts

EXEMPEL
       ssh-keygen
       ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519`,
  manEn: `NAME
       ssh-keygen - generate and manage SSH keys

SYNOPSIS
       ssh-keygen [-t ed25519|rsa] [-f FILE] [-N PASSPHRASE] [-C COMMENT]
       ssh-keygen -R HOST

DESCRIPTION
       Creates a key pair: a private key (e.g. ~/.ssh/id_ed25519) that must
       never leave the computer, and a public key (.pub) that you put on
       servers you want to log in to, for example with ssh-copy-id.

OPTIONS
       -t TYPE    key type, ed25519 (default) or rsa
       -f FILE    where the private key is saved
       -N PHRASE  passphrase ('' for none)
       -C TEXT    comment in the public key
       -R HOST    remove HOST from ~/.ssh/known_hosts

EXAMPLES
       ssh-keygen
       ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { flags: 'qy', values: 'tfNCbR' });
    if (o.error) {
      ctx.err(`ssh-keygen: ${o.error}\nusage: ssh-keygen [-q] [-a rounds] [-b bits] [-C comment] [-f output_keyfile]\n                  [-m format] [-N new_passphrase] [-O option]\n                  [-t dsa | ecdsa | ecdsa-sk | ed25519 | ed25519-sk | rsa]\n`);
      return 1;
    }
    const user = sh.currentUser();
    if (o.values.R !== undefined) {
      const file = `${sshDir(sh)}/known_hosts`;
      const node = sh.vfs.tryLookup(file, user);
      if (!node) {
        ctx.err(`do_known_hosts: hostkeys_foreach failed for ${file}: No such file or directory\n`);
        return 255;
      }
      const lines = (node.content ?? '').split('\n').filter(Boolean);
      const keep = lines.filter((l) => !l.split(' ')[0].split(',').includes(o.values.R));
      sh.vfs.writeFile(file, keep.map((l) => l + '\n').join(''), user);
      if (keep.length !== lines.length) {
        ctx.out(`# Host ${o.values.R} found: line 1\n${file} updated.\nOriginal contents retained as ${file}.old\n`);
        sh.vfs.writeFile(file + '.old', lines.map((l) => l + '\n').join(''), user);
      }
      return 0;
    }
    const type = (o.values.t ?? 'ed25519').toLowerCase();
    if (!['ed25519', 'rsa', 'ecdsa'].includes(type)) {
      ctx.err(`unknown key type ${type}\n`);
      return 1;
    }
    const bits = type === 'rsa' ? Number(o.values.b ?? 3072) : type === 'ecdsa' ? 256 : 256;
    const defFile = `${sshDir(sh)}/id_${type}`;
    const quiet = o.flags.has('q');
    const interactive = sh.canAskInteractively() && ctx.isTTY;
    const comment = o.values.C ?? `${user.name}@${sh.distro.hostname}`;

    const generate = (file: string, io: Sink): number => {
      if (file.startsWith(sshDir(sh) + '/') && !ensureSshDir(sh, io, !quiet)) return 1;
      const fp = `SHA256:${randomB64(43)}`;
      const pubBody =
        type === 'rsa'
          ? `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ${randomB64(180)}`
          : type === 'ecdsa'
            ? `ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBB${randomB64(86)}=`
            : `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${randomB64(43)}`;
      const priv = `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n${randomB64(70)}\n${randomB64(70)}\n(simulerad privat nyckel – visa den aldrig för någon!)\n-----END OPENSSH PRIVATE KEY-----\n`;
      try {
        const path = sh.resolve(file);
        sh.vfs.writeFile(path, priv, user);
        sh.vfs.lookup(path, user).mode = 0o600;
        sh.vfs.writeFile(path + '.pub', `${pubBody} ${comment}\n`, user);
        sh.vfs.lookup(path + '.pub', user).mode = 0o644;
      } catch (e) {
        io.err(`Saving key "${file}" failed: ${fsMessage(e)}\n`);
        return 1;
      }
      if (!quiet) {
        io.out(
          `Your identification has been saved in ${file}\nYour public key has been saved in ${file}.pub\n` +
            `The key fingerprint is:\n${fp} ${comment}\nThe key's randomart image is:\n${randomArt(type, bits, fp)}`,
        );
      }
      return 0;
    };

    const askPassphrase = (file: string, io: Sink): number => {
      if (o.values.N !== undefined || !interactive) return generate(file, io);
      sh.askText(`Enter passphrase for "${file}" (empty for no passphrase): `, (first) => {
        sh.askText('Enter same passphrase again: ', (second, io2) => {
          if (first !== second) {
            io2.err('Passphrases do not match.  Try again.\n');
            return 1;
          }
          return generate(file, io2);
        });
        return 0;
      });
      return 0;
    };

    const checkExisting = (file: string, io: Sink): number => {
      if (!sh.vfs.tryLookup(sh.resolve(file), user)) return askPassphrase(file, io);
      if (!interactive) {
        io.err(`${file} already exists.\n`);
        return 1;
      }
      io.out(`${file} already exists.\n`);
      sh.ask('Overwrite (y/n)? ', false, (yes, io2) => (yes ? askPassphrase(file, io2) : 1));
      return 0;
    };

    if (!quiet) ctx.out(`Generating public/private ${type} key pair.\n`);
    if (o.values.f !== undefined || !interactive) return checkExisting(o.values.f ?? defFile, ctx);
    sh.askText(`Enter file in which to save the key (${defFile}): `, (text, io) => checkExisting(text.trim() || defFile, io));
    return 0;
  },
};

// ---------- ssh-copy-id ----------

const sshCopyId: CommandDef = {
  name: 'ssh-copy-id',
  summary: 'Lägger din publika SSH-nyckel på en server',
  summaryEn: 'Install your public SSH key on a server',
  man: `NAMN
       ssh-copy-id - lägg din publika nyckel på en server

SYNOPSIS
       ssh-copy-id [-i NYCKEL.pub] ANVÄNDARE@VÄRD

BESKRIVNING
       Lägger till din publika nyckel i ~/.ssh/authorized_keys på servern.
       Sedan loggar ssh in med nyckeln i stället för med lösenord.

EXEMPEL
       ssh-keygen
       ssh-copy-id elev@server.lan`,
  manEn: `NAME
       ssh-copy-id - install your public key on a server

SYNOPSIS
       ssh-copy-id [-i KEY.pub] USER@HOST

DESCRIPTION
       Appends your public key to ~/.ssh/authorized_keys on the server.
       After that, ssh logs in with the key instead of a password.

EXAMPLES
       ssh-keygen
       ssh-copy-id elev@server.lan`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, { flags: 'fn', values: 'ip' });
    if (o.error || !o.operands[0]) {
      ctx.err('Usage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname\n');
      return 1;
    }
    const pub = publicKey(sh, o.values.i);
    const source = o.values.i ? (o.values.i.endsWith('.pub') ? o.values.i : o.values.i + '.pub') : `${sshDir(sh)}/id_ed25519.pub`;
    if (!pub) {
      ctx.err('/usr/bin/ssh-copy-id: ERROR: No identities found\n');
      return 1;
    }
    const d = parseDest(o.operands[0], undefined, sh, Number(o.values.p ?? 22));
    ctx.err(`/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "${source}"\n`);
    return sshConnect(ctx, d, (io) => {
      io.err('/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n');
      const server = serverFor(sh);
      const existing = server.vfs.tryLookup('/home/elev/.ssh/authorized_keys', server.rootUser())?.content ?? '';
      if (d.user === 'elev' && existing.includes(pub.trim())) {
        io.err('\n/usr/bin/ssh-copy-id: WARNING: All keys were skipped because they already exist on the remote system.\n\t\t(if you think this is a mistake, you may want to use -f option)\n\n');
        return 0;
      }
      io.err('/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys\n');
      if (!authenticate(sh, d, io)) return 1;
      addAuthorizedKey(server, pub);
      sh.flags[keyFlag(sh)] = true;
      io.out(`\nNumber of key(s) added: 1\n\nNow try logging into the machine, with: "ssh '${d.user}@${d.host}'"\nand check to make sure that only the key(s) you wanted were added.\n\n`);
      return 0;
    });
  },
};

export const SSH_COMMANDS: CommandDef[] = [ssh, sshKeygen, sshCopyId];
