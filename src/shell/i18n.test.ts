import { describe, expect, test } from 'vitest';
import { COMMANDS } from './commands';
import { manFor, summaryFor } from './commands/man-en';
import { stripAnsi } from './commands/util';
import { installPackage, PACKAGES } from './packages';
import { SHELL_PID } from './procs';
import { Shell } from './shell';

const SWEDISH = /[åäöÅÄÖ]/;
const SWEDISH_HEADINGS = /^(NAMN|BESKRIVNING|FLAGGOR|EXEMPEL|VARNING|TIPS FRÅN)\b/m;

function shell(distro = 'ubuntu', lang = 'en') {
  const sh = Shell.create(distro);
  sh.lang = lang;
  const run = (line: string) => stripAnsi(sh.execute(line).output);
  return { sh, run };
}

describe('engelska manualsidor', () => {
  test('varje kommando har en engelsk sammanfattning', () => {
    const sv = Shell.create('ubuntu');
    const { sh } = shell();
    for (const def of Object.values(COMMANDS)) {
      const en = summaryFor(def, sh);
      expect(en, def.name).not.toBe(summaryFor(def, sv));
      expect(en, def.name).not.toMatch(SWEDISH);
    }
  });

  test('varje kommando har en engelsk manualsida', () => {
    const { sh } = shell();
    for (const def of Object.values(COMMANDS)) {
      const man = manFor(def, sh);
      expect(man, def.name).toMatch(/^NAME\n/);
      expect(man, def.name).not.toMatch(SWEDISH_HEADINGS);
      // Exempel får använda övningsfilernas svenska namn, men inte svensk text.
      expect(man.replace(/frukter|dokument|betyg|anteckningar/g, ''), def.name).not.toMatch(SWEDISH);
    }
  });

  test('svenska är oförändrat', () => {
    const { sh } = shell('ubuntu', 'sv');
    expect(manFor(COMMANDS.ls, sh)).toMatch(/^NAMN\n/);
    expect(summaryFor(COMMANDS.cd, sh)).toBe('Byter aktuell katalog');
  });

  test('man, --help och help på engelska', () => {
    const { run } = shell();
    const man = run('man ls');
    expect(man).toContain('Simulated manual');
    expect(man).toContain('DESCRIPTION');
    expect(man).toContain('-a, --all');
    expect(run('cp --help')).toContain('copy files and directories');
    const help = run('help');
    expect(help).toContain('Commands in this simulated terminal');
    expect(help).toContain('Changes the current directory');
    expect(help).not.toMatch(SWEDISH);

    const sv = shell('ubuntu', 'sv');
    expect(sv.run('man ls')).toContain('Simulerad manual');
    expect(sv.run('help')).toContain('Kommandon i den här simulerade terminalen');
  });
});

describe('simulatorns tipsrader på engelska', () => {
  test('välkomsttexten', () => {
    const { sh } = shell();
    expect(stripAnsi(sh.welcome())).toContain('Simulated terminal');
    expect(sh.welcome()).not.toMatch(SWEDISH);
    expect(Shell.create('ubuntu').welcome()).toContain('Simulerad terminal');
  });

  test.each(['ubuntu', 'arch', 'fedora'])('inga svenska tecken i utskrifterna (%s)', (distro) => {
    const { sh, run } = shell(distro);
    // Installera alla program, så att även deras tipsrader körs.
    for (const pkg of PACKAGES) if (pkg.names[sh.distro.family]) installPackage(sh, pkg);
    const lines = [
      'help',
      'man man',
      'man tar',
      'ls --help',
      'sudo whoami',
      'su -',
      'bash',
      'nano anteckning.txt',
      'vim',
      'htop',
      'git status',
      'curl https://example.com',
      'wget https://example.com',
      'ssh elev@server',
      'python3',
      'top',
      `kill ${SHELL_PID}`,
      'sleep 300 &',
      'fg',
      'tail -f /etc/hostname',
      "awk 'function f() { return 1 } { print }' /etc/hostname",
      "awk '/a/,/b/' /etc/hostname",
      "sed 'h' /etc/hostname",
      'echo | read x; printf "read x\\n" > /tmp/r.sh; bash /tmp/r.sh < /dev/null',
      'f() { f; }; f',
      'while true; do true; done',
      'cowsay hej',
      'exit',
      'man nosuchcommand',
    ];
    for (const line of lines) {
      const out = run(line);
      if (sh.pending) run('n');
      expect(out, line).not.toMatch(SWEDISH);
    }
  });

  test('pakethanteraren i Debian/Ubuntu', () => {
    const { run } = shell('ubuntu');
    const out = run('sudo apt install tree') + run('sudo apt upgrade') + run('sudo apt remove bash');
    expect(out).toContain('Tip from the simulator');
    expect(out).not.toMatch(SWEDISH);
  });

  test('kommandot finns i ett paket', () => {
    const { run } = shell('fedora');
    const out = run('cowsay hej');
    expect(out).toContain('command not found');
    expect(out).toContain('Tip from the simulator');
    expect(out).not.toMatch(SWEDISH);
  });

  test('samma rader på svenska', () => {
    const { run } = shell('fedora', 'sv');
    expect(run('cowsay hej')).toContain('Tips från simulatorn');
    expect(run('bash')).toContain('Du kör redan bash!');
    expect(run('exit')).toContain('simulerad terminal');
  });
});
