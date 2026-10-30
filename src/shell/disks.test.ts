import { describe, expect, test } from 'vitest';
import { stripAnsi } from './commands/util';
import { fstabFor, rootUuid, USB_PART, USB_UUID } from './disks';
import { DISTROS, getDistro } from './distros';
import { Shell } from './shell';

function shell(distro = 'ubuntu') {
  const sh = Shell.create(distro);
  const run = (line: string) => {
    const r = sh.execute(line);
    return { ...r, out: stripAnsi(r.output) };
  };
  const node = (path: string) => sh.vfs.tryLookup(path.replace(/^~/, '/home/elev'), sh.rootUser());
  const usbMounted = () => sh.disks.mounts.find((m) => m.dev === USB_PART);
  return { sh, run, node, usbMounted };
}

describe('lsblk och blkid', () => {
  test('lsblk visar systemdisken och den omonterade USB-stickan som ett träd', () => {
    const { run } = shell();
    const out = run('lsblk').out;
    expect(out.split('\n')[0]).toBe('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS');
    expect(out).toContain('├─sda1   8:1    0    1G  0 part /boot/efi');
    expect(out).toContain('├─sda2   8:2    0   61G  0 part /');
    expect(out).toContain('└─sda3   8:3    0    2G  0 part [SWAP]');
    expect(out).toContain('sdb      8:16   1 14.9G  0 disk');
    expect(out).toMatch(/└─sdb1 +8:17 +1 14\.9G +0 part\n/);
  });

  test('lsblk -f visar typ, etikett och UUID', () => {
    const { run } = shell();
    const out = run('lsblk -f').out;
    expect(out).toMatch(/^NAME +FSTYPE FSVER LABEL +UUID +FSAVAIL FSUSE% MOUNTPOINTS/);
    expect(out).toMatch(/sdb1 vfat +FAT32 USBMINNE 7E21-9A4F\n/);
    expect(out).toContain(rootUuid(getDistro('ubuntu')));
  });

  test('lsblk -o, -d, -p och okända kolumner', () => {
    const { run } = shell();
    expect(run('lsblk -d -o NAME,SIZE,RM').out).toBe('NAME  SIZE RM\nsda    64G  0\nsdb  14.9G  1\n');
    expect(run('lsblk -p -n -o NAME /dev/sdb').out).toBe('/dev/sdb\n└─/dev/sdb1\n');
    const bad = run('lsblk -o NAME,KAKA');
    expect(bad.exitCode).toBe(1);
    expect(bad.out).toContain('unknown column: KAKA');
  });

  test('Fedora: btrfs på både / och /home, och swap i zram', () => {
    const { run } = shell('fedora');
    const out = run('lsblk').out;
    expect(out).toMatch(/└─sda3 .* part \/home\n +\/\n/);
    expect(out).toContain('zram0  251:0    0    2G  0 disk [SWAP]');
    expect(run('swapon --show').out).toContain('/dev/zram0 partition   2G   0B  100');
    expect(run('findmnt /home').out).toContain('/dev/sda3[/home] btrfs');
  });

  test('blkid med -s, -o value, -L och -U', () => {
    const { run } = shell('arch');
    expect(run('blkid -s UUID -o value /dev/sdb1').out).toBe(`${USB_UUID}\n`);
    expect(run('blkid /dev/sdb1').out).toBe(
      `/dev/sdb1: LABEL="USBMINNE" UUID="${USB_UUID}" BLOCK_SIZE="512" TYPE="vfat" PARTUUID="5d3a1c7e-01"\n`,
    );
    expect(run('blkid -L USBMINNE').out).toBe('/dev/sdb1\n');
    expect(run(`blkid -U ${rootUuid(getDistro('arch'))}`).out).toBe('/dev/sda3\n');
    expect(run('blkid -L FINNSINTE').exitCode).toBe(2);
  });

  test.each(DISTROS.map((d) => [d.id]))('%s: alla UUID i /etc/fstab finns på diskarna', (id) => {
    const { run } = shell(id);
    const fstab = run('cat /etc/fstab').out;
    expect(fstab).toBe(fstabFor(getDistro(id)));
    const uuids = [...fstab.matchAll(/^UUID=(\S+)/gm)].map((m) => m[1]);
    expect(uuids.length).toBeGreaterThanOrEqual(2);
    const blkid = run('blkid').out;
    for (const u of uuids) expect(blkid).toContain(`UUID="${u}"`);
    expect(run('findmnt -n -o UUID /').out).toBe(`${rootUuid(getDistro(id))}\n`);
  });
});

