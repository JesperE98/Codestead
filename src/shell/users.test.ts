import { describe, expect, test } from 'vitest';
import { stripAnsi } from './commands/util';
import { Shell } from './shell';
import { findGroup, findUser, loadDb } from './users';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  return { sh, run };
}

const shadowOf = (sh: Shell, name: string) => loadDb(sh).shadow.find((s) => s.name === name);

describe('användare läses från /etc/passwd och /etc/group', () => {
  test('elev och root fungerar som förut', () => {
    const { sh, run } = shell();
    expect(run('id').out).toBe('uid=1000(elev) gid=1000(elev) groups=1000(elev),27(sudo)\n');
    expect(run('groups').out).toBe('elev sudo\n');
    expect(run('id root').out).toBe('uid=0(root) gid=0(root) groups=0(root)\n');
    expect(sh.currentUser()).toEqual({ name: 'elev', uid: 1000, groups: ['elev', 'sudo'], home: '/home/elev' });
    expect(run('id -un').out).toBe('elev\n');
    expect(run('id -G').out).toBe('1000 27\n');
  });

  test('wheel i Arch och Fedora', () => {
    expect(shell('arch').run('id').out).toBe('uid=1000(elev) gid=1000(elev) groups=1000(elev),998(wheel)\n');
    expect(shell('fedora').run('groups elev').out).toBe('elev : elev wheel\n');
  });

  test('okända användare', () => {
    const { run } = shell();
    expect(run('id nisse').out).toBe("id: 'nisse': no such user\n");
    expect(run('groups nisse').exitCode).toBe(1);
  });

  test('gamla sparade terminaler (kort /etc/passwd, ingen /etc/skel) fungerar', () => {
    const { sh } = shell();
    const root = sh.rootUser();
    sh.vfs.writeFile('/etc/passwd', 'root:x:0:0:root:/root:/bin/bash\nelev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n', root);
    sh.vfs.writeFile('/etc/group', 'root:x:0:\nsudo:x:27:elev\nelev:x:1000:\n', root);
    sh.vfs.remove('/etc/skel', root);
    const snap = sh.snapshot();
    for (const k of Object.keys(snap.flags)) if (k.startsWith('default:file:/etc')) delete snap.flags[k];
    const restored = Shell.restore(JSON.parse(JSON.stringify(snap)))!;
    expect(restored.currentUser().groups).toEqual(['elev', 'sudo']);
    expect(restored.vfs.tryLookup('/etc/skel/.bashrc', root)).not.toBeNull();
    restored.execute('sudo useradd -m kim');
    expect(restored.execute('id kim').output).toBe('uid=1001(kim) gid=1001(kim) groups=1001(kim)\n');
  });

  test('ändringar i /etc/group syns direkt (cachen töms)', () => {
    const { run } = shell();
    run("echo 'spel:x:1500:elev' | sudo tee -a /etc/group");
    expect(run('groups').out).toBe('elev sudo spel\n');
  });
});

