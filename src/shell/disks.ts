// Diskarna i den simulerade datorn: en systemdisk med partitioner och en
// USB-sticka som eleven kan montera.
//
// Att montera ett filsystem betyder här att katalogen i VFS:en (t.ex. /mnt/usb)
// byts ut mot filsystemets rotkatalog. Katalogen som låg där sparas och läggs
// tillbaka vid umount, och filsystemets innehåll sparas då i partitionen – precis
// som på riktigt försvinner filerna ur trädet men finns kvar på stickan.

import type { Distro } from './distros';
import { makeDir, makeFile, nodeSize, normalizePath, type FsNode, type User, type VFS } from './vfs';

export const SECTOR = 512;
const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
/** RAM-minnet i KiB (samma som `free` visar). */
const RAM_KB = 8_073_420;

/** Ett filsystem (eller swap) på en partition eller en hel enhet. */
export interface FsInfo {
  fstype?: string;
  fsver?: string;
  label?: string;
  uuid?: string;
  /** Byte som används av sådant som inte finns i VFS:en (systemets egna filer). */
  base?: number;
  /** Filsystemets innehåll när det inte är monterat (t.ex. USB-stickan). */
  root?: FsNode;
  /** Används som swap just nu – kan inte monteras eller formateras. */
  swapActive?: boolean;
}

export interface Partition extends FsInfo {
  name: string;
  /** Första sektorn. */
  start: number;
  sectors: number;
  /** Partitionstyp som fdisk visar, t.ex. "EFI System". */
  ptype: string;
  /** MBR-typ (bara för dos-partitionstabeller), t.ex. "c". */
  ptypeId?: string;
  partuuid: string;
}

export interface Disk extends FsInfo {
  name: string;
  sectors: number;
  model: string;
  removable: boolean;
  /** Anslutning: sata, usb eller tom (zram). */
  tran: string;
  major: number;
  minor: number;
  pttype?: 'gpt' | 'dos';
  diskId?: string;
  partitions: Partition[];
}

export interface Mount {
  /** Det som `mount` visar som källa: /dev/sdb1, tmpfs, proc ... */
  source: string;
  target: string;
  fstype: string;
  options: string;
  /** Enheten (t.ex. "sdb1") när källan är en disk eller partition. */
  dev?: string;
  /** btrfs-subvolym, visas som /dev/sda3[/root] av findmnt. */
  subvol?: string;
  /** Storlek i byte för filsystem som inte ligger på en disk (tmpfs). */
  size?: number;
  /** Byte som används utöver filerna i VFS:en. */
  base?: number;
  /** Katalogen som låg på monteringspunkten innan (läggs tillbaka vid umount). */
  under?: FsNode;
  /** Systemets egna monteringar – går inte att avmontera. */
  system?: boolean;
}

export interface DiskState {
  disks: Disk[];
  mounts: Mount[];
}

/** Ett block-enhetsuppslag: en hel disk eller en partition. */
export interface Block {
  path: string;
  name: string;
  disk: Disk;
  part?: Partition;
  /** Partitionen, eller disken om det är en hel disk. */
  dev: Disk | Partition;
}

export const USB_DISK = 'sdb';
export const USB_PART = 'sdb1';
export const USB_LABEL = 'USBMINNE';
export const USB_UUID = '7E21-9A4F';

/** UUID:n per familj, så att /etc/fstab, blkid och lsblk stämmer överens. */
const IDS = {
  debian: {
    efi: '4A1C-93E2',
    root: '3f1c9a2e-7b4d-4e8a-9c61-2d5e8f0a4b17',
    swap: '9a6d3e51-0c2f-4b8e-a7d4-5e1f2c3b6a90',
    disk: '6B0E2F4A-1C3D-4E5F-8A9B-0C1D2E3F4A5B',
  },
  arch: {
    efi: 'C2D7-5B18',
    root: 'b84e2c61-95f3-4d0a-8e7b-1a2c3d4e5f60',
    swap: '2e9f7a14-6c3b-4d5e-9f80-a1b2c3d4e5f6',
    disk: '9F3A1B2C-4D5E-4F60-8172-93A4B5C6D7E8',
  },
  redhat: {
    efi: '1D6B-8F2A',
    boot: 'e5a0c3b7-2d14-4f69-8b3e-7c1d2e3f4a5b',
    root: 'c7f1e2d3-a4b5-4c6d-8e9f-0a1b2c3d4e5f',
    swap: '0b3c4d5e-6f70-4182-93a4-b5c6d7e8f901',
    disk: '2A4C6E80-1B3D-4F5A-9C7E-8D0F1A2B3C4D',
  },
} as const;

