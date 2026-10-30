import { describe, expect, test } from 'vitest';
import { readArchive } from './commands/archive';
import { stripAnsi } from './commands/util';
import { Shell } from './shell';
import { nodeSize } from './vfs';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  const node = (path: string) => sh.vfs.tryLookup(path.replace(/^~/, '/home/elev'), sh.rootUser());
  return { sh, run, node };
}

describe('tar', () => {
  test('innehåll och rättigheter överlever tar -c följt av tar -x', () => {
    const { run, node } = shell();
    run('mkdir -p projekt/hemligt && echo "echo hej" > projekt/kör.sh && echo topphemligt > projekt/hemligt/nyckel');
    run('chmod 755 projekt/kör.sh && chmod 600 projekt/hemligt/nyckel && chmod 700 projekt/hemligt');
    expect(run('tar -cf projekt.tar projekt dokument/frukter.txt').exitCode).toBe(0);
    run('mkdir ut');
    expect(run('tar -xf projekt.tar -C ut').exitCode).toBe(0);

    expect(node('~/ut/projekt/kör.sh')?.content).toBe('echo hej\n');
    expect(node('~/ut/projekt/hemligt/nyckel')?.content).toBe('topphemligt\n');
    expect(node('~/ut/dokument/frukter.txt')?.content).toBe(node('~/dokument/frukter.txt')?.content);
    expect(node('~/ut/projekt/kör.sh')!.mode & 0o777).toBe(0o755);
    expect(node('~/ut/projekt/hemligt/nyckel')!.mode & 0o777).toBe(0o600);
    expect(node('~/ut/projekt/hemligt')!.mode & 0o777).toBe(0o700);
    expect(node('~/ut/projekt/kör.sh')!.mtime).toBe(node('~/projekt/kör.sh')!.mtime);
    expect(run('ut/projekt/kör.sh').out).toBe('hej\n');
  });

  test('ihopskrivna flaggor, med och utan bindestreck', () => {
    const { run, node } = shell();
    expect(run('tar czvf d.tar.gz dokument').out).toBe('dokument/\ndokument/frukter.txt\ndokument/server.log\n');
    expect(run('tar -tzf d.tar.gz').out).toBe('dokument/\ndokument/frukter.txt\ndokument/server.log\n');
    expect(run('tar -c -z -f d2.tgz dokument anteckningar.txt').exitCode).toBe(0);
    expect(run('tar --list --file=d2.tgz').out).toContain('anteckningar.txt\n');
    run('rm -r dokument');
    expect(run('tar -xzf d.tar.gz').exitCode).toBe(0);
    expect(node('~/dokument/server.log')?.content).toContain('Servern startar');
  });

  test('tar -tv visar rättigheter, ägare och storlek som ls -l', () => {
    const { run } = shell();
    run('tar -cf d.tar dokument');
    const lines = run('tar -tvf d.tar').out.split('\n');
    expect(lines[0]).toMatch(/^drwxr-xr-x elev\/elev {9}0 \d{4}-\d\d-\d\d \d\d:\d\d dokument\/$/);
    expect(lines[1]).toMatch(/^-rw-r--r-- elev\/elev {8}64 .* dokument\/frukter\.txt$/);
  });

  test('gzip-komprimerade arkiv är mindre och ser binära ut', () => {
    const { run, node } = shell();
    run('tar -cf d.tar dokument && tar -czf d.tar.gz dokument');
    expect(nodeSize(node('~/d.tar')!)).toBe(10240);
    expect(nodeSize(node('~/d.tar.gz')!)).toBeLessThan(1000);
    expect(run('ls -l d.tar').out).toContain(' 10240 ');
    expect(run('du -h d.tar d.tar.gz').out).toBe('12K\td.tar\n4.0K\td.tar.gz\n');
    const cat = run('cat d.tar.gz').out;
    expect(cat).not.toContain('Servern startar');
    expect(cat).not.toContain('frukter');
    expect(readArchive(node('~/d.tar.gz')!.content!)?.format).toBe('tar.gz');
  });

  test('felmeddelanden som i GNU tar', () => {
    const { run } = shell();
    expect(run('tar -cf x.tar').out).toBe(
      "tar: Cowardly refusing to create an empty archive\nTry 'tar --help' or 'tar --usage' for more information.\n",
    );
    expect(run('tar -xf finnsinte.tar').out).toBe(
      'tar: finnsinte.tar: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n',
    );
    const missing = run('tar -cf x.tar dokument finnsinte');
    expect(missing.out).toBe('tar: finnsinte: Cannot stat: No such file or directory\ntar: Exiting with failure status due to previous errors\n');
    expect(missing.exitCode).toBe(2);
    run('tar -cf okomprimerad.tar dokument');
    expect(run('tar -xzf okomprimerad.tar').out).toContain('gzip: stdin: not in gzip format');
    expect(run('tar -tf anteckningar.txt').out).toContain('This does not look like a tar archive');
    expect(run('tar -f x.tar').out).toContain("You must specify one of the '-Acdtrux'");
    expect(run('tar -c dokument').out).toContain('Refusing to write archive contents to terminal');
    expect(run('tar -czf /etc/x.tgz dokument').out).toContain('/etc/x.tgz: Cannot open: Permission denied');
    expect(run('tar -xf okomprimerad.tar -C finnsinte').out).toContain('finnsinte: Cannot chdir: No such file or directory');
  });

  test('absoluta sökvägar görs relativa', () => {
    const { run } = shell();
    expect(run('tar -cf abs.tar ~/dokument').out).toBe("tar: Removing leading `/' from member names\n");
    expect(run('tar -tf abs.tar').out).toContain('home/elev/dokument/frukter.txt\n');
  });

  test('tar genom pipes och utvalda filer', () => {
    const { run, node } = shell();
    run('mkdir kopia');
    expect(run('tar -cf - dokument | tar -xvf - -C kopia').out).toBe('dokument/\ndokument/frukter.txt\ndokument/server.log\n');
    expect(node('~/kopia/dokument/frukter.txt')).not.toBeNull();
    run('tar -cf d.tar dokument');
    run('mkdir bara');
    run('tar -xf d.tar -C bara dokument/server.log');
    expect(node('~/bara/dokument/server.log')).not.toBeNull();
    expect(node('~/bara/dokument/frukter.txt')).toBeNull();
    expect(run('tar -tf d.tar saknas').out).toContain('tar: saknas: Not found in archive');
  });

  test('root behåller ägaren, vanliga användare blir ägare själva', () => {
    const { run, node } = shell();
    run('sudo tar -cf /tmp/etc.tar /etc/hostname');
    run('mkdir som-elev');
    run('tar -xf /tmp/etc.tar -C som-elev');
    expect(node('~/som-elev/etc/hostname')?.owner).toBe('elev');
    run('sudo mkdir /tmp/som-root');
    run('sudo tar -xf /tmp/etc.tar -C /tmp/som-root');
    expect(node('/tmp/som-root/etc/hostname')?.owner).toBe('root');
  });

  test('filer som inte går att läsa hoppas över', () => {
    const { run } = shell();
    const r = run('tar -cf shadow.tar /etc/shadow');
    expect(r.out).toContain('tar: etc/shadow: Cannot open: Permission denied');
    expect(r.exitCode).toBe(2);
  });
});

