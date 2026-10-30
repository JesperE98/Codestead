import { describe, expect, test } from 'vitest';
import { stripAnsi } from './commands/util';
import { parse, ParseError } from './parser';
import { Shell } from './shell';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  return { sh, run };
}

describe('parser', () => {
  test('pipes, kedjor och omdirigering', () => {
    const items = parse('ls -l | grep x > ut.txt && echo klar; echo "a b" \'c d\'');
    expect(items.map((i) => i.op)).toEqual([null, '&&', ';']);
    expect(items[0].pipeline).toHaveLength(2);
    expect(items[0].pipeline[1].redirects[0].op).toBe('>');
    expect(items[2].pipeline[0].words.map((w) => w.raw)).toEqual(['echo', '"a b"', "'c d'"]);
  });

  test('syntaxfel', () => {
    expect(() => parse('ls |')).toThrow(ParseError);
    expect(() => parse('echo "oavslutad')).toThrow(ParseError);
    expect(() => parse('ls &&')).toThrow(ParseError);
  });

  test('2> räknas bara som operator i början av ett ord', () => {
    const [item] = parse('echo fil2>x');
    expect(item.pipeline[0].words.map((w) => w.raw)).toEqual(['echo', 'fil2']);
    expect(item.pipeline[0].redirects[0].op).toBe('>');
  });
});

describe('expansion', () => {
  test('variabler och citattecken', () => {
    const { run } = shell();
    expect(run('echo "$HOME"').out).toBe('/home/elev\n');
    expect(run("echo '$HOME'").out).toBe('$HOME\n');
    expect(run('echo \\$HOME').out).toBe('$HOME\n');
    expect(run('echo ~/x').out).toBe('/home/elev/x\n');
  });

  test('jokertecken', () => {
    const { run } = shell();
    expect(run('echo dokument/*').out).toBe('dokument/betyg.csv dokument/frukter.txt dokument/server.log\n');
    expect(run('echo "dokument/*"').out).toBe('dokument/*\n');
    expect(run('echo *.saknas').out).toBe('*.saknas\n');
  });

  test('$? och kedjor', () => {
    const { run } = shell();
    expect(run('ls /finnsinte; echo $?').out).toContain('\n2\n');
    expect(run('false && echo nej || echo ja').out).toBe('ja\n');
  });
});

describe('filer och rättigheter', () => {
  test('skapa, kopiera, flytta och ta bort', () => {
    const { run, sh } = shell();
    run('mkdir -p a/b && touch a/b/c.txt && cp -r a kopia && mv kopia/b/c.txt kopia/d.txt');
    expect(sh.vfs.tryLookup('/home/elev/kopia/d.txt', sh.rootUser())).not.toBeNull();
    expect(run('rm a').out).toContain('Is a directory');
    run('rm -r a');
    expect(sh.vfs.tryLookup('/home/elev/a', sh.rootUser())).toBeNull();
  });

  test('vanliga användare får inte skriva i /etc', () => {
    const { run } = shell();
    expect(run('touch /etc/x').out).toBe("touch: cannot touch '/etc/x': Permission denied\n");
    expect(run('echo hej > /etc/x').out).toBe('bash: /etc/x: Permission denied\n');
    expect(run('sudo touch /etc/x').exitCode).toBe(0);
  });

  test('rm -rf / stoppas', () => {
    const { run } = shell();
    expect(run('sudo rm -rf /').out).toContain('dangerous');
  });

  test('chmod och körbara skript', () => {
    const { run } = shell();
    run("echo 'echo från skriptet' > s.sh");
    expect(run('./s.sh').out).toBe('bash: ./s.sh: Permission denied\n');
    expect(run('bash s.sh').out).toBe('från skriptet\n');
    run('chmod u+x s.sh');
    expect(run('ls -l s.sh').out).toMatch(/^-rwxr--r--/);
    expect(run('./s.sh').out).toBe('från skriptet\n');
    run('chmod 640 s.sh');
    expect(run('ls -l s.sh').out).toMatch(/^-rw-r-----/);
  });

  test('cd in i /root nekas', () => {
    const { run, sh } = shell();
    expect(run('cd /root').out).toBe('bash: cd: /root: Permission denied\n');
    run('sudo -i');
    expect(sh.prompt()).toBe('root@ubuntu:~# ');
    run('exit');
    expect(sh.currentUser().name).toBe('elev');
  });
});