/** Antal sektorer per GiB. */
const G = GiB / SECTOR;
const DISK_SECTORS = 64 * G;
/** Sista sektorn som används (GPT behöver plats för en reservkopia i slutet). */
const LAST = DISK_SECTORS - 2049;
const USB_SECTORS = 31_277_232;

/** En fil på USB-stickan. `size` ger "binärfiler" (bilder, PDF) en låtsasstorlek. */
function usbFile(content: string, mtime: number, size?: number): FsNode {
  const n = makeFile(content, 'root', 0o755);
  if (size !== undefined) n.size = size;
  n.mtime = mtime;
  return n;
}

function usbFiles(): FsNode {
  const t = Date.UTC(2026, 6, 14, 10, 32);
  const root = makeDir('root', 0o755);
  root.mtime = t;
  root.children = {
    'semester.jpg': usbFile('\u00ff\u00d8\u00ff\u00e0\u0000\u0010JFIF\u0000 (simulerad bild)\n', t, 3_481_216),
    'rapport.pdf': usbFile('%PDF-1.7\n%simulerad PDF: Rapport om Linux i skolan\n', t + 3_600_000, 842_113),
    'att-gora.txt': usbFile(
      'Att göra:\n- säkerhetskopiera semesterbilderna\n- skriva ut rapporten\n- lära mig mount och umount\n',
      t + 7_200_000,
    ),
  };
  return root;
}

function part(name: string, start: number, sectors: number, ptype: string, partuuid: string, fs: FsInfo): Partition {
  return { name, start, sectors, ptype, partuuid, ...fs };
}

