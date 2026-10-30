import { describe, expect, test } from 'vitest';
import { fishMath } from './commands/shells';
import { stripAnsi } from './commands/util';
import { translateFish } from './fish';
import { ParseError } from './parser';
import { Shell } from './shell';
import { fishPwd, zshPrompt } from './shellmode';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  const prompt = () => stripAnsi(sh.prompt());
  return { sh, run, prompt };
}

/** Ett skal där zsh och fish är installerade. */
function withShells(distro = 'ubuntu') {
  const s = shell(distro);
  const cmds = {
    ubuntu: ['sudo apt update', 'sudo apt install zsh fish'],
    debian: ['sudo apt update', 'sudo apt install zsh fish'],
    arch: ['sudo pacman -S zsh fish', 'y'],
    fedora: ['sudo dnf install zsh fish', 'y'],
  }[distro]!;
  for (const c of cmds) s.run(c);
  return s;
}

/** Startar zsh och svarar på zsh-newuser-install. */
function startZsh(s: ReturnType<typeof shell>, answer = '2') {
  const r = s.run('zsh');
  if (r.pending) s.run(answer);
}

describe('paket och /etc/shells', () => {
  test.each(['ubuntu', 'debian', 'arch', 'fedora'])('zsh och fish installeras och läggs i /etc/shells (%s)', (d) => {
    const { sh, run } = withShells(d);
    expect('zsh' in sh.installed && 'fish' in sh.installed).toBe(true);
    const shells = run('cat /etc/shells').out;
    expect(shells).toContain('/usr/bin/zsh');
    expect(shells).toContain('/usr/bin/fish');
    expect(run('which zsh').out.trim()).toBe('/usr/bin/zsh');
  });

  test('zsh finns inte från början', () => {
    const { run } = shell();
    expect(run('zsh').exitCode).toBe(127);
    expect(run('cat /etc/shells').out).not.toContain('zsh');
  });

  test('avinstallation tar bort skalet ur /etc/shells', () => {
    const { run } = withShells('arch');
    run('sudo pacman -R fish');
    run('y');
    const shells = run('cat /etc/shells').out;
    expect(shells).not.toContain('fish');
    expect(shells).toContain('/usr/bin/zsh');
  });
});

