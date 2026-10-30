// Andra skal än bash: zsh och fish. Skalet håller en stack med startade skal
// (`zsh` startar zsh, `exit` går tillbaka). Här finns prompterna, det som händer
// när ett skal startar (hälsning, ~/.zshrc, config.fish) och fish universella variabler.

import type { Proc } from './procs';
import type { Shell } from './shell';
import type { Node } from './parser';
import type { Sink } from './types';
import { basename } from './vfs';

export type ShellMode = 'bash' | 'zsh' | 'fish';

/** Ett skal som startats ovanpå det första bash-skalet. */
export interface ShellFrame {
  mode: ShellMode;
  pid: number;
  /** Antal inloggade användare (userStack) när skalet startades. */
  userDepth: number;
  /** Inställningar med setopt (zsh), t.ex. autocd. */
  options: Record<string, boolean>;
  /** Föräldraskalets tillstånd, som återställs vid exit. */
  saved: { cwd: string; env: Record<string, string>; aliases: Record<string, string>; functions: Record<string, Node> };
  /** Skalet startades med sudo – exit lämnar också root. */
  pushedUser?: boolean;
}

export const SHELL_PATHS: Record<ShellMode, string> = { bash: '/bin/bash', zsh: '/usr/bin/zsh', fish: '/usr/bin/fish' };

export const ZSH_VERSION = '5.9';
export function fishVersion(sh: Shell): string {
  return { debian: '3.7.0', arch: '4.1.2', redhat: '4.0.2' }[sh.distro.family];
}

/** Vilket skal en sökväg som /usr/bin/zsh eller "fish" betyder (null om okänt). */
export function modeOf(path: string): ShellMode | null {
  const name = basename(path.trim());
  if (name === 'zsh' || name === 'fish' || name === 'bash') return name;
  if (name === 'sh') return 'bash';
  return null;
}

/** Skalet som ett skript ska köras med, enligt raden #! överst (bash om den saknas). */
export function shebang(content: string): { mode: ShellMode; interpreter: string } | null {
  const m = /^#!\s*(\S+)(?:[ \t]+(\S+))?/.exec(content);
  if (!m) return null;
  const prog = basename(m[1]) === 'env' && m[2] ? m[2] : m[1];
  const mode = modeOf(prog);
  return mode ? { mode, interpreter: m[1] } : null;
}

export function shellProc(pid: number, ppid: number, user: string, mode: ShellMode): Proc {
  return {
    pid,
    ppid,
    user,
    cmd: mode,
    cpu: 0,
    mem: 0.1,
    vsz: mode === 'fish' ? 245_000 : 12_500,
    rss: mode === 'fish' ? 9_800 : 5_600,
    tty: 'pts/0',
    stat: 'S',
    start: new Date().toTimeString().slice(0, 5),
    time: '0:00',
  };
}

// ---------- Prompter ----------

const COLORS: Record<string, number> = { black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37 };