export function initialDisks(distro: Distro): DiskState {
  const ids = IDS[distro.family];
  const pu = (n: number) => `${ids.disk.slice(0, 8).toLowerCase()}-0000-4000-8000-00000000000${n}`;
  let partitions: Partition[];
  const efi: FsInfo = { fstype: 'vfat', fsver: 'FAT32', uuid: ids.efi };
  const swap: FsInfo = { fstype: 'swap', fsver: '1', uuid: ids.swap, swapActive: true };
  const rootBase = { ubuntu: 9.6, debian: 3.8, arch: 3.1, fedora: 6.2 }[distro.id] ?? 4;
  switch (distro.family) {
    case 'debian':
      // Debian-installerarens upplägg: EFI, rot och swap sist.
      partitions = [
        part('sda1', 2048, 1 * G, 'EFI System', pu(1), { ...efi, base: 6.2 * MiB }),
        part('sda2', 2048 + G, LAST - 2 * G - (2048 + G) + 1, 'Linux filesystem', pu(2), {
          fstype: 'ext4',
          fsver: '1.0',
          uuid: ids.root,
          base: rootBase * GiB,
        }),
        part('sda3', LAST - 2 * G + 1, 2 * G, 'Linux swap', pu(3), swap),
      ];
      break;
    case 'arch':
      // Som i Arch-wikin: EFI-partitionen monteras på /boot, sedan swap och rot.
      partitions = [
        part('sda1', 2048, 1 * G, 'EFI System', pu(1), { ...efi, base: 158 * MiB }),
        part('sda2', 2048 + G, 2 * G, 'Linux swap', pu(2), swap),
        part('sda3', 2048 + 3 * G, LAST - (2048 + 3 * G) + 1, 'Linux filesystem', pu(3), {
          fstype: 'ext4',
          fsver: '1.0',
          uuid: ids.root,
          base: rootBase * GiB,
        }),
      ];
      break;
    case 'redhat': {
      // Fedora: EFI, /boot med ext4 och resten btrfs (subvolymerna root och home).
      // Swap ligger i RAM-minnet (zram), inte på disken.
      const r = IDS.redhat;
      partitions = [
        part('sda1', 2048, 1_228_800, 'EFI System', pu(1), { ...efi, base: 19.6 * MiB }),
        part('sda2', 1_230_848, G, 'Linux extended boot', pu(2), {
          fstype: 'ext4',
          fsver: '1.0',
          uuid: r.boot,
          base: 286 * MiB,
        }),
        part('sda3', 1_230_848 + G, LAST - (1_230_848 + G) + 1, 'Linux filesystem', pu(3), {
          fstype: 'btrfs',
          fsver: '1',
          label: 'fedora',
          uuid: r.root,
          base: rootBase * GiB,
        }),
      ];
      break;
    }
  }
  const disks: Disk[] = [
    {
      name: 'sda',
      sectors: DISK_SECTORS,
      model: 'QEMU HARDDISK',
      removable: false,
      tran: 'sata',
      major: 8,
      minor: 0,
      pttype: 'gpt',
      diskId: ids.disk,
      partitions,
    },
    {
      name: USB_DISK,
      sectors: USB_SECTORS,
      model: 'USB Flash Disk',
      removable: true,
      tran: 'usb',
      major: 8,
      minor: 16,
      pttype: 'dos',
      diskId: '0x5d3a1c7e',
      partitions: [
        {
          name: USB_PART,
          start: 2048,
          sectors: USB_SECTORS - 2048,
          ptype: 'W95 FAT32 (LBA)',
          ptypeId: 'c',
          partuuid: '5d3a1c7e-01',
          fstype: 'vfat',
          fsver: 'FAT32',
          label: USB_LABEL,
          uuid: USB_UUID,
          base: 0,
          root: usbFiles(),
        },
      ],
    },
  ];
  if (distro.family === 'redhat') {
    disks.push({
      name: 'zram0',
      sectors: 2 * G,
      model: '',
      removable: false,
      tran: '',
      major: 251,
      minor: 0,
      partitions: [],
      fstype: 'swap',
      fsver: '1',
      label: 'zram0',
      uuid: IDS.redhat.swap,
      swapActive: true,
    });
  }
  return { disks, mounts: systemMounts(distro) };
}