describe('df', () => {
  test('df -h visar monterade filsystem, även tmpfs, men inte proc', () => {
    const { run } = shell();
    const out = run('df -h').out;
    expect(out.split('\n')[0]).toBe('Filesystem      Size  Used Avail Use% Mounted on');
    expect(out).toMatch(/^\/dev\/sda2 +60G +\S+ +\S+ +\d+% \/$/m);
    expect(out).toMatch(/^tmpfs .* \/run$/m);
    expect(out).not.toContain('/proc');
  });

  test('df -T, -x och en sökväg', () => {
    const { run } = shell('debian');
    expect(run('df -hT').out).toMatch(/^\/dev\/sda1 +vfat /m);
    // Debian 13 har /tmp i RAM-minnet.
    expect(run('df /tmp').out).toMatch(/^tmpfs .* \/tmp$/m);
    const real = run('df -x tmpfs -x devtmpfs').out;
    expect(real).not.toContain('tmpfs');
    expect(real.trim().split('\n')).toHaveLength(3);
    expect(run('df ~').out).toMatch(/\/dev\/sda2 .* \/\n$/);
    const missing = run('df /finns/inte');
    expect(missing.exitCode).toBe(1);
    expect(missing.out).toContain("df: /finns/inte: No such file or directory");
  });

  test('stora filer syns i df', () => {
    const { run, sh } = shell();
    const used = () => Number(/\/dev\/sda2 +\d+ +(\d+)/.exec(run('df').out)![1]);
    const before = used();
    run('head -c 0 /dev/null > ~/stor.bin');
    sh.vfs.lookup('/home/elev/stor.bin', sh.rootUser()).size = 50 * 1024 * 1024;
    expect(used() - before).toBe(50 * 1024);
  });
});