describe('useradd, usermod, userdel', () => {
  test('useradd -m -s skapar användare, grupp, hemkatalog och shadow-rad', () => {
    const { sh, run } = shell();
    expect(run('useradd kim').out).toContain('useradd: Permission denied.');
    expect(run('sudo useradd -m -s /bin/bash -c "Kim Svensson" kim').exitCode).toBe(0);
    expect(run('grep kim /etc/passwd').out).toBe('kim:x:1001:1001:Kim Svensson:/home/kim:/bin/bash\n');
    expect(findGroup(sh, 'kim')?.gid).toBe(1001);
    expect(shadowOf(sh, 'kim')?.hash).toBe('!');
    expect(run('ls -la /home/kim').out).toContain('Permission denied');
    expect(run('sudo ls -la /home/kim').out).toContain('.bashrc');
    const home = sh.vfs.tryLookup('/home/kim', sh.rootUser())!;
    expect([home.owner, home.group, home.mode]).toEqual(['kim', 'kim', 0o750]);
    expect(run('id kim').out).toBe('uid=1001(kim) gid=1001(kim) groups=1001(kim)\n');
    expect(run('sudo useradd kim').out).toBe("useradd: user 'kim' already exists\n");
    run('sudo useradd -m alex');
    expect(findUser(sh, 'alex')?.uid).toBe(1002);
  });

  test('standardvärden skiljer sig mellan familjerna', () => {
    const deb = shell('debian');
    deb.run('sudo useradd kim');
    expect(findUser(deb.sh, 'kim')?.shell).toBe('/bin/sh');
    expect(deb.sh.vfs.tryLookup('/home/kim', deb.sh.rootUser())).toBeNull();

    const fed = shell('fedora');
    fed.run('sudo useradd kim');
    expect(findUser(fed.sh, 'kim')?.shell).toBe('/bin/bash');
    expect(fed.sh.vfs.tryLookup('/home/kim', fed.sh.rootUser())?.mode).toBe(0o700);
    expect(shadowOf(fed.sh, 'kim')?.hash).toBe('!!');
  });

  test('ogiltiga namn och grupper', () => {
    const { run } = shell();
    expect(run('sudo useradd Kim').exitCode).toBe(3);
    expect(run('sudo useradd -G finnsinte kim').out).toBe("useradd: group 'finnsinte' does not exist\n");
  });

  test('usermod -aG lägger till, -G utan -a ersätter', () => {
    const { sh, run } = shell();
    run('sudo useradd -m kim');
    run('sudo groupadd utvecklare');
    run('sudo usermod -aG utvecklare kim');
    run('sudo usermod -aG sudo kim');
    expect(run('groups kim').out).toBe('kim : kim sudo utvecklare\n');
    run('sudo usermod -G utvecklare kim');
    expect(run('groups kim').out).toBe('kim : kim utvecklare\n');
    expect(run('sudo usermod -a kim').exitCode).toBe(2);
    run('sudo usermod -s /bin/zsh kim');
    expect(findUser(sh, 'kim')?.shell).toBe('/bin/zsh');
    expect(run('sudo usermod -s /bin/bash nisse').out).toBe("usermod: user 'nisse' does not exist\n");
  });

  test('usermod -L låser och -U låser upp', () => {
    const { sh, run } = shell();
    run('sudo useradd -m kim');
    run('sudo passwd kim');
    run('hemligt');
    run('hemligt');
    run('sudo usermod -L kim');
    expect(shadowOf(sh, 'kim')?.hash.startsWith('!$y$')).toBe(true);
    expect(run('sudo passwd -S kim').out).toMatch(/^kim L /);
    run('sudo usermod -U kim');
    expect(run('sudo passwd -S kim').out).toMatch(/^kim P /);
  });

  test('userdel -r tar bort allt; inloggade användare går inte att ta bort', () => {
    const { sh, run } = shell();
    run('sudo useradd -m -G sudo vikarie');
    expect(run('sudo userdel -r vikarie').exitCode).toBe(0);
    expect(findUser(sh, 'vikarie')).toBeUndefined();
    expect(findGroup(sh, 'vikarie')).toBeUndefined();
    expect(findGroup(sh, 'sudo')?.members).toEqual(['elev']);
    expect(shadowOf(sh, 'vikarie')).toBeUndefined();
    expect(sh.vfs.tryLookup('/home/vikarie', sh.rootUser())).toBeNull();
    expect(run('sudo userdel elev').out).toBe('userdel: user elev is currently used by process 1290\n');
    expect(run('sudo userdel nisse').exitCode).toBe(6);
  });
});

describe('grupper', () => {
  test('groupadd, gpasswd och groupdel', () => {
    const { sh, run } = shell();
    expect(run('groupadd utvecklare').exitCode).toBe(10);
    run('sudo groupadd utvecklare');
    expect(run('getent group utvecklare').out).toBe('utvecklare:x:1001:\n');
    expect(run('sudo groupadd utvecklare').out).toBe("groupadd: group 'utvecklare' already exists\n");
    expect(run('sudo gpasswd -a elev utvecklare').out).toBe('Adding user elev to group utvecklare\n');
    expect(findGroup(sh, 'utvecklare')?.members).toEqual(['elev']);
    expect(run('sudo gpasswd -d elev utvecklare').out).toBe('Removing user elev from group utvecklare\n');
    expect(run('sudo gpasswd -d elev utvecklare').exitCode).toBe(3);
    expect(run('sudo groupdel elev').out).toBe("groupdel: cannot remove the primary group of user 'elev'\n");
    expect(run('sudo groupdel utvecklare').exitCode).toBe(0);
    expect(findGroup(sh, 'utvecklare')).toBeUndefined();
  });

  test('chown och chgrp använder de riktiga grupperna', () => {
    const { run } = shell();
    run('sudo groupadd utvecklare');
    run('touch ~/fil.txt');
    expect(run('chgrp utvecklare ~/fil.txt').out).toContain('Operation not permitted');
    run('sudo usermod -aG utvecklare elev');
    expect(run('chgrp utvecklare ~/fil.txt').exitCode).toBe(0);
    expect(run('ls -l ~/fil.txt').out).toContain('elev utvecklare');
    expect(run('sudo chown nisse ~/fil.txt').out).toBe("chown: invalid user: 'nisse'\n");
    run('sudo useradd kim');
    expect(run('sudo chown kim: ~/fil.txt').exitCode).toBe(0);
    expect(run('ls -l ~/fil.txt').out).toContain('kim kim');
  });
});