function systemMounts(distro: Distro): Mount[] {
  const kb = (k: number) => k * 1024;
  const run = Math.floor(RAM_KB / 10);
  const half = Math.floor(RAM_KB / 2);
  const tmpfs = (target: string, options: string, size: number, base = 0): Mount => ({
    source: 'tmpfs',
    target,
    fstype: 'tmpfs',
    options,
    size: kb(size),
    base,
    system: true,
  });
  const devName = { debian: 'udev', arch: 'dev', redhat: 'devtmpfs' }[distro.family];
  const devSize = distro.family === 'redhat' ? 4096 : 3_995_264;
  const m: Mount[] = [
    { source: 'sysfs', target: '/sys', fstype: 'sysfs', options: 'rw,nosuid,nodev,noexec,relatime', system: true },
    { source: 'proc', target: '/proc', fstype: 'proc', options: 'rw,nosuid,nodev,noexec,relatime', system: true },
    {
      source: devName,
      target: '/dev',
      fstype: 'devtmpfs',
      options: `rw,nosuid,relatime,size=${devSize}k,nr_inodes=998816,mode=755,inode64`,
      size: kb(devSize),
      system: true,
    },
    tmpfs('/run', `rw,nosuid,nodev,noexec,relatime,size=${run}k,mode=755,inode64`, run, 1.6 * MiB),
  ];
  switch (distro.family) {
    case 'debian':
      m.push({
        source: '/dev/sda2',
        target: '/',
        fstype: 'ext4',
        options: 'rw,relatime,errors=remount-ro',
        dev: 'sda2',
        system: true,
      });
      break;
    case 'arch':
      m.push({ source: '/dev/sda3', target: '/', fstype: 'ext4', options: 'rw,relatime', dev: 'sda3', system: true });
      break;
    case 'redhat':
      m.push({
        source: '/dev/sda3',
        target: '/',
        fstype: 'btrfs',
        options: 'rw,relatime,seclabel,compress=zstd:1,ssd,discard=async,space_cache=v2,subvolid=257,subvol=/root',
        dev: 'sda3',
        subvol: '/root',
        system: true,
      });
      break;
  }
  m.push(tmpfs('/dev/shm', 'rw,nosuid,nodev,inode64', half));
  if (distro.family === 'debian') m.push(tmpfs('/run/lock', 'rw,nosuid,nodev,noexec,relatime,size=5120k,inode64', 5120, 8192));
  // Debian 13, Arch och Fedora har /tmp i RAM-minnet (tmpfs). Ubuntu har det på disken.
  if (distro.id !== 'ubuntu') m.push(tmpfs('/tmp', `rw,nosuid,nodev,size=${half}k,nr_inodes=1048576,inode64`, half));
  const vfatOpts = 'rw,relatime,fmask=0077,dmask=0077,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro';
  switch (distro.family) {
    case 'debian':
      m.push({ source: '/dev/sda1', target: '/boot/efi', fstype: 'vfat', options: vfatOpts, dev: 'sda1', system: true });
      break;
    case 'arch':
      m.push({ source: '/dev/sda1', target: '/boot', fstype: 'vfat', options: vfatOpts.replace(/0077/g, '0022'), dev: 'sda1', system: true });
      break;
    case 'redhat':
      m.push(
        {
          source: '/dev/sda3',
          target: '/home',
          fstype: 'btrfs',
          options: 'rw,relatime,seclabel,compress=zstd:1,ssd,discard=async,space_cache=v2,subvolid=256,subvol=/home',
          dev: 'sda3',
          subvol: '/home',
          system: true,
        },
        { source: '/dev/sda2', target: '/boot', fstype: 'ext4', options: 'rw,relatime,seclabel', dev: 'sda2', system: true },
        { source: '/dev/sda1', target: '/boot/efi', fstype: 'vfat', options: vfatOpts.replace('relatime', 'relatime,seclabel'), dev: 'sda1', system: true },
      );
      break;
  }
  m.push(tmpfs('/run/user/1000', `rw,nosuid,nodev,relatime,size=${run}k,nr_inodes=201808,mode=700,uid=1000,gid=1000,inode64`, run, 124 * 1024));
  return m;
}

/** /etc/fstab som installationsprogrammet i respektive distribution skulle ha skrivit. */
export function fstabFor(distro: Distro): string {
  switch (distro.family) {
    case 'debian': {
      const ids = IDS.debian;
      return `# /etc/fstab: static file system information.
#
# Use 'blkid' to print the universally unique identifier for a
# device; this may be used with UUID= as a more robust way to name devices
# that works even if disks are added and removed. See fstab(5).
#
# <file system> <mount point>   <type>  <options>       <dump>  <pass>
# / was on /dev/sda2 during installation
UUID=${ids.root} /               ext4    errors=remount-ro 0       1
# /boot/efi was on /dev/sda1 during installation
UUID=${ids.efi}  /boot/efi       vfat    umask=0077      0       1
# swap was on /dev/sda3 during installation
UUID=${ids.swap} none            swap    sw              0       0
`;
    }
    case 'arch': {
      const ids = IDS.arch;
      return `# Static information about the filesystems.
# See fstab(5) for details.

# <file system> <dir> <type> <options> <dump> <pass>
# /dev/sda3
UUID=${ids.root}\t/         \text4      \trw,relatime\t0 1

# /dev/sda1
UUID=${ids.efi}      \t/boot     \tvfat      \trw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro\t0 2

# /dev/sda2
UUID=${ids.swap}\tnone      \tswap      \tdefaults  \t0 0

`;
    }
    case 'redhat': {
      const ids = IDS.redhat;
      return `
#
# /etc/fstab
# Created by anaconda on Mon Oct 20 10:02:11 2026
#
# Accessible filesystems, by reference, are maintained under '/dev/disk/'.
# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info.
#
# After editing this file, run 'systemctl daemon-reload' to update systemd
# units generated from this file.
#
UUID=${ids.root} /                       btrfs   subvol=root,compress=zstd:1 0 0
UUID=${ids.boot} /boot                   ext4    defaults        1 2
UUID=${ids.efi}          /boot/efi               vfat    umask=0077,shortname=winnt 0 2
UUID=${ids.root} /home                   btrfs   subvol=home,compress=zstd:1 0 0
`;
    }
  }
}

