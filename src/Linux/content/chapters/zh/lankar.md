# 链接和文件信息

在 Linux 中，文件的名字和它的内容是两回事。在本章中，你将利用这一点用**链接**创建快捷方式，学习用 `stat` 和 `file` 查看文件，并用 `umask` 决定新文件获得哪些权限。

## 名字和 inode

文件的内容——连同它的所有者、权限和时间——都保存在一个 **inode** 中。目录只是一张名字列表，每个名字都指向一个 inode。`ls -i` 会在每个名字前面显示 inode 编号：

```sh
ls -i
```

## 符号链接——`ln -s`

**符号链接**（*symlink*）是一个小文件，里面保存着指向别处的路径——也就是一个快捷方式。目标写在前面，链接的名字写在最后，和 `cp` 一样：

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

行首的 `l` 和箭头 `->` 表明这是一个链接。它的权限总是 `rwxrwxrwx`——这些权限并不重要，起作用的是目标的权限。

几乎所有命令都会跟随链接：`ls ~/log/`、`cat`、`cd` 等等。`cd` 会记住你是从哪条路走过来的，而 `pwd -P` 显示你实际所在的位置：

```sh
cd ~/log
pwd
pwd -P
```

### 相对链接

链接中的相对路径是从**链接所在的目录**算起的——而不是从你创建它时所在的位置算起：

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

这样可以正常工作，因为链接位于你的主目录中，而 `{{documents}}/{{fruits}}` 就在那里。如果链接 `/tmp/f` 的内容相同，它就会去找 `/tmp/{{documents}}/{{fruits}}`——于是成为一个失效的链接。

`readlink` 显示链接里保存的内容，`realpath` 显示跟随所有链接之后的完整路径：

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### 失效的链接

链接可以指向一个不存在的东西：

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
链接本身存在，但它指向的文件不存在。`ls -l` 会用红色显示失效的链接，而 `find ~ -type l` 能找出你主目录中的所有链接。
```

`rm` 删除的是链接本身，永远不会删除它指向的东西。

```quiz
你有一个链接 `~/log -> /var/log`，然后运行 `rm ~/log`。会发生什么？
- [ ] `/var/log` 及其中的所有内容都被删除
- [x] 只有链接被删除——`/var/log` 保持不变
- [ ] `rm` 拒绝执行，因为 `~/log` 是一个目录
---
`rm` 作用于链接本身。要删除目标，你必须写出目标本身。
```

### 在哪里会遇到链接

Linux 系统中到处都是链接。`python3` 常常是指向某个具体版本（例如 `python3.12`）的链接；以后当你用 `systemctl enable` 让某个服务开机启动时，systemd 会创建一个指向它的单元文件的链接。看看开机时启动的服务：

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## 硬链接——`ln`

不加 `-s` 时，`ln` 创建的是**硬链接**：同一个 inode 的又一个名字。

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{todo}}
```

两个名字的 inode 编号相同，权限后面的数字——**链接计数**——现在是 2。它们是同一个文件：通过一个名字做的修改，通过另一个名字也能看到。如果删除其中一个名字，只要文件还剩至少一个名字，内容就依然存在。

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` 和 `b.txt` 是同一个文件。通过 `b.txt` 写入的那一行，在 `b.txt` 被删除之后仍然存在。
```

| | 符号链接（`ln -s`） | 硬链接（`ln`） |
|---|---|---|
| 本质 | 一个保存路径的小文件 | 同一个 inode 的又一个名字 |
| 指向目录 | 可以 | 不可以 |
| 指向另一个文件系统 | 可以 | 不可以——inode 只属于一个文件系统 |
| 原文件被删除后 | 链接失效 | 文件依然存在 |
| 在 `ls -l` 中 | `l` 和 `->` | 链接计数增加 |

```quiz
哪种链接可以指向目录？
- [x] 只有符号链接
- [ ] 只有硬链接
- [ ] 两种都可以
---
不允许为目录创建硬链接。要为目录创建快捷方式，请使用 `ln -s`。
```

## 文件的一切——`stat`

`stat` 显示 inode 所知道的一切：

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

你可以看到大小、inode 编号、链接数、用数字（`0644`）和字母两种形式表示的权限、所有者和所属组，以及文件被读取、修改内容和更改属性的时间。用 `-c` 可以精确地选择要显示的内容：`%a` 是数字形式的权限，`%U` 是所有者，`%n` 是名字。

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## 里面是什么？——`file`

Linux 并不在乎文件名的扩展名：一个名为 `.jpg` 的文件里可以装任何东西。`file` 则会查看文件的内容：

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
名字以 `.jpg` 结尾，但内容是文本——而 `file` 依据的正是内容。
```

## 新文件的权限——`umask`

新文件获得的权限是 `rw-rw-rw-`（666），新目录是 `rwxrwxrwx`（777）——再减去 **umask** 中的位。`umask` 会显示它：

```sh
umask
```

常见的 umask `0022` 去掉了所属组和其他人的写权限，所以你的文件得到 `644`，目录得到 `755`。

| umask | 新文件 | 新目录 | 含义 |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | 常见设置 |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | 所属组可以读，其他人什么都不行 |
| `077` | `600` `rw-------` | `700` `rwx------` | 只有你自己 |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 减去 027：所属组失去 `w`，其他人失去全部权限。
```

`umask` 只影响之后创建的文件，而且只在你运行它的那个 shell 中有效。要让 umask 一直生效，就把这一行写进 `~/.bashrc`。

```quiz
你的 umask 是 `077`。新目录会获得什么权限？
- [ ] `755`
- [ ] `600`
- [x] `700`
---
目录从 777 开始。777 减去 077 剩下 700：你拥有全部权限，其他人什么都没有。
```
