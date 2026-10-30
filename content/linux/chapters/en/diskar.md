# Disks and file systems

Where do the files you save actually end up? In Windows the answer is a
letter – `C:`, `D:`, `E:`. Linux has no drive letters at all, just **one**
directory tree that starts at `/`. In this chapter you look under the hood:
which disks the computer has, how they are divided up, how much space is
left – and how to plug in a USB stick and remove it again without losing
anything.

## Disk, partition and file system

Three words that are often mixed up, but mean different things:

- A **disk** is the storage device itself: an SSD, a hard drive, an SD card
  or a USB stick.
- A **partition** is a piece of the disk. A disk can be split into several
  partitions used for different things. Where each partition starts and ends
  is stored in the disk's **partition table** – on new computers of the type
  **GPT**, on older computers and most USB sticks the old **MBR** (which the
  tools call `dos`).
- A **file system** is the order *inside* a partition: how file names,
  directories, permissions and the contents themselves are stored. A new
  partition is empty and unusable until you create a file system on it –
  that is what **formatting** means.

Think of the disk as an empty warehouse, the partitions as the walls that
divide it into rooms and the file system as the shelves and labels in each
room. Without shelves you can't find anything.

```quiz
You have just created a new partition on a disk. Why can't you save files
on it yet?
- [ ] It must first be added to the partition table
- [x] It has no file system yet – it must be formatted first
- [ ] Partitions can't hold files, only disks can
- [ ] It must first get a drive letter
---
A new partition is empty and unusable until you create a file system on
it. That is what formatting means.
```

## Disks are files in `/dev`

In Linux almost everything is a file – disks included. Every disk and
partition has a **device file** in `/dev`:

```sh
ls -l /dev/sd*
```

| Device file | Is |
|---|---|
| `/dev/sda` | The first disk (SATA, USB or a virtual disk) |
| `/dev/sda1`, `/dev/sda2` | Partitions 1 and 2 on `sda` |
| `/dev/sdb` | The second disk – the USB stick in this computer |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | An NVMe SSD and its first partition |
| `/dev/vda` | A disk in a virtual machine |
| `/dev/mmcblk0p1` | The first partition on an SD card (e.g. in a Raspberry Pi) |

The letters are handed out in the order the disks are found. If the computer
has an NVMe SSD, a USB stick may well become `sda` – so **never guess**,
always check. The device files are owned by root and the group `disk`, so as
a normal user you cannot read the disks directly.

## Which disks are there? – `lsblk`

`lsblk` (*list block devices*) draws the disks as a tree, with the
partitions under each disk:

```sh
lsblk
```

| Column | Means |
|---|---|
| `NAME` | The name in `/dev` |
| `RM` | 1 = removable, e.g. a USB stick |
| `SIZE` | The size |
| `TYPE` | `disk` or `part` (partition) |
| `MOUNTPOINTS` | Where the file system appears in the directory tree, `[SWAP]` for swap |

On this computer `sda1` is the **EFI partition** (which the computer's
firmware boots from) on `/boot/efi`, `sda2` is the **root file system** `/`
and `sda3` is **swap**. Other distributions – and other installations – can
divide the disk differently, so always look instead of assuming.

With `-f`, `lsblk` also shows the file systems – type, label, UUID and how
much is free:

```sh
lsblk -f
```

Notice `sdb1`: a `vfat` file system labelled `USBMINNE` ("USB memory" in
Swedish) that is not mounted anywhere. That is the USB stick we are going to
plug in.

## Different file systems

There are many file systems, with different strengths:

| File system | Used for |
|---|---|
| `ext4` | The classic Linux standard. Stable and fast – Debian and Ubuntu use it |
| `btrfs` | Snapshots, compression and subvolumes. Default in Fedora and openSUSE |
| `xfs` | Good with big files and servers. Default in Red Hat Enterprise Linux |
| `vfat` (FAT32) | Works everywhere: Windows, macOS, cameras, car stereos. No Linux permissions and at most 4 GiB per file. The EFI partition must be FAT |
| `exfat` | Like FAT, but without the 4 GiB limit. Common on new USB sticks and SD cards |
| `ntfs` | The Windows file system. Linux can read and write it |
| `swap` | Not a file system for files – extra "memory" on disk |
| `tmpfs` | A file system that only exists in RAM and disappears on reboot |

## Everything is one tree – mounting