/** UUID för filsystemet som är monterat på /. */
export function rootUuid(distro: Distro): string {
  return IDS[distro.family].root;
}

/** Den gamla /etc/fstab från versioner före diskkapitlet. */
const OLD_FSTAB = `# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n`;

/**
 * Skapar diskmodellen för ett nytt (eller gammalt sparat) skal: enhetsfiler i /dev,
 * monteringspunkterna, /proc/mounts och en /etc/fstab som stämmer med diskarna.
 */
export function setupDisks(distro: Distro, vfs: VFS): DiskState {
  const state = initialDisks(distro);
  const root = vfs.root;
  const dir = (path: string): FsNode | null => {
    let node = root;
    for (const seg of path.split('/').filter(Boolean)) {
      if (node.type !== 'dir' || !node.children) return null;
      node.children[seg] ??= makeDir();
      node = node.children[seg];
    }
    return node.type === 'dir' ? node : null;
  };
  const dev = dir('/dev');
  if (dev?.children) {
    for (const b of allBlocks(state)) dev.children[b.name] ??= makeFile('', 'root', 0o660, 'disk');
  }
  for (const m of state.mounts) {
    if (m.dev && m.target !== '/') {
      const node = dir(m.target);
      if (node && m.target.startsWith('/boot')) node.mode = m.fstype === 'vfat' && distro.family !== 'arch' ? 0o700 : 0o755;
    }
  }
  const etc = dir('/etc');
  const fstab = etc?.children?.fstab;
  if (etc?.children && (!fstab || fstab.content === OLD_FSTAB)) etc.children.fstab = makeFile(fstabFor(distro));
  writeProcMounts(vfs, state);
  return state;
}

// ---------- Uppslag ----------

export function allBlocks(state: DiskState): Block[] {
  const out: Block[] = [];
  for (const disk of state.disks) {
    out.push({ path: `/dev/${disk.name}`, name: disk.name, disk, dev: disk });
    for (const p of disk.partitions) out.push({ path: `/dev/${p.name}`, name: p.name, disk, part: p, dev: p });
  }
  return out;
}