describe('mount och umount', () => {
  test('montera kräver root och en befintlig monteringspunkt', () => {
    const { run, usbMounted } = shell();
    let r = run('mount /dev/sdb1 /mnt/usb');
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain('mount: /mnt/usb: must be superuser to use mount.');
    r = run('sudo mount /dev/sdb1 /mnt/usb');
    expect(r.exitCode).toBe(32);
    expect(r.out).toContain('mount: /mnt/usb: mount point does not exist.');
    run('sudo mkdir /mnt/usb');
    r = run('sudo mount /dev/sdb /mnt/usb');
    expect(r.out).toContain('wrong fs type, bad option, bad superblock on /dev/sdb');
    expect(r.out).toContain('prova /dev/sdb1');
    r = run('sudo mount /dev/sdc1 /mnt/usb');
    expect(r.out).toContain('special device /dev/sdc1 does not exist');
    expect(run('sudo mount /dev/sda3 /mnt/usb').out).toContain("unknown filesystem type 'swap'");
    expect(run('sudo mount /dev/sda1 /mnt/usb').out).toContain('/dev/sda1 already mounted on /boot/efi.');
    expect(run('sudo mount -t ext4 /dev/sdb1 /mnt/usb').out).toContain('wrong fs type');
    expect(usbMounted()).toBeUndefined();
  });

  test('filerna dyker upp vid mount och försvinner vid umount – ändringar sparas på stickan', () => {
    const { run, node, usbMounted } = shell();
    run('sudo mkdir -p /mnt/usb');
    run('sudo touch /mnt/usb/gömd.txt');
    expect(run('sudo mount /dev/sdb1 /mnt/usb').exitCode).toBe(0);
    expect(usbMounted()?.target).toBe('/mnt/usb');
    expect(run('ls -1 /mnt/usb').out).toBe('att-gora.txt\nrapport.pdf\nsemester.jpg\n');
    // Det som låg i katalogen förut döljs.
    expect(node('/mnt/usb/gömd.txt')).toBeNull();

    // FAT: allt ägs av den som monterade, och vanliga användare får inte skriva.
    expect(node('/mnt/usb/rapport.pdf')?.owner).toBe('root');
    expect(run('cp ~/dokument/frukter.txt /mnt/usb/').exitCode).toBe(1);
    expect(run('sudo cp ~/dokument/frukter.txt /mnt/usb/').exitCode).toBe(0);
    expect(run('cp /mnt/usb/rapport.pdf ~').exitCode).toBe(0);
    expect(node('~/rapport.pdf')?.content).toContain('%PDF');
    expect(run('cat /proc/mounts').out).toContain('/dev/sdb1 /mnt/usb vfat rw,relatime,fmask=0022');

    expect(run('sudo umount /mnt/usb').exitCode).toBe(0);
    expect(usbMounted()).toBeUndefined();
    expect(run('ls -1 /mnt/usb').out).toBe('gömd.txt\n');
    expect(run('cat /proc/mounts').out).not.toContain('sdb1');

    // Monteras igen – med etiketten och som ägare elev.
    expect(run('sudo mount -o uid=1000,gid=1000 LABEL=USBMINNE /mnt/usb').exitCode).toBe(0);
    expect(run('ls -1 /mnt/usb').out).toBe('att-gora.txt\nfrukter.txt\nrapport.pdf\nsemester.jpg\n');
    expect(node('/mnt/usb/frukter.txt')?.owner).toBe('elev');
    expect(run('touch /mnt/usb/egen.txt').exitCode).toBe(0);
    expect(run('mount -t vfat').out).toContain('/dev/sdb1 on /mnt/usb type vfat (rw,relatime,uid=1000,gid=1000,');
    expect(run('sudo umount -v /dev/sdb1').out).toBe('umount: /mnt/usb unmounted\n');
  });

  test('umount: target is busy, not mounted och systemets filsystem', () => {
    const { run, usbMounted } = shell();
    run('sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb');
    run('cd /mnt/usb');
    let r = run('sudo umount /mnt/usb');
    expect(r.exitCode).toBe(32);
    expect(r.out).toContain('umount: /mnt/usb: target is busy.');
    expect(usbMounted()).toBeDefined();
    r = run('umount /mnt/usb');
    expect(r.out).toContain('must be superuser to use umount');
    run('cd ~');
    expect(run('sudo umount /mnt/usb').exitCode).toBe(0);
    expect(run('sudo umount /mnt/usb').out).toContain('umount: /mnt/usb: not mounted.');
    expect(run('sudo umount /mnt/finnsinte').out).toContain('no mount point specified');
    expect(run('sudo umount /').out).toContain('umount: /: target is busy.');
    expect(run('sudo umount /boot/efi').exitCode).toBe(32);
  });

  test('samma partition kan inte monteras två gånger, och en upptagen monteringspunkt vägras', () => {
    const { run } = shell();
    run('sudo mkdir -p /mnt/usb /mnt/b');
    run('sudo mount /dev/sdb1 /mnt/usb');
    expect(run('sudo mount /dev/sdb1 /mnt/b').out).toContain('/dev/sdb1 already mounted on /mnt/usb.');
    expect(run('sudo mount -t tmpfs tmpfs /mnt/usb').out).toContain('already mounted or mount point busy');
  });

  test('mount utan argument och findmnt', () => {
    const { run } = shell('arch');
    const list = run('mount').out;
    expect(list).toContain('/dev/sda3 on / type ext4 (rw,relatime)');
    expect(list).toContain('/dev/sda1 on /boot type vfat');
    expect(list).toContain('proc on /proc type proc');
    const tree = run('findmnt').out;
    expect(tree.split('\n')[0]).toMatch(/^TARGET +SOURCE +FSTYPE +OPTIONS$/);
    expect(tree).toMatch(/^\/ +\/dev\/sda3 +ext4/m);
    expect(tree).toMatch(/^├─\/proc +proc +proc/m);
    expect(tree).toMatch(/^│ └─\/dev\/shm +tmpfs/m);
    expect(run('findmnt -n -o TARGET,FSTYPE -t vfat').out).toBe('/boot vfat\n');
    expect(run('findmnt /mnt').exitCode).toBe(1);
  });

  test('tmpfs finns bara i RAM-minnet', () => {
    const { run, node } = shell();
    run('sudo mkdir /mnt/ram');
    expect(run('sudo mount -t tmpfs -o size=100M tmpfs /mnt/ram').exitCode).toBe(0);
    expect(run('df -h /mnt/ram').out).toMatch(/^tmpfs +100M .* \/mnt\/ram$/m);
    run('echo hej > /mnt/ram/fil.txt');
    expect(node('/mnt/ram/fil.txt')?.content).toBe('hej\n');
    expect(run('sudo umount /mnt/ram').exitCode).toBe(0);
    expect(node('/mnt/ram/fil.txt')).toBeNull();
  });

  test('/etc/fstab: mount -a och en rad med user', () => {
    const { run, usbMounted } = shell('fedora');
    run('sudo mkdir -p /mnt/usb');
    run("echo 'LABEL=USBMINNE /mnt/usb vfat noauto,user,uid=1000,gid=1000 0 0' | sudo tee -a /etc/fstab");
    // noauto: mount -a hoppar över den, och allt annat är redan monterat.
    expect(run('sudo mount -a').exitCode).toBe(0);
    expect(usbMounted()).toBeUndefined();
    // user: vanliga användare får montera den.
    expect(run('mount /mnt/usb').exitCode).toBe(0);
    expect(usbMounted()?.target).toBe('/mnt/usb');
    expect(run('touch /mnt/usb/egen.txt').exitCode).toBe(0);
    run('sudo umount /mnt/usb');
    run("sudo sed -i 's/noauto,//' /etc/fstab");
    expect(run('sudo mount -a').exitCode).toBe(0);
    expect(usbMounted()?.target).toBe('/mnt/usb');
    expect(run('sudo mount /mnt/finnsinte').out).toContain("can't find in /etc/fstab");
  });
});