describe('zsh', () => {
  test('startar med zsh-newuser-install, prompt och exit', () => {
    const s = withShells();
    const r = s.run('zsh');
    expect(r.out).toContain('zsh-newuser-install');
    expect(r.pending).toBe(true);
    s.run('0');
    expect(s.sh.vfs.readFile('/home/elev/.zshrc', s.sh.rootUser())).toContain('newuser');
    expect(s.sh.shellMode).toBe('zsh');
    expect(s.prompt()).toBe('ubuntu% ');
    expect(s.run('echo $0').out.trim()).toBe('zsh');
    expect(s.run('echo $ZSH_VERSION').out.trim()).toBe('5.9');
    // $SHELL är inloggningsskalet, inte skalet som körs.
    expect(s.run('echo $SHELL').out.trim()).toBe('/bin/bash');
    s.run('exit');
    expect(s.sh.shellMode).toBe('bash');
    expect(s.prompt()).toBe('elev@ubuntu:~$ ');
    expect(s.run('echo $0').out.trim()).toBe('bash');
  });

  test('rekommenderade inställningar: prompt och autocd', () => {
    const s = withShells();
    startZsh(s, '2');
    expect(s.prompt()).toBe('elev@ubuntu ~ % ');
    s.run('dokument');
    expect(s.sh.cwd).toBe('/home/elev/dokument');
    expect(s.prompt()).toBe('elev@ubuntu dokument % ');
    // Nästa gång frågar zsh inte igen.
    s.run('exit');
    expect(s.run('zsh').pending).toBe(false);
    expect(s.sh.shellMode).toBe('zsh');
  });

  test('setopt autocd och setopt finns bara i zsh', () => {
    const s = withShells();
    expect(s.run('setopt autocd').out).toContain('command not found');
    startZsh(s, 'q');
    expect(s.run('gammalt').exitCode).toBe(127);
    s.run('setopt autocd');
    s.run('gammalt');
    expect(s.sh.cwd).toBe('/home/elev/gammalt');
    expect(s.run('setopt').out).toContain('autocd');
    expect(s.run('setopt nosuchthing').out).toContain('no such option');
  });

  test('ps visar zsh som barn till bash', () => {
    const s = withShells();
    startZsh(s);
    const out = s.run('ps').out;
    expect(out).toMatch(/bash\n.*zsh\n.*ps/);
    s.run('exit');
    expect(s.run('ps').out).not.toContain('zsh');
  });

  test('** letar i alla underkataloger, men inte i bash', () => {
    const s = withShells();
    expect(s.run('ls -d ~/**/*.txt').out).not.toContain('logg-2019.txt');
    startZsh(s);
    const out = s.run('ls -d ~/**/*.txt').out;
    expect(out).toContain('/home/elev/dokument/frukter.txt');
    expect(out).toContain('/home/elev/gammalt/arkiv/logg-2019.txt');
    expect(out).toContain('/home/elev/anteckningar.txt');
  });

  test('ociterade variabler delas inte upp', () => {
    const s = withShells();
    const loop = 'x="a b c"; for i in $x; do echo "[$i]"; done';
    expect(s.run(loop).out).toBe('[a]\n[b]\n[c]\n');
    startZsh(s);
    expect(s.run(loop).out).toBe('[a b c]\n');
    s.run('setopt shwordsplit');
    expect(s.run(loop).out).toBe('[a]\n[b]\n[c]\n');
  });

  test('felmeddelanden ser ut som i zsh', () => {
    const s = withShells();
    startZsh(s);
    expect(s.run('finnsinte').out).toBe('zsh: command not found: finnsinte\n');
  });

  test('variabler, alias och katalog från zsh försvinner vid exit', () => {
    const s = withShells();
    s.run('alias ll="ls -l"');
    startZsh(s);
    expect(s.run('ll').exitCode).toBe(127);
    s.run('hemligt=42');
    s.run('cd /tmp');
    s.run('exit');
    expect(s.sh.cwd).toBe('/home/elev');
    expect(s.run('echo "[$hemligt]"').out).toBe('[]\n');
    expect(s.sh.aliases.ll).toBe('ls -l');
  });

  test('zsh -c och skript med #!/bin/zsh', () => {
    const s = withShells();
    expect(s.run(`zsh -c 'echo $0'`).out.trim()).toBe('zsh');
    s.run(`printf '#!/usr/bin/zsh\\necho $ZSH_VERSION\\n' > ~/z.sh`);
    s.run('chmod +x ~/z.sh');
    expect(s.run('~/z.sh').out.trim()).toBe('5.9');
    expect(s.sh.shellMode).toBe('bash');
  });

  test('sudo zsh ger ett root-skal', () => {
    const s = withShells();
    // root har ingen ~/.zshrc, så zsh-newuser-install frågar.
    expect(s.run('sudo zsh').out).toContain('zsh-newuser-install');
    s.run('q');
    expect(s.run('whoami').out.trim()).toBe('root');
    expect(s.prompt()).toBe('ubuntu# ');
    s.run('exit');
    expect(s.run('whoami').out.trim()).toBe('elev');
  });

  test('promptkoder', () => {
    const { sh } = shell('fedora');
    sh.cwd = '/home/elev/dokument';
    expect(zshPrompt(sh, '%n@%m %~ %# ')).toBe('elev@fedora ~/dokument % ');
    expect(zshPrompt(sh, '[%n %1~]%% ')).toBe('[elev dokument]% ');
    expect(zshPrompt(sh, '%d')).toBe('/home/elev/dokument');
  });
});

describe('fish: översättning', () => {
  const t = (code: string) => translateFish(code);
  test('block och variabler', () => {
    expect(t('set namn Kim')).toBe('__fish_set namn Kim');
    expect(t('echo $namn (pwd)')).toBe('echo ${namn} $(pwd)');
    expect(t('for x in a b c; echo $x; end')).toBe('for x in a b c; do echo ${x}; done');
    expect(t('if test -f a; and test -f b; echo ja; else if true; echo kanske; else; echo nej; end')).toBe(
      'if test -f a && test -f b; then echo ja; elif true; then echo kanske; else echo nej; fi',
    );
    expect(t('while read -l rad; echo $rad; end < fil')).toBe('while read rad; do echo ${rad}; done < fil');
    expect(t('function hej; echo Hej $argv[1] "$argv"; end')).toBe('hej() { echo Hej ${1} "$*"; }');
    expect(t('begin; echo a; end | sort')).toBe('{ echo a; } | sort');
    expect(t('not test -f x; or echo saknas')).toBe('! test -f x || echo saknas');
    expect(t("switch $x; case a b; echo AB; case '*'; echo annat; end")).toBe('case ${x} in a|b) echo AB ;; *) echo annat ;; esac');
    expect(t('echo "status: $status"')).toBe('echo "status: $?"');
    expect(t('echo {$HOME}/x')).toBe('echo ${HOME}/x');
    expect(t('sleep 5 &')).toBe('sleep 5 &');
    expect(t('X=1 env')).toBe('X=1 env');
  });

  test('bash-syntax ger fish-fel', () => {
    const err = (code: string) => {
      try {
        t(code);
        return '';
      } catch (e) {
        return (e as ParseError).message;
      }
    };
    expect(err('X=1')).toContain("Unsupported use of '='. In fish, please use 'set X 1'.");
    expect(err('echo $?')).toContain('$? is not the exit status. In fish, please use $status.');
    expect(err('echo ${HOME}')).toContain('Variables cannot be bracketed. In fish, please use {$HOME}.');
    expect(err('echo $((1+2))')).toContain("please use 'math'");
    expect(err('for i in 1 2; do echo $i; done')).toContain('Unknown command: do');
    expect(err('end')).toContain("'end' outside of a block");
    expect(err('cat << SLUT')).toContain('redirection');
  });

  test('ofullständiga block', () => {
    for (const code of ['for i in 1 2', 'if true', 'echo "oavslutad', 'echo (pwd']) {
      try {
        t(code);
        expect.unreachable(code);
      } catch (e) {
        expect((e as ParseError).incomplete, code).toBe(true);
      }
    }
  });

  test('math', () => {
    expect(fishMath('10 / 3')).toBeCloseTo(3.333333);
    expect(fishMath('2 + 3 x 4')).toBe(14);
    expect(fishMath('(2 + 3) * 4')).toBe(20);
    expect(fishMath('2 ^ 10')).toBe(1024);
    expect(() => fishMath('1 / 0')).toThrow();
  });
});