/** Hittar en enhet från /dev/sdb1, LABEL=USBMINNE eller UUID=... */
export function findBlock(state: DiskState, spec: string): Block | null {
  const blocks = allBlocks(state);
  const eq = /^(LABEL|UUID|PARTUUID)=(.*)$/.exec(spec);
  if (eq) {
    const value = eq[2].replace(/^["']|["']$/g, '');
    const key = eq[1] === 'LABEL' ? 'label' : eq[1] === 'UUID' ? 'uuid' : 'partuuid';
    return (
      blocks.find((b) => {
        const v = (b.dev as unknown as Record<string, unknown>)[key];
        return typeof v === 'string' && (key === 'label' ? v === value : v.toLowerCase() === value.toLowerCase());
      }) ?? null
    );
  }
  const path = normalizePath(spec.startsWith('/') ? spec : `/dev/${spec}`);
  return blocks.find((b) => b.path === path) ?? null;
}

export function mountsOf(state: DiskState, devName: string): Mount[] {
  return state.mounts.filter((m) => m.dev === devName);
}

/** Monteringen som sökvägen ligger i (längsta matchande monteringspunkt). */
export function mountFor(state: DiskState, path: string): Mount | undefined {
  const p = normalizePath(path);
  let best: Mount | undefined;
  for (const m of state.mounts) {
    if (m.target === p || m.target === '/' || p.startsWith(m.target + '/')) {
      if (!best || m.target.length >= best.target.length) best = m;
    }
  }
  return best;
}

export function blockSize(dev: Disk | Partition): number {
  return dev.sectors * SECTOR;
}

/** Storlek som lsblk visar den: 64G, 14.9G, 600M. */
export function lsblkSize(bytes: number): string {
  const units = ['B', 'K', 'M', 'G', 'T'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const s = v.toFixed(1).replace(/\.0$/, '');
  return s + units[u];
}

// ---------- Utrymme ----------

const BLOCK = 4096;
const PSEUDO = new Set(['proc', 'sysfs']);

function treeUsage(node: FsNode): number {
  if (node.type === 'file') return Math.ceil(nodeSize(node) / BLOCK) * BLOCK;
  let sum = BLOCK;
  for (const child of Object.values(node.children ?? {})) sum += treeUsage(child);
  return sum;
}

/** Hur mycket filerna under en monteringspunkt tar, utan andra monteringar under den. */
function mountTreeUsage(vfs: VFS, state: DiskState, m: Mount, root: User): number {
  if (PSEUDO.has(m.fstype)) return 0;
  const start = vfs.tryLookup(m.target, root);
  if (!start) return 0;
  const others = new Set(state.mounts.filter((o) => o !== m).map((o) => o.target));
  const walk = (node: FsNode, path: string): number => {
    if (node.type === 'file') return Math.ceil(nodeSize(node) / BLOCK) * BLOCK;
    let sum = BLOCK;
    for (const [name, child] of Object.entries(node.children ?? {})) {
      const p = path === '/' ? `/${name}` : `${path}/${name}`;
      if (others.has(p)) continue;
      sum += walk(child, p);
    }
    return sum;
  };
  return walk(start, m.target);
}

export interface Usage {
  /** Filsystemets storlek, använt och ledigt i byte. */
  size: number;
  used: number;
  avail: number;
}

function fsOverhead(fstype: string | undefined): number {
  return fstype === 'ext4' || fstype === 'ext2' ? 0.983 : fstype === 'vfat' ? 0.999 : 1;
}

/** Hur mycket ett filsystem på en partition använder, monterat eller inte. */
export function partitionUsage(vfs: VFS, state: DiskState, dev: Disk | Partition, devName: string, root: User): Usage {
  const size = Math.floor(blockSize(dev) * fsOverhead(dev.fstype));
  let used = dev.base ?? 0;
  const mounts = mountsOf(state, devName);
  if (mounts.length) for (const m of mounts) used += mountTreeUsage(vfs, state, m, root);
  else if (dev.root) used += treeUsage(dev.root);
  used = Math.min(used, size);
  const reserved = dev.fstype === 'ext4' || dev.fstype === 'ext2' ? Math.floor(size * 0.05) : 0;
  return { size, used, avail: Math.max(0, size - used - reserved) };
}

/** Utrymmet för en montering (det df visar). */
export function mountUsage(vfs: VFS, state: DiskState, m: Mount, root: User): Usage {
  if (m.dev) {
    const b = findBlock(state, m.dev);
    if (b) return partitionUsage(vfs, state, b.dev, b.name, root);
  }
  const size = m.size ?? 0;
  const used = Math.min(size, (m.base ?? 0) + (m.fstype === 'devtmpfs' ? 0 : mountTreeUsage(vfs, state, m, root)));
  return { size, used, avail: Math.max(0, size - used) };
}

// ---------- /proc/mounts ----------

export function writeProcMounts(vfs: VFS, state: DiskState): void {
  const proc = vfs.root.children?.proc;
  if (!proc || proc.type !== 'dir' || !proc.children) return;
  const lines = state.mounts.map((m) => `${m.source} ${m.target} ${m.fstype} ${m.options} 0 0\n`).join('');
  proc.children.mounts = makeFile(lines, 'root', 0o444);
}

/** Innehållet på en partition: monteringens katalog i VFS:en, eller det sparade innehållet. */
export function partitionRoot(vfs: VFS, state: DiskState, devName: string, root: User): FsNode | null {
  const m = mountsOf(state, devName)[0];
  if (m) return vfs.tryLookup(m.target, root);
  return findBlock(state, devName)?.dev.root ?? null;
}

/** Ett nytt slumpat UUID (ext4) eller volym-id (FAT). */
export function newUuid(fstype: string): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  if (fstype === 'vfat') return `${hex(4)}-${hex(4)}`.toUpperCase();
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

export const RAM_BYTES = RAM_KB * 1024;