describe('fdisk, swapon och mkfs', () => {
  test('fdisk -l kräver root och visar partitionstabellerna', () => {
    const { run } = shell();
    expect(run('fdisk -l').out).toContain('fdisk: cannot open /dev/sda: Permission denied');
    const out = run('sudo fdisk -l').out;
    expect(out).toContain('Disk /dev/sda: 64 GiB, 68719476736 bytes, 134217728 sectors');
    expect(out).toContain('Disklabel type: gpt');
    expect(out).toMatch(/\/dev\/sda1 +2048 +2099199 +2097152 +1G EFI System/);
    expect(out).toContain('Disk /dev/sdb: 14.91 GiB');
    expect(out).toMatch(/\/dev\/sdb1 +2048 31277231 31275184 14\.9G  c W95 FAT32 \(LBA\)/);
    const interactive = run('sudo fdisk /dev/sdb');
    expect(interactive.exitCode).toBe(1);
    expect(interactive.out).toContain('Welcome to fdisk');
  });

  test('swapon visar swap-partitionen', () => {
    const { run } = shell('debian');
    expect(run('swapon').out).toBe('NAME      TYPE      SIZE USED PRIO\n/dev/sda3 partition   2G   0B   -2\n');
  });

  test('mkfs.ext4 frågar först, och formaterar sedan bort allt', () => {
    const { run, sh } = shell();
    expect(run('mkfs.ext4 /dev/sdb1').out).toContain('Permission denied');
    let r = run('sudo mkfs.ext4 -L BACKUP /dev/sdb1');
    expect(r.out).toContain("/dev/sdb1 contains a vfat file system labelled 'USBMINNE'");
    expect(r.pending).toBe(true);
    expect(run('n').exitCode).toBe(1);
    expect(run('blkid -s TYPE -o value /dev/sdb1').out).toBe('vfat\n');
    run('sudo mkfs.ext4 -L BACKUP /dev/sdb1');
    r = run('y');
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain('Creating journal (16384 blocks): done');
    expect(run('lsblk -f /dev/sdb1').out).toMatch(/sdb1 ext4 +1\.0 +BACKUP /);
    expect(sh.disks.disks[1].partitions[0].uuid).not.toBe(USB_UUID);
    run('sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb');
    expect(run('ls -A /mnt/usb').out).toBe('lost+found\n');
    // Monterade och aktiva partitioner går inte att formatera.
    expect(run('sudo mkfs.ext4 /dev/sdb1').out).toContain('/dev/sdb1 is mounted; will not make a filesystem here!');
    expect(run('sudo mkfs.ext4 /dev/sda2').out).toContain('is mounted');
    expect(run('sudo mkfs.ext4 /dev/sda3').out).toContain('apparently in use by the system');
    run('sudo umount /mnt/usb');
    expect(run('sudo mkfs.vfat -n USBMINNE /dev/sdb1').exitCode).toBe(0);
    expect(run('blkid -s LABEL -o value /dev/sdb1').out).toBe('USBMINNE\n');
    expect(run('sudo mkfs -t xfs /dev/sdb1').out).toContain('failed to execute mkfs.xfs');
  });

  test('mkfs.vfat följer inte med Arch från början', () => {
    const { run } = shell('arch');
    expect(run('sudo mkfs.vfat /dev/sdb1').out).toContain('command not found');
    expect(run('which mkfs.ext4').exitCode).toBe(0);
  });
});