describe('fish i terminalen', () => {
  test('start, hälsning, prompt och exit', () => {
    const s = withShells();
    const r = s.run('fish');
    expect(r.out).toContain('Welcome to fish, the friendly interactive shell');
    expect(s.prompt()).toBe('elev@ubuntu ~> ');
    expect(s.sh.vfs.tryLookup('/home/elev/.config/fish/config.fish', s.sh.rootUser())).not.toBeNull();
    s.run('mkdir -p ~/dokument/projekt/kod');
    s.run('cd ~/dokument/projekt/kod');
    expect(s.prompt()).toBe('elev@ubuntu ~/d/p/kod> ');
    s.run('exit');
    expect(s.sh.shellMode).toBe('bash');
    expect(s.sh.cwd).toBe('/home/elev');
  });

  test('set, variabler och listor', () => {
    const s = withShells();
    s.run('fish');
    expect(s.run('X=1').out).toContain("fish: Unsupported use of '='. In fish, please use 'set X 1'.");
    s.run('set frukt äpple');
    expect(s.run('echo $frukt').out).toBe('äpple\n');
    s.run('set frukter äpple päron banan');
    expect(s.run('echo $frukter[2]').out).toBe('päron\n');
    expect(s.run('echo $frukter[-1]').out).toBe('banan\n');
    expect(s.run('count $frukter').out).toBe('3\n');
    s.run('set -x EDITOR nano');
    expect(s.run('env').out).toContain('EDITOR=nano');
    expect(s.run('set -q EDITOR').exitCode).toBe(0);
    s.run('set -e EDITOR');
    expect(s.run('set -q EDITOR').exitCode).toBe(1);
    s.run('set -a frukter kiwi');
    expect(s.run('count $frukter').out).toBe('4\n');
    s.run('set PATH $PATH ~/bin');
    expect(s.sh.env.PATH).toBe('/usr/local/bin:/usr/bin:/bin:/home/elev/bin');
    s.run('exit');
    expect(s.sh.env.frukt).toBeUndefined();
  });

  test('loopar, villkor, funktioner och $status', () => {
    const s = withShells();
    s.run('fish');
    expect(s.run('for i in 1 2 3; echo $i; end').out).toBe('1\n2\n3\n');
    expect(s.run('for f in (seq 3); echo nr $f; end').out).toBe('nr 1\nnr 2\nnr 3\n');
    expect(s.run('if test -f ~/.bashrc; echo finns; else; echo saknas; end').out).toBe('finns\n');
    s.run('false');
    expect(s.run('echo $status').out).toBe('1\n');
    expect(s.run('true; and echo ja; or echo nej').out).toBe('ja\n');
    expect(s.run('false; and echo ja; or echo nej').out).toBe('nej\n');
    s.run('function hej; echo "Hej $argv!"; end');
    expect(s.run('hej Kim').out).toBe('Hej Kim!\n');
    s.run('function dubbla --argument-names tal; math $tal x 2; end');
    expect(s.run('dubbla 21').out).toBe('42\n');
    expect(s.run('math 10 / 4').out).toBe('2.5\n');
    expect(s.run('set i 0; while test $i -lt 3; set i (math $i + 1); echo $i; end').out).toBe('1\n2\n3\n');
    expect(s.run('echo $?').out).toContain('$? is not the exit status');
  });

  test('flerradiga block', () => {
    const s = withShells();
    s.run('fish');
    expect(s.run('for i in a b').incomplete).toBe(true);
    expect(s.run('echo $i').incomplete).toBe(true);
    const r = s.run('end');
    expect(r.out).toBe('a\nb\n');
    expect(r.line).toBe('for i in a b; echo $i; end');
  });

  test('bash-syntax ger fel med tips, okänt kommando', () => {
    const s = withShells();
    s.run('fish');
    const r = s.run('for i in 1 2; do echo $i; done');
    expect(r.out).toContain('fish: Unknown command: do');
    expect(r.exitCode).not.toBe(0);
    expect(s.run('finnsinte').out).toBe('fish: Unknown command: finnsinte\n');
    // && och $(...) fungerar i nyare fish
    expect(s.run('true && echo ok').out).toBe('ok\n');
    expect(s.run('echo $(echo inne)').out).toBe('inne\n');
  });

  test('universella variabler sparas i fish_variables', () => {
    const s = withShells();
    s.run('fish');
    s.run('set -U fish_greeting ""');
    s.run('exit');
    expect(s.sh.vfs.readFile('/home/elev/.config/fish/fish_variables', s.sh.rootUser())).toContain('SETUVAR fish_greeting:');
    expect(s.run('fish').out).not.toContain('Welcome');
  });

  test('skript med #!/usr/bin/fish körs av fish, bash-skript av bash', () => {
    const s = withShells();
    s.run(`printf '#!/usr/bin/fish\\nset x fisk\\necho $x\\n' > ~/f.fish`);
    s.run('chmod +x ~/f.fish');
    expect(s.run('~/f.fish').out).toBe('fisk\n');
    s.run(`printf '#!/bin/bash\\nx=bash\\necho $x\\n' > ~/b.sh`);
    s.run('chmod +x ~/b.sh');
    s.run('fish');
    expect(s.run('~/b.sh').out).toBe('bash\n');
    expect(s.run(`fish -c 'echo (echo hej)'`).out).toBe('hej\n');
  });

  test('skript för ett skal som saknas: bad interpreter', () => {
    const { run } = shell();
    run(`printf '#!/usr/bin/fish\\necho hej\\n' > ~/f.fish`);
    run('chmod +x ~/f.fish');
    const r = run('~/f.fish');
    expect(r.out).toContain('/usr/bin/fish: bad interpreter: No such file or directory');
    expect(r.exitCode).toBe(126);
  });

  test('fishPwd förkortar sökvägen', () => {
    const { sh } = shell();
    sh.cwd = '/home/elev/.config/fish';
    expect(fishPwd(sh)).toBe('~/.c/fish');
    sh.cwd = '/usr/share/doc';
    expect(fishPwd(sh)).toBe('/u/s/doc');
    sh.cwd = '/';
    expect(fishPwd(sh)).toBe('/');
  });
});