/** Tolkar zsh-promptens %-koder: %n, %m, %~, %1~, %#, %F{färg} … */
export function zshPrompt(sh: Shell, format: string): string {
  const u = sh.currentUser();
  const tilde = (p: string) => (p === u.home ? '~' : p.startsWith(u.home + '/') ? '~' + p.slice(u.home.length) : p);
  return format.replace(/%(\d*)([~nmMd/c#%BbFfT*])(\{[^}]*\})?/g, (_all, num: string, code: string, arg?: string) => {
    switch (code) {
      case 'n':
        return u.name;
      case 'm':
        return sh.distro.hostname.split('.')[0];
      case 'M':
        return sh.distro.hostname;
      case '~':
      case 'd':
      case '/':
      case 'c': {
        const full = code === '~' || code === 'c' ? tilde(sh.cwd) : sh.cwd;
        const n = code === 'c' ? 1 : Number(num || 0);
        if (!n || full === '/' || full === '~') return full;
        const parts = full.split('/').filter(Boolean);
        return parts.slice(-n).join('/');
      }
      case '#':
        return u.uid === 0 ? '#' : '%';
      case '%':
        return '%';
      case 'B':
        return '\x1b[1m';
      case 'b':
        return '\x1b[22m';
      case 'F': {
        const name = arg?.slice(1, -1) ?? '';
        const c = COLORS[name] ?? (/^\d$/.test(name) ? 30 + Number(name) : undefined);
        return c ? `\x1b[${c}m` : '';
      }
      case 'f':
        return '\x1b[39m';
      case 'T':
        return new Date().toTimeString().slice(0, 5);
      case '*':
        return new Date().toTimeString().slice(0, 8);
    }
    return '';
  });
}

/** fish förkortar sökvägen: /home/elev/dokument/projekt -> ~/d/projekt */
export function fishPwd(sh: Shell): string {
  const home = sh.currentUser().home;
  const p = sh.cwd === home ? '~' : sh.cwd.startsWith(home + '/') ? '~' + sh.cwd.slice(home.length) : sh.cwd;
  const parts = p.split('/');
  return parts.map((s, i) => (i === parts.length - 1 || !s || s === '~' ? s : s.startsWith('.') ? s.slice(0, 2) : s[0])).join('/');
}

export function shellPrompt(sh: Shell, mode: ShellMode): string {
  const u = sh.currentUser();
  if (mode === 'zsh') return zshPrompt(sh, sh.env.PROMPT ?? sh.env.PS1 ?? '%m%# ');
  const root = u.uid === 0;
  return `\x1b[32m${u.name}\x1b[0m@${sh.distro.hostname} \x1b[${root ? 31 : 32}m${fishPwd(sh)}\x1b[0m${root ? '#' : '>'} `;
}

// ---------- Uppstart ----------

const NEWUSER = `This is the Z Shell configuration function for new users,
zsh-newuser-install.
You are seeing this message because you have no zsh startup files
(the files .zshenv, .zprofile, .zshrc, .zlogin in the directory
~).  This function can help you with a few settings that should
make your use of the shell easier.

You can:

(q)  Quit and do nothing.  The function will be run again next time.

(0)  Exit, creating the file ~/.zshrc containing just a comment.
     That will prevent this function being run again.

(1)  Continue to the main menu.

(2)  Populate your ~/.zshrc with the configuration recommended
     by the system administrator and exit (you will need to edit
     the file by hand, if so desired).

`;

export const ZSHRC_RECOMMENDED = `# ~/.zshrc – körs av zsh för interaktiva skal.
# Skapad av zsh-newuser-install med de rekommenderade inställningarna.

# Prompten: användare@dator katalog %
PROMPT='%n@%m %1~ %# '

HISTSIZE=1000
SAVEHIST=1000
HISTFILE=~/.zsh_history

# Skriv bara ett katalognamn för att gå dit (utan cd).
setopt autocd
setopt histignorealldups sharehistory
`;

export const CONFIG_FISH = `if status is-interactive
    # Commands to run in interactive sessions can go here
end
`;

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function writeHomeFile(sh: Shell, rel: string, content: string): void {
  const user = sh.currentUser();
  const path = `${user.home}/${rel}`;
  const parts = rel.split('/').slice(0, -1);
  let dir = user.home;
  for (const p of parts) {
    dir += '/' + p;
    if (!sh.vfs.tryLookup(dir, user)) sh.vfs.mkdir(dir, user);
  }
  sh.vfs.writeFile(path, content, user);
}

function sourceFile(sh: Shell, rel: string, mode: ShellMode, io: Sink): void {
  const user = sh.currentUser();
  const node = sh.vfs.tryLookup(`${user.home}/${rel}`, user);
  if (node?.type !== 'file') return;
  sh.runScript(node.content ?? '', `${user.home}/${rel}`, [], { ...io, stdin: null, isTTY: false }, true, mode);
}

/** Körs när ett nytt interaktivt zsh- eller fish-skal startar. */
export function shellStartup(sh: Shell, mode: ShellMode, io: Sink): void {
  const user = sh.currentUser();
  if (mode === 'zsh') {
    const hasRc = ['.zshrc', '.zshenv', '.zprofile', '.zlogin'].some((f) => sh.vfs.tryLookup(`${user.home}/${f}`, user));
    if (hasRc) {
      sourceFile(sh, '.zshrc', 'zsh', io);
      return;
    }
    io.out(NEWUSER);
    sh.askText('--- Type one of the keys in parentheses --- ', (text, out) => {
      const key = text.trim();
      if (key === '0') {
        writeHomeFile(sh, '.zshrc', '# Created by newuser for 5.9\n');
      } else if (key === '1' || key === '2') {
        if (key === '1') {
          out.out(
            `${DIM}${sh.msg({
              sv: 'Huvudmenyn finns inte i simulatorn – du får de rekommenderade inställningarna (som med 2).',
              en: 'The main menu is not available in the simulator – you get the recommended settings (as with 2).',
            })}${RESET}\n`,
          );
        }
        writeHomeFile(sh, '.zshrc', ZSHRC_RECOMMENDED);
        sourceFile(sh, '.zshrc', 'zsh', out);
      }
      return 0;
    });
    return;
  }
  if (mode === 'fish') {
    if (!sh.vfs.tryLookup(`${user.home}/.config/fish/config.fish`, user)) writeHomeFile(sh, '.config/fish/config.fish', CONFIG_FISH);
    loadUniversalVars(sh);
    sourceFile(sh, '.config/fish/config.fish', 'fish', io);
    const greeting = sh.env.fish_greeting ?? 'Welcome to fish, the friendly interactive shell\nType help for instructions on how to use fish';
    if (greeting) io.out(greeting + '\n');
  }
}

// ---------- fish: universella variabler (set -U) i ~/.config/fish/fish_variables ----------

const UVARS = '.config/fish/fish_variables';

function uvarPath(sh: Shell): string {
  return `${sh.currentUser().home}/${UVARS}`;
}

function readUvars(sh: Shell): Record<string, string> {
  const content = sh.vfs.tryLookup(uvarPath(sh), sh.currentUser())?.content ?? '';
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = /^SETUVAR (?:--export )?([A-Za-z_]\w*):(.*)$/.exec(line);
    if (m) vars[m[1]] = m[2].replace(/\\x1e/g, ' ').replace(/\\x([0-9a-f]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return vars;
}

function loadUniversalVars(sh: Shell): void {
  for (const [k, v] of Object.entries(readUvars(sh))) if (!(k in sh.env)) sh.env[k] = v;
}

/** Sparar (eller tar bort, med value null) en universell variabel. */
export function saveUniversalVar(sh: Shell, name: string, value: string | null): void {
  const vars = readUvars(sh);
  if (value === null) delete vars[name];
  else vars[name] = value;
  const enc = (v: string) => v.replace(/[^\w/.~-]/g, (c) => (c === ' ' ? '\\x1e' : `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`));
  const lines = Object.entries(vars)
    .sort()
    .map(([k, v]) => `SETUVAR ${k}:${enc(v)}`);
  writeHomeFile(
    sh,
    UVARS,
    `# This file contains fish universal variable definitions.\n# VERSION: 3.0\n${lines.join('\n')}${lines.length ? '\n' : ''}`,
  );
}