describe('sparat tillstånd', () => {
  test('monteringar och stickans innehåll överlever snapshot/restore', () => {
    const { sh, run } = shell();
    run('sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb && sudo cp ~/dokument/frukter.txt /mnt/usb/');
    const copy = Shell.restore(JSON.parse(JSON.stringify(sh.snapshot())))!;
    expect(copy.disks.mounts.some((m) => m.dev === USB_PART && m.target === '/mnt/usb')).toBe(true);
    expect(copy.execute('sudo umount /mnt/usb').exitCode).toBe(0);
    const again = Shell.restore(JSON.parse(JSON.stringify(copy.snapshot())))!;
    again.execute('sudo mount /dev/sdb1 /mnt/usb');
    expect(stripAnsi(again.execute('ls /mnt/usb').output)).toContain('frukter.txt');
  });

  test('ett gammalt sparat skal utan diskar får diskar, ny fstab och de nya kommandona', () => {
    const { sh } = shell('fedora');
    const old = JSON.parse(JSON.stringify(sh.snapshot()));
    delete old.disks;
    for (const k of Object.keys(old.flags)) if (k.startsWith('default:cmd:')) delete old.flags[k];
    const etc = old.fs.children.etc.children;
    etc.fstab.content = `# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n`;
    const bin = old.fs.children.usr.children.bin.children;
    for (const cmd of ['lsblk', 'mount', 'umount', 'df', 'mkfs.ext4']) delete bin[cmd];
    delete bin['mkfs.vfat'];
    delete old.fs.children.dev.children.sdb1;

    const restored = Shell.restore(old)!;
    expect(restored.disks.disks.map((d) => d.name)).toEqual(['sda', 'sdb', 'zram0']);
    expect(stripAnsi(restored.execute('lsblk').output)).toContain('sdb1');
    expect(stripAnsi(restored.execute('cat /etc/fstab').output)).toContain('btrfs');
    expect(restored.execute('ls /dev/sdb1').exitCode).toBe(0);
    expect(restored.execute('df -h').exitCode).toBe(0);
    expect(restored.execute('which mkfs.vfat').exitCode).toBe(0);
  });
});