describe('chsh', () => {
  const passwdShell = (sh: Shell) =>
    sh.vfs
      .readFile('/etc/passwd', sh.rootUser())
      .split('\n')
      .find((l) => l.startsWith('elev:'))!
      .split(':')[6];

  test.each(['ubuntu', 'arch'])('byter skal i /etc/passwd (%s)', (d) => {
    const { sh, run } = withShells(d);
    const r = run('chsh -s /usr/bin/zsh');
    expect(r.exitCode).toBe(0);
    expect(passwdShell(sh)).toBe('/usr/bin/zsh');
    if (d === 'arch') expect(r.out).toContain('Shell changed.');
    // Skalet i terminalen är detsamma tills nästa inloggning.
    expect(sh.shellMode).toBe('bash');
    expect(run('echo $SHELL').out.trim()).toBe('/bin/bash');
  });

  test('skal som inte finns i /etc/shells eller inte är installerade nekas', () => {
    const { sh, run } = shell('arch');
    expect(run('chsh -s /usr/bin/zsh').exitCode).toBe(1);
    expect(run('chsh -s zsh').out).toContain('full path');
    expect(run('chsh -s /usr/bin/ls').out).toContain('not listed in /etc/shells');
    expect(passwdShell(sh)).toBe('/bin/bash');
    expect(run('chsh -l').out).toContain('/bin/bash');
  });

  test('frågar efter skal utan -s, och bara root får byta åt andra', () => {
    const { sh, run } = withShells('debian');
    const r = run('chsh');
    expect(r.pending).toBe(true);
    expect(stripAnsi(sh.prompt())).toBe('\tLogin Shell [/bin/bash]: ');
    run('/usr/bin/fish');
    expect(passwdShell(sh)).toBe('/usr/bin/fish');
    expect(run('chsh -s /bin/zsh root').out).toContain("You may not change the shell for 'root'");
    run('sudo chsh -s /bin/zsh root');
    expect(sh.vfs.readFile('/etc/passwd', sh.rootUser())).toContain('root:x:0:0:root:/root:/bin/zsh');
  });
});