describe('textverktyg', () => {
  test('grep, sort, uniq, wc och head', () => {
    const { run } = shell();
    expect(run('grep -c ERROR dokument/server.log').out).toBe('3\n');
    expect(run('grep -ic warn dokument/server.log').out).toBe('3\n');
    expect(run('grep -E "ERROR|WARN" dokument/server.log | wc -l').out).toBe('5\n');
    expect(run('grep "ERROR|WARN" dokument/server.log').exitCode).toBe(1);
    expect(run('sort dokument/frukter.txt | uniq -c | sort -rn | head -1').out).toBe('      3 äpple\n');
    expect(run('wc -l < dokument/frukter.txt').out).toBe('10\n');
    expect(run('cut -d: -f1 /etc/passwd | tail -1').out).toBe('elev\n');
  });

  test('tee och 2>/dev/null', () => {
    const { run } = shell();
    expect(run('echo hej | tee x.txt').out).toBe('hej\n');
    expect(run('cat x.txt').out).toBe('hej\n');
    expect(run('ls /finnsinte 2>/dev/null').out).toBe('');
    expect(run('ls /finnsinte 2>&1 | wc -l').out).toBe('1\n');
  });

  test('alias och export', () => {
    const { run, sh } = shell();
    run("alias ll='ls -la'");
    expect(run('ll').out).toContain('.bashrc');
    run('export FAVORIT=linux');
    expect(run('echo $FAVORIT').out).toBe('linux\n');
    expect(sh.env.FAVORIT).toBe('linux');
  });
});

describe('pakethantering', () => {
  test('apt kräver sudo och apt update', () => {
    const { run, sh } = shell('debian');
    expect(run('apt install tree').exitCode).toBe(100);
    expect(run('sudo apt install tree').out).toContain('Unable to locate package tree');
    run('sudo apt update');
    run('sudo apt install tree');
    expect(sh.installed.tree).toBeDefined();
    expect(run('tree -L 1').exitCode).toBe(0);
    run('sudo apt remove tree');
    expect(sh.prompt()).toBe('Do you want to continue? [Y/n] ');
    run('');
    expect(sh.installed.tree).toBeUndefined();
    expect(run('tree').exitCode).toBe(127);
  });

  test('pacman och partiella svar', () => {
    const { run, sh } = shell('arch');
    expect(run('pacman -S htop').out).toContain('unless you are root');
    run('sudo pacman -S htop');
    run('n');
    expect(sh.installed.htop).toBeUndefined();
    run('sudo pacman -S --noconfirm htop');
    expect(sh.installed.htop).toBeDefined();
    expect(run('pacman -Q htop').out).toMatch(/^htop \S+\n$/);
    expect(run('sudo pacman -R pacman').exitCode).toBe(1);
  });

  test('dnf har Nej som standardsvar och olika paketnamn', () => {
    const { run, sh } = shell('fedora');
    run('sudo dnf install vim');
    expect(sh.installed.vim).toBeUndefined();
    run('sudo dnf install vim-enhanced');
    run('');
    expect(sh.installed.vim).toBeUndefined();
    run('sudo dnf install -y vim-enhanced');
    expect(sh.installed.vim).toBeDefined();
    expect(run('dnf check-update').exitCode).toBe(100);
  });

  test('pakethanteraren finns bara i rätt familj', () => {
    expect(shell('ubuntu').run('pacman -Q').exitCode).toBe(127);
    expect(shell('arch').run('apt list').exitCode).toBe(127);
    expect(shell('fedora').run('apt list').exitCode).toBe(127);
  });

  test('ubuntu föreslår paket för kommandon som saknas', () => {
    expect(shell('ubuntu').run('htop').out).toContain('sudo apt install htop');
  });
});

describe('tab-komplettering', () => {
  test('kommandon och sökvägar', () => {
    const { sh } = shell();
    expect(sh.complete('whoa').line).toBe('whoami ');
    expect(sh.complete('cd dok').line).toBe('cd dokument/');
    expect(sh.complete('cat dokument/s').line).toBe('cat dokument/server.log ');
    expect(sh.complete('ls dokument/').options).toEqual(['betyg.csv', 'frukter.txt', 'server.log']);
  });
});

describe('spara och återställa', () => {
  test('snapshot överlever JSON', () => {
    const { run, sh } = shell('arch');
    run('mkdir sparad && cd sparad');
    const restored = Shell.restore(JSON.parse(JSON.stringify(sh.snapshot())))!;
    expect(restored.cwd).toBe('/home/elev/sparad');
    expect(restored.distro.id).toBe('arch');
  });
});
