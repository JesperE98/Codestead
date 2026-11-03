# Summary: System administration

In this part you took care of the computer as an administrator: the services
that run in the background, the disks the files end up on and the users who
share the computer. Almost everything that **changes** something here
requires root – so `sudo` came up a lot.

## Services and logs with systemd

**systemd** is process number 1 and starts everything else. Everything it
keeps track of is a **unit**, described by a unit file – the ones that come
with the packages are in `/usr/lib/systemd/system`, your own in
`/etc/systemd/system`, which take precedence. `systemctl` controls the
services, and **`start` (now) and `enable` (at boot) are two different
things**. Everything the services print ends up in the **journal**, which you
read and filter with `journalctl`. When a service won't start: `systemctl
--failed`, `systemctl status`, then `journalctl -xeu` – and read the log word
by word. On Ubuntu the SSH service is called `ssh`; other families sometimes
name services differently.

## Disks and file systems

A **disk** is divided into **partitions**, and each partition needs a **file
system** before it can hold files. Disks are files in `/dev` (`/dev/sda`,
`/dev/sda1`, …). Linux has no drive letters: every file system is
**mounted** somewhere in the one directory tree that starts at `/`. `lsblk`
shows the disks, `df` how full the file systems are and `du` what the files
take. Always **unmount** a USB stick before you pull it out, because changes
may still be waiting in RAM. What is mounted at boot is listed in
`/etc/fstab`, preferably by **UUID**, which never changes. `fdisk` and `mkfs`
are among the most dangerous commands there are – check twice.

## Users and groups

Every user has a **UID** – root has 0, system users get low numbers and
people start at 1000. The users are listed in `/etc/passwd`, the groups in
`/etc/group` and the password hashes in `/etc/shadow`, which only root can
read. Every user has one **primary group** and any number of
**supplementary groups**. `useradd -m -s /bin/bash` creates a user, `passwd`
sets the password and `usermod -aG` adds to a group – **don't forget the
`-a`**. On Ubuntu sudo rights come from the group `sudo` (other families use
`wheel`). `su -` switches user with that user's password, `sudo -u` runs one
command as someone else with your own.

## Commands

| Command | Does |
|---|---|
| `systemctl status NAME` | How is the service doing? |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | Start, stop, restart, re-read the configuration |
| `sudo systemctl enable --now NAME` | Start at boot – and now |
| `systemctl is-active` / `is-enabled NAME` | One word, exit status 0 for "yes" |
| `systemctl --failed` | Services that have failed |
| `systemctl cat NAME` | Show the unit file |
| `sudo systemctl daemon-reload` | Load changed unit files again |
| `journalctl -u NAME` | The log of one service |
| `journalctl -p err -b` | Errors and worse since this boot |
| `journalctl -n 20`, `-f`, `--since today` | The latest lines, follow, since midnight |
| `lsblk -f` | Disks, partitions and file systems |
| `blkid`, `findmnt -n -o UUID /` | Type, label and UUID |
| `df -h`, `du -sh DIR` | How full is the disk, how much do the files take |
| `sudo mount /dev/sdb1 /mnt/usb` | Mount a file system |
| `sudo umount /mnt/usb` | Unmount |
| `cat /etc/fstab`, `sudo mount -a` | What is mounted at boot – and test changes |
| `swapon --show`, `free -h` | Swap and memory |
| `id`, `groups` | UID, GID and groups |
| `sudo useradd -m -s /bin/bash NAME` | Create a user |
| `sudo passwd NAME` | Set a password |
| `sudo groupadd GROUP` | Create a group |
| `sudo usermod -aG GROUP NAME` | Add to a group |
| `sudo usermod -L` / `-U NAME` | Lock / unlock an account |
| `sudo userdel -r NAME` | Delete a user and the home directory |
| `su - NAME`, `sudo -u NAME COMMAND` | Switch user, run as another user |