To **mount** a file system means attaching it to the directory tree at a
certain directory, a **mount point**. The root file system is mounted on
`/`, and everything else is hung in somewhere below it. That is why Linux
manages without drive letters: another disk is just another directory.

`findmnt` shows all mounts as a tree:

```sh
findmnt
```

And `mount` without arguments lists the same thing, one line per file
system:

```sh
mount
```

You also see things that are not disks: `proc` on `/proc` and `sysfs` on
`/sys` are the kernel's information dressed up as files, and `tmpfs` are
file systems in RAM. Common mount points:

| Directory | Used for |
|---|---|
| `/` | The root file system |
| `/boot`, `/boot/efi` | The kernel and the EFI partition |
| `/mnt` | Temporary mounts you make by hand |
| `/media/elev/…` or `/run/media/elev/…` | Where the desktop automatically mounts USB sticks |

## How much space is left? – `df`

`df` (*disk free*) shows how full each mounted file system is. With `-h` you
get human-readable sizes:

```sh
df -h
```

| Column | Means |
|---|---|
| `Filesystem` | Where the file system lives, e.g. a partition or `tmpfs` |
| `Size`, `Used`, `Avail` | Size, used and available |
| `Use%` | How full it is |
| `Mounted on` | The mount point |

`-T` adds the file system type, and if you give a path only the file system
it is on is shown:

```sh
df -hT
df -h ~
```

Notice that `Used` and `Avail` don't quite add up to `Size`? ext4 reserves
5 % for root, so the system keeps working even when a normal user has filled
the disk.

```try
df -hT
---
The `Type` column shows that `/` is `ext4` and `/boot/efi` is `vfat`.
```

## `df` or `du`?

Two commands with almost the same name, but they answer different questions:

| Question | Command |
|---|---|
| How full is the **disk**? | `df -h` – asks the file system |
| How much space do these **files** take? | `du -sh directory` – walks through the files and adds them up |

When a disk fills up you use both: first `df -h` to see *which* file system
is full, then `du` to find *what* is taking the space:

```sh
du -h -d 1 ~
```

## Mounting a USB stick

Now let's plug in the USB stick. First: which device is it? `lsblk -f`
showed a removable disk, `sdb`, with the partition `sdb1` labelled
`USBMINNE`. It is the **partition** you mount, not the whole disk.

Then you need a mount point – an ordinary, empty directory. Both creating it
and mounting require root:

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

`mount` recognises the FAT file system by itself; if you want to be explicit
you can add `-t vfat`. Now the stick's files appear in the directory:

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

From here on the stick works like any other directory. Copy a file to your
home directory:

```sh
cp /mnt/usb/att-gora.txt ~
```

> **Why is everything owned by root?** FAT has no Linux permissions. When a
> FAT stick is mounted, *all* files therefore get the same owner and
> permissions – the owner is whoever mounted it, which is root. To write to
> the stick you need either `sudo`, or to mount it so that you become the
> owner: `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb` (1000 is your
> user id – see `id`).

You can also mount by label instead of device name:
`sudo mount LABEL=USBMINNE /mnt/usb`. On a computer with a desktop, the file
manager does all of this automatically when you plug in the stick.

```quiz
After `sudo mount /dev/sdb1 /mnt/usb` every file on the FAT stick is owned
by root. Why?
- [ ] The files were created by root on another computer
- [x] FAT has no Linux permissions, so all files get the owner of whoever mounted it – root
- [ ] Everything in `/mnt` is always owned by root
- [ ] USB sticks can only be used by root
---
With `-o uid=1000,gid=1000` you can choose the owner yourself when you
mount.
```

## Unmount – before you pull out the stick!

Linux doesn't always write to the disk right away. Changes are collected in
RAM (*cache*) and written a bit later, because that is much faster. If you
pull out a stick that is still mounted, files you "saved" may be missing or
broken. That is why you **unmount** first – spelled `umount`, without an n:

```text
sudo umount /mnt/usb
```

`umount` writes everything that is waiting and then detaches the file
system. When the prompt comes back it is safe to pull out the stick.
(`sync` also writes everything that is waiting, but without unmounting.)

If something is using the file system, `umount` refuses:

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

Here it is your own shell standing in the directory. Leave with `cd ~` and
try again. After unmounting, `/mnt/usb` is an empty directory again – but
the files, and the changes you made, are still on the stick the next time
you mount it.