describe('gzip', () => {
  test('gzip ersätter filen, gunzip återställer den', () => {
    const { run, node } = shell();
    const original = node('~/dokument/server.log')!.content;
    run('chmod 640 dokument/server.log');
    expect(run('gzip -v dokument/server.log').out).toMatch(/^dokument\/server\.log:\t +\d+\.\d% -- replaced with dokument\/server\.log\.gz\n$/);
    expect(node('~/dokument/server.log')).toBeNull();
    const gz = node('~/dokument/server.log.gz')!;
    expect(nodeSize(gz)).toBeLessThan(original!.length);
    expect(gz.mode & 0o777).toBe(0o640);
    expect(run('zcat dokument/server.log.gz').out).toBe(original);
    expect(run('gzip -l dokument/server.log.gz').out).toMatch(/compressed\s+uncompressed\s+ratio uncompressed_name\n\s+\d+\s+848\s+\d+\.\d% dokument\/server\.log\n/);
    run('gunzip dokument/server.log.gz');
    expect(node('~/dokument/server.log')?.content).toBe(original);
    expect(node('~/dokument/server.log.gz')).toBeNull();
    expect(node('~/dokument/server.log')!.mode & 0o777).toBe(0o640);
  });

  test('-k behåller originalet, små filer blir större', () => {
    const { run, node } = shell();
    run('gzip -k dokument/frukter.txt');
    expect(node('~/dokument/frukter.txt')).not.toBeNull();
    expect(nodeSize(node('~/dokument/frukter.txt.gz')!)).toBeGreaterThan(nodeSize(node('~/dokument/frukter.txt')!));
    expect(run('gzip dokument/frukter.txt').out).toBe('gzip: dokument/frukter.txt.gz already exists; not overwritten\n');
    expect(run('gzip -f dokument/frukter.txt').exitCode).toBe(0);
  });

  test('felfall', () => {
    const { run } = shell();
    expect(run('gzip finnsinte').out).toBe('gzip: finnsinte: No such file or directory\n');
    expect(run('gzip dokument').out).toBe('gzip: dokument is a directory -- ignored\n');
    expect(run('gunzip anteckningar.txt').out).toBe('gzip: anteckningar.txt: unknown suffix -- ignored\n');
    run('cp anteckningar.txt falsk.gz');
    expect(run('gunzip falsk.gz').out).toBe('gzip: falsk.gz: not in gzip format\n');
    expect(run('gzip').out).toContain('compressed data not written to a terminal');
    run('gzip anteckningar.txt');
    expect(run('gzip anteckningar.txt.gz').out).toBe('gzip: anteckningar.txt.gz already has .gz suffix -- unchanged\n');
  });

  test('gzip och gunzip i pipes', () => {
    const { run } = shell();
    expect(run('echo hej | gzip | gunzip').out).toBe('hej\n');
    expect(run('gzip -c dokument/frukter.txt > f.gz && zcat f.gz | sort | head -1').out).toBe('apelsin\n');
    run('tar -cf - dokument | gzip > pipe.tar.gz');
    expect(run('tar -tzf pipe.tar.gz').out).toContain('dokument/server.log\n');
  });

  test('gunzip på en .tar.gz ger en .tar', () => {
    const { run, node } = shell();
    run('tar -czf d.tgz dokument');
    run('gunzip d.tgz');
    expect(node('~/d.tar')).not.toBeNull();
    expect(nodeSize(node('~/d.tar')!)).toBe(10240);
    expect(run('tar -tf d.tar').out).toContain('dokument/frukter.txt');
  });
});

