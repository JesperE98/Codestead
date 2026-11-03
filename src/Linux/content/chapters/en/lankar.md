# Links and file information

A file's name and its contents are two different things on Linux. In this
chapter you use that to make shortcuts with **links**, you learn to examine
files with `stat` and `file`, and you decide which permissions new files get
with `umask`.

## Names and inodes

The contents of a file – together with its owner, permissions and times – are
stored in an **inode**. A directory is just a list of names, and each name
points to an inode. `ls -i` shows the inode number in front of each name:

```sh
ls -i
```

## Symbolic links – `ln -s`

A **symbolic link** (*symlink*) is a small file that contains the path to
something else – a shortcut. The target comes first and the name of the link
last, just like with `cp`:

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

The `l` first in the line and the arrow `->` show that it is a link. Its
permissions are always `rwxrwxrwx` – they don't matter, what counts are the
permissions of the target.

Almost every command follows the link: `ls ~/log/`, `cat`, `cd` and so on.
`cd` remembers the way you came, and `pwd -P` shows where you really are:

```sh
cd ~/log
pwd
pwd -P
```

### Relative links

A relative path in a link counts from the directory **where the link is** –
not from where you are when you create it:

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

That works, because the link is in your home directory and
`{{documents}}/{{fruits}}` is there. A link `/tmp/f` with the same content would
look for `/tmp/{{documents}}/{{fruits}}` – and be broken.

`readlink` shows what is in a link, and `realpath` shows the full path with
every link followed:

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### Broken links

A link can point to something that doesn't exist:

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
The link exists, but not the file it points to. `ls -l` shows a broken link
in red, and `find ~ -type l` finds every link in your home directory.
```

`rm` removes the link itself, never what it points to.

```quiz
You have the link `~/log -> /var/log` and run `rm ~/log`. What happens?
- [ ] `/var/log` and everything in it is removed
- [x] Only the link is removed – `/var/log` is left alone
- [ ] `rm` refuses, because `~/log` is a directory
---
`rm` works on the link itself. To remove the target you would have to name
the target.
```

### Where you meet links

Links are everywhere in a Linux system. `python3` is often a link to a
specific version, like `python3.12`, and when you later make a service start
at boot with `systemctl enable`, systemd creates a link to its unit file.
Look at the services that start at boot:

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Hard links – `ln`

Without `-s`, `ln` makes a **hard link**: one more name for the same inode.

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{todo}}
```

Both names have the same inode number, and the number after the permissions –
the **link count** – is now 2. It is the same file: a change through one name
shows through the other. If you remove one of the names, the contents live on
as long as the file has at least one name left.

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` and `b.txt` were the same file. The line written through `b.txt` is
still there after `b.txt` was removed.
```

| | Symbolic link (`ln -s`) | Hard link (`ln`) |
|---|---|---|
| Is | A small file with a path | One more name for the same inode |
| To a directory | Yes | No |
| To another file system | Yes | No – inodes belong to one file system |
| If the original is removed | The link breaks | The file lives on |
| In `ls -l` | `l` and `->` | The link count goes up |

```quiz
Which kind of link can point to a directory?
- [x] Only a symbolic link
- [ ] Only a hard link
- [ ] Both
---
Hard links to directories are not allowed. For a shortcut to a directory you
use `ln -s`.
```

## Everything about a file – `stat`

`stat` shows everything the inode knows:

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

You get the size, the inode number, the number of links, the permissions both
as digits (`0644`) and as letters, the owner and the group, and when the file
was read, modified and changed. With `-c` you choose exactly what to show:
`%a` is the permissions as digits, `%U` the owner and `%n` the name.

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## What is in it? – `file`

Linux doesn't care about file name extensions: a file called `.jpg` can
contain anything. `file` looks at the contents instead:

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
The name ends in `.jpg`, but the contents are text – and that is what `file`
goes by.
```

## Permissions for new files – `umask`

New files get the permissions `rw-rw-rw-` (666) and new directories
`rwxrwxrwx` (777) – minus the bits in the **umask**. `umask` shows it:

```sh
umask
```

The usual umask `0022` removes write permission for the group and others,
which is why your files get `644` and your directories `755`.

| umask | New files | New directories | Means |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | The usual |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | The group may read, others nothing |
| `077` | `600` `rw-------` | `700` `rwx------` | Only you |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 minus 027: the group loses `w`, and others lose everything.
```

`umask` only affects files created afterwards, and only in the shell where you
ran it. To keep a umask, put the line in `~/.bashrc`.

```quiz
Your umask is `077`. Which permissions does a new directory get?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
Directories start from 777. 777 minus 077 leaves 700: everything for you,
nothing for anyone else.
```
