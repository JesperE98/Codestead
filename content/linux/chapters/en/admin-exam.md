# Exam: System administration

Show what you have learned about services, disks and users. The questions
cover the whole part, and you need 80 % right to pass.

```quiz
`myserver` should start automatically every time the computer boots, but
it must **not** be started right now. Which command does exactly that?
- [ ] `sudo systemctl start myserver`
- [x] `sudo systemctl enable myserver`
- [ ] `sudo systemctl enable --now myserver`
- [ ] `sudo systemctl restart myserver`
---
`enable` applies at boot, `start` applies now, and `--now` does both.
```

The service `reportd` on this computer has failed to start. What does this
command print?

```predict
$ systemctl is-active reportd
failed
---
`is-active` prints just one word – here the same state that `systemctl --failed`
lists. The exit status is 0 only when the answer is `active`.
```

```quiz
You want to watch the log of `myserver` while you test it, with new lines
appearing as they arrive. Which command do you use?
- [ ] `journalctl -n 20`
- [x] `journalctl -u myserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status myserver --all`
---
`-u` picks one unit and `-f` keeps showing new lines until you press Ctrl+C.
```

```try
systemctl cat myserver
---
`ExecStart=` is the command that starts the service, and `WantedBy=` is
what `enable` uses.
```

```quiz
You run `systemctl stop myserver` without `sudo` and get
*Interactive authentication required*. Why?
- [ ] myserver is not running
- [x] Everything that changes a service requires root
- [ ] You must run `daemon-reload` first
- [ ] `stop` only works for enabled services
```

```quiz
Why does `/etc/fstab` usually say `UUID=…` instead of `/dev/sda2`?
- [ ] UUIDs are shorter to type
- [x] Device names can change when disks are added, but a UUID never changes
- [ ] `mount` doesn't understand device names
- [ ] The UUID shows how full the file system is
---
The UUID is created together with the file system. You find it with
`lsblk -f`, `blkid` or `findmnt`.
```

```quiz
`df -h` shows that `/` is 98 % full. Which command helps you find **which
directories** take up the space?
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` asks the file system how full it is; `du` walks through the files and
adds them up.
```

Your home directory is not on a file system of its own on this computer.
What does this print?

```predict
$ df -h ~ | awk 'NR > 1 {print $6}'
/
---
Given a path, `df` shows only the file system it is on. The sixth column is
`Mounted on` – the root file system.
```

```quiz
You have added a line to `/etc/fstab`. What should you do **before** you
reboot?
- [ ] Nothing – the file is only read at boot
- [x] Test it with `sudo mount -a`
- [ ] Run `sudo systemctl daemon-reload`
- [ ] Format the partition with `mkfs`
---
A mistake in `/etc/fstab` can stop the computer from booting properly.
`mount -a` mounts everything in the file that isn't mounted yet, so you see
the errors now.
```

```quiz
You are about to format a partition with `mkfs` on a real computer. What
should you check first? (Choose all that apply.)
- [x] With `lsblk -f`, that the size, the `RM` column and the label match
- [x] That the partition is not mounted
- [x] That you have a backup of everything important
- [ ] That the partition is listed in `/etc/fstab`
```

```quiz
Why are the password hashes in `/etc/shadow` and not in `/etc/passwd`?
- [ ] `/etc/passwd` is too small
- [x] `/etc/passwd` must be readable by everyone, but `/etc/shadow` only by root
- [ ] The hashes are reversible, so they must be hidden
- [ ] `/etc/passwd` is only read at boot
---
Anyone could otherwise copy the hashes and try to crack them at their
leisure. `ls -l` needs `/etc/passwd` to show the owners' names.
```

The fields in `/etc/group` are the group name, `x`, the GID and the members.
Who is in the group `sudo`?

```predict
$ grep ^sudo /etc/group | cut -d: -f4
elev
```

```quiz
What happens with `sudo userdel kim` – without `-r`?
- [x] The user is deleted, but the home directory `/home/kim` is left behind
- [ ] Nothing – `userdel` always needs `-r`
- [ ] The user and the home directory are deleted
- [ ] The account is only locked
```

```quiz
A user has UID 33 and the shell `/usr/sbin/nologin`. What is it most likely?
- [ ] root
- [ ] A regular user – a person
- [x] A system user that a service runs as
- [ ] A deleted user
---
UIDs 1–999 are for system users, and `nologin` means nobody can log in as
them.
```

```try
getent group sudo
---
`getent` looks up the group the same way the system does.
```