describe('passwd och su', () => {
  test('passwd frågar två gånger och sparar en hash i /etc/shadow', () => {
    const { sh, run } = shell();
    run('sudo useradd -m kim');
    let r = run('sudo passwd kim');
    expect(r.pending).toBe(true);
    expect(sh.prompt()).toBe('New password: ');
    expect(sh.pending?.secret).toBe(true);
    r = run('hemligt123');
    expect(sh.prompt()).toBe('Retype new password: ');
    r = run('hemligt123');
    expect(r.out).toBe('passwd: password updated successfully\n');
    expect(r.line).toBe('sudo passwd kim');
    expect(shadowOf(sh, 'kim')?.hash).toMatch(/^\$y\$j9T\$/);
    expect(sh.history).not.toContain('hemligt123');
  });

  test('resten av raden körs efter båda frågorna', () => {
    const { run } = shell();
    run('sudo useradd kim');
    run('sudo passwd kim; echo klart');
    run('abc');
    expect(run('abc').out).toBe('passwd: password updated successfully\nklart\n');
    run('sudo passwd kim; echo klart');
    run('abc');
    expect(run('xyz').out).toMatch(/password unchanged\nklart\n$/);
  });

  test('olika lösenord godtas inte', () => {
    const { sh, run } = shell();
    run('sudo useradd kim');
    run('sudo passwd kim');
    run('ett');
    const r = run('två');
    expect(r.out).toContain('Sorry, passwords do not match.');
    expect(r.exitCode).toBe(10);
    expect(shadowOf(sh, 'kim')?.hash).toBe('!');
  });

  test('bara root får byta andras lösenord', () => {
    expect(shell().run('passwd root').out).toBe('passwd: You may not view or modify password information for root.\n');
    expect(shell('fedora').run('passwd root').out).toBe('passwd: Only root can specify a user name.\n');
  });

  test('su - kim kräver kims lösenord', () => {
    const { sh, run } = shell();
    run('sudo useradd -m -s /bin/bash kim');
    run('sudo passwd kim');
    run('hemligt');
    run('hemligt');
    run('su - kim');
    expect(sh.pending?.secret).toBe(true);
    expect(run('fel').out).toBe('su: Authentication failure\n');
    expect(run('whoami').out).toBe('elev\n');
    run('su - kim');
    run('hemligt');
    expect(run('whoami').out).toBe('kim\n');
    expect(sh.cwd).toBe('/home/kim');
    expect(sh.prompt()).toContain('kim@ubuntu');
    expect(run('sudo ls').out).toContain('kim is not in the sudoers file.');
    expect(run('exit').out).toBe('logout\n');
    expect(run('whoami').out).toBe('elev\n');
  });

  test('su utan lösenord på kontot och su som root', () => {
    const { run } = shell();
    run('sudo useradd -m kim');
    run('su kim');
    expect(run('vad som helst').out).toContain('su: Authentication failure');
    run('su -');
    expect(run('x').out).toContain('sudo -i');
    run('sudo -i');
    run('su - kim');
    expect(run('whoami').out).toBe('kim\n');
    run('exit');
    expect(run('su - daemon').out).toBe('This account is currently not available.\n');
  });

  test('su -c kör ett kommando', () => {
    const { run } = shell();
    run('sudo useradd -m kim');
    expect(run('sudo su -c whoami kim').out).toBe('kim\n');
    expect(run('whoami').out).toBe('elev\n');
  });

  test('chage -l visar fälten i /etc/shadow', () => {
    const { run } = shell();
    run('sudo useradd kim');
    expect(run('chage -l kim').out).toBe('chage: Permission denied.\n');
    run('sudo chage -M 90 kim');
    const out = run('sudo chage -l kim').out;
    expect(out).toContain('Maximum number of days between password change\t\t: 90'.replace('\t\t', '          '));
    expect(out).not.toContain('Password expires                                        : never');
    expect(run('chage -l elev').exitCode).toBe(0);
  });

  test('chpasswd läser användare:lösenord', () => {
    const { sh, run } = shell();
    run('sudo useradd kim');
    run("echo 'kim:hemligt' | sudo chpasswd");
    expect(shadowOf(sh, 'kim')?.hash).toMatch(/^\$y\$/);
  });
});