```quiz
Why should you unmount a USB stick before pulling it out?
- [ ] Otherwise the files on the stick are deleted
- [x] Changes may still be waiting in RAM – `umount` writes them before it detaches the file system
- [ ] Otherwise the stick gets a new device name next time
- [ ] The stick can't be mounted again until it has been unmounted on the same computer
---
Linux collects changes in RAM (*cache*) and writes them a bit later. A stick
that is pulled out while still mounted may lose files you "saved".
```

## `/etc/fstab` – what is mounted at boot

The root file system, `/boot` and swap are mounted automatically every time
the computer starts. What should be mounted is listed in the file
`/etc/fstab` (*file system table*):

```sh
cat /etc/fstab
```

Each line has six columns:

| Column | Example | Means |
|---|---|---|
| Device | `UUID=3f1c…` | Which file system |
| Mount point | `/` | Where in the tree (`none` for swap) |
| Type | `ext4` | The file system type |
| Options | `defaults`, `errors=remount-ro` | Mount options, comma-separated |
| dump | `0` | Old backup flag, almost always 0 |
| pass | `1` | The order `fsck` checks them at boot (1 = root, 2 = others, 0 = never) |

The option `errors=remount-ro` means the root file system is made read-only
if an error is detected – better that than destroying more. Comments like
`# / was on /dev/sda2 during installation` were written by the installer.

Why `UUID=…` and not just `/dev/sda2`? Device names can change – plug in a
new disk and the old one may get a new letter. A UUID is created together
with the file system and never changes. You find it with `lsblk -f`, `blkid`
or `findmnt`:

```sh
sudo blkid
findmnt -n -o UUID /
```

With `findmnt`, `-o` picks the columns to show and `-n` leaves out the
heading – handy when you only want the value itself.

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
`/boot/efi` is the EFI partition, and the EFI partition must be FAT.
```

If you want the stick to always be mountable on `/mnt/usb`, you can add a
line like this one:

```text
LABEL=USBMINNE  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` means it is not mounted at boot (the stick might not be plugged
in), and `user` that normal users may mount it – then `mount /mnt/usb` is
enough, without `sudo`.

> **Warning:** a mistake in `/etc/fstab` can stop the computer from booting
> properly. Always test changes with `sudo mount -a`, which mounts everything
> in the file that isn't mounted yet, *before* you reboot. For external disks
> that are not always connected, add the option `nofail`.

## Swap

**Swap** is space used when RAM runs out: parts of memory that are not used
right now are moved there, so that the programs fit. Swap is much slower than
RAM, so a computer that swaps a lot gets sluggish – but that is better than
programs crashing.

```sh
swapon --show
free -h
```

Here swap is a partition of its own, `sda3`. Many installations (for example
newer Ubuntu) use a *swap file* on the root file system instead.

## Partitioning and formatting – with the utmost care

`fdisk -l` shows the partition tables of all disks, with where each
partition starts and ends and what type it is. It requires root:

```sh
sudo fdisk -l
```

With `fdisk` (without `-l`), `parted` or the graphical `gparted` you can
change the partition table, and with `mkfs` you create a new file system –
you format:

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBMINNE /dev/sdb1    # FAT32 – works everywhere
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4 – Linux permissions, but Linux only
```

> **Warning!** `fdisk` and `mkfs` are among the most dangerous commands there
> are. One mistyped letter – `sda` instead of `sdb` – and the whole system
> disk is gone. Before formatting anything on a real computer: check with
> `lsblk -f` that the size, the `RM` column and the label match, make sure
> the partition is not mounted, and have a backup of everything important.

In the simulator you can try `mkfs.ext4` and `mkfs.vfat` on the USB stick –
but do the tasks first, because the files on the stick disappear. The
system's own partitions are protected because they are mounted, just like
on a real system.

## Summary

| Command | Does |
|---|---|
| `lsblk`, `lsblk -f` | Show disks, partitions and file systems |
| `blkid` | Show type, label and UUID |
| `df -h` | How full are the file systems? |
| `du -sh directory` | How much space do the files take? |
| `findmnt`, `mount` | What is mounted, and where? |
| `sudo mount /dev/sdb1 /mnt/usb` | Mount a file system |
| `sudo umount /mnt/usb` | Unmount – before you pull out the stick |
| `cat /etc/fstab` | What is mounted at boot? |
| `swapon --show` | Show swap |
| `sudo fdisk -l` | Show the partition tables |