describe('zip och unzip', () => {
  test('måste installeras med pakethanteraren', () => {
    const { run } = shell();
    expect(run('zip -r d.zip dokument').exitCode).toBe(127);
    expect(run('unzip d.zip').exitCode).toBe(127);
    expect(run('tar --help').exitCode).toBe(0);
    expect(run('which tar gzip gunzip zcat du').exitCode).toBe(0);
  });

  test.each(['debian', 'arch', 'fedora'])('zip -r och unzip -d i %s', (distro) => {
    const { run, node } = shell(distro);
    const install = {
      debian: ['sudo apt update', 'sudo apt install zip unzip'],
      arch: ['sudo pacman -S --noconfirm zip unzip'],
      fedora: ['sudo dnf install -y zip unzip'],
    }[distro]!;
    for (const line of install) run(line);
    expect(run('zip d.zip dokument').out).toBe('  adding: dokument/ (stored 0%)\n');
    expect(run('zip -r d.zip dokument').out).toMatch(
      /^ {2}updating: dokument\/ \(stored 0%\)\n {2}adding: dokument\/frukter\.txt \((deflated \d+%|stored 0%)\)\n {2}adding: dokument\/server\.log \(deflated \d+%\)\n$/,
    );
    expect(run('unzip -l d.zip').out).toContain('      848  ');
    const r = run('unzip d.zip -d ut');
    expect(r.out).toContain('Archive:  d.zip\n   creating: ut/dokument/\n');
    expect(r.out).toContain('  inflating: ut/dokument/server.log\n');
    expect(node('~/ut/dokument/server.log')?.content).toBe(node('~/dokument/server.log')?.content);
    expect(run('unzip d.zip -d ut').out).toContain('skipping: ut/dokument/server.log');
    expect(run('unzip -o d.zip -d ut').out).toContain('inflating: ut/dokument/server.log');
    expect(run('unzip finnsinte.zip').out).toBe('unzip:  cannot find or open finnsinte.zip, finnsinte.zip.zip or finnsinte.zip.ZIP.\n');
    expect(run('zip tom.zip finnsinte').exitCode).toBe(12);
  });
});

describe('du', () => {
  test('-s, -h och -a', () => {
    const { run } = shell();
    expect(run('du -sh dokument').out).toBe('12K\tdokument\n');
    expect(run('du -s dokument').out).toBe('12\tdokument\n');
    expect(run('du -a dokument').out).toBe('4\tdokument/frukter.txt\n4\tdokument/server.log\n12\tdokument\n');
    expect(run('du -sb dokument').out).toBe(`${4096 + 64 + 848}\tdokument\n`);
    expect(run('du finnsinte').out).toBe("du: cannot access 'finnsinte': No such file or directory\n");
  });
});

describe('spara och återställa med arkiv', () => {
  test('snapshot (JSON) fungerar med arkiv i filsystemet', () => {
    const { run, sh } = shell('fedora');
    run('tar -czf d.tar.gz dokument');
    run('gzip -k anteckningar.txt');
    const json = JSON.stringify(sh.snapshot());
    const restored = Shell.restore(JSON.parse(json))!;
    const out = (line: string) => stripAnsi(restored.execute(line).output);
    expect(out('ls -l d.tar.gz')).toMatch(/ \d{3} .* d\.tar\.gz\n$/);
    expect(out('tar -tzf d.tar.gz')).toBe('dokument/\ndokument/frukter.txt\ndokument/server.log\n');
    out('mkdir ut && tar -xzf d.tar.gz -C ut');
    const user = restored.rootUser();
    expect(restored.vfs.readFile('/home/elev/ut/dokument/server.log', user)).toBe(
      sh.vfs.readFile('/home/elev/dokument/server.log', user),
    );
    expect(out('zcat anteckningar.txt.gz')).toBe(sh.vfs.readFile('/home/elev/anteckningar.txt', user));
  });
});