describe('sudo -u och sudo -i', () => {
  test('sudo -u kör som en annan användare', () => {
    const { run } = shell();
    run('sudo useradd -m kim');
    expect(run('sudo -u kim whoami').out).toBe('kim\n');
    expect(run('sudo -u nisse whoami').out).toBe('sudo: unknown user nisse\n');
    expect(run('sudo -u kim touch /home/elev/x').out).toContain('Permission denied');
  });

  test('ny användare i sudo-gruppen får använda sudo', () => {
    const { run } = shell('arch');
    run('sudo useradd -m -G wheel kim');
    run('sudo -iu kim');
    expect(run('whoami').out).toBe('kim\n');
    expect(run('sudo whoami').out).toContain('root');
    run('exit');
    expect(run('whoami').out).toBe('elev\n');
  });
});

describe('adduser (Debian-familjen)', () => {
  test('frågar efter lösenord och namn', () => {
    const { sh, run } = shell('debian');
    expect(run('adduser kim').out).toBe('fatal: Only root may add a user or group to the system.\n');
    let r = run('sudo adduser kim');
    expect(r.out).toContain("info: Adding user `kim' ...");
    expect(r.out).toContain("info: Creating home directory `/home/kim' ...");
    expect(sh.prompt()).toBe('New password: ');
    run('hemligt');
    r = run('hemligt');
    expect(r.out).toContain('passwd: password updated successfully');
    expect(sh.prompt()).toBe('\tFull Name []: ');
    run('Kim Svensson');
    expect(sh.prompt()).toBe('Is the information correct? [Y/n] ');
    r = run('');
    expect(r.out).toContain("Adding user `kim' to group `users'");
    expect(findUser(sh, 'kim')).toMatchObject({ uid: 1001, gecos: 'Kim Svensson,,,', shell: '/bin/bash', home: '/home/kim' });
    expect(run('sudo adduser kim sudo').out).toBe("info: Adding user `kim' to group `sudo' ...\n");
    expect(run('groups kim').out).toBe('kim : kim sudo users\n');
    run('sudo deluser --remove-home kim');
    expect(findUser(sh, 'kim')).toBeUndefined();
  });

  test('finns inte i Arch', () => {
    expect(shell('arch').run('sudo adduser kim').out).toContain('command not found');
  });
});

describe('who, w, last, getent', () => {
  test('visar den inloggade användaren', () => {
    const { run } = shell();
    expect(run('who').out).toMatch(/^elev\s+pts\/0\s+\d{4}-\d\d-\d\d 08:12\n$/);
    expect(run('w').out).toContain('USER     TTY');
    expect(run('last').out).toContain('still logged in');
    expect(run('getent passwd elev').out).toBe('elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n');
    expect(run('getent group 27').out).toBe('sudo:x:27:elev\n');
    expect(run('getent passwd nisse').exitCode).toBe(2);
    expect(run('getent shadow').exitCode).toBe(2);
    expect(run('sudo getent shadow root').out).toMatch(/^root:\*:/m);
  });

  test('paketen heter olika i familjerna', () => {
    const arch = shell('arch');
    expect(arch.sh.installed.shadow).toBeDefined();
    expect(arch.sh.installed.adduser).toBeUndefined();
    expect(shell('debian').sh.installed.adduser).toBeDefined();
  });
});
