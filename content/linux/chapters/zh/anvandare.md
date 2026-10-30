# 用户和组

Linux 从一开始就是为多人同时共用一台计算机而设计的。每个文件都有一个所有者，每个程序都以某个特定用户的身份运行——正因为如此，创建、修改和删除账户是管理员最重要的工作之一。在本章中，你将创建用户 `kim`，为这个账户设置密码并赋予它 sudo 权限，同时了解这些信息都存储在哪里。

## 用户和 UID

你已经知道如何查看自己是谁了：

```sh
whoami
id
```

`id` 显示出你不仅有一个名字，还有一个编号：`uid=1000`。这就是 **UID**（*user ID*，用户 ID），内核记录的是这个编号，而不是名字。名字的存在只是为了让我们人类不必去记数字。几个重要的编号：

| UID | 是谁 |
|---|---|
| `0` | **root**，管理员。拥有 UID 0 的人可以做任何事。 |
| `1`–`999` | 用于服务和程序的**系统用户** |
| `1000` 及以上 | **普通用户**——也就是人。第一个普通用户得到 1000。 |

## 用户列表——`/etc/passwd`

所有用户都列在文本文件 `/etc/passwd` 中，每个用户占一行：

```sh
cat /etc/passwd
```

每一行有七个字段，用冒号分隔。看看你自己的那一行：

```sh
grep elev /etc/passwd
```

```text
elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash
 1   2  3    4      5        6          7
```

| 字段 | 含义 |
|---|---|
| 1 | 用户名 |
| 2 | `x`——密码存放在 `/etc/shadow` 中（见下文） |
| 3 | UID |
| 4 | GID——用户**主组**的编号 |
| 5 | 注释，通常是全名 |
| 6 | 主目录 |
| 7 | 用户登录时启动的 shell |

`getent` 命令也能做同样的查询。区别在于，它还能找到不在这个文件中的用户，例如在学校或公司里，账户存放在一台中央服务器上：

```sh
getent passwd elev
```

### 系统用户

`/etc/passwd` 中的大部分行都不是人。像 Web 服务器和日志系统这样的服务，会以各自专用的用户身份运行，并且权限尽可能少——这样即使它们被攻破，攻击者也接触不到你的文件。它们的 shell 是 `nologin`，所以没有人能以它们的身份登录。在 Ubuntu 上，Web 服务器的用户叫 `www-data`（系统用户的名字因发行版而异）：

```sh
grep www-data /etc/passwd
```

用文本处理那一章中学过的 `awk`，可以列出 UID 为 1000 及以上的所有用户——也就是普通用户：

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

`nobody`（UID 65534）也会出现在结果中。它是一个特殊用户，“什么也不拥有”，用于需要让程序拥有尽可能少权限的场合。

```predict
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
---
第 3 个字段是 UID，只有 root 的 UID 是 0。赋予 root 强大权力的是这个数字，而不是名字。
```

## 组和 GID

**组**（group）是一种让多个用户拥有相同权限的方式，例如访问一个共享的项目目录。组列在 `/etc/group` 中：

```sh
cat /etc/group
```

```text
sudo:x:27:elev
 1   2  3   4
```

各字段依次是组名、`x`、组的编号（**GID**）以及用逗号分隔的成员列表。

每个用户都有**一个主组**（`/etc/passwd` 中的 GID 字段），此外还可以是任意多个**附加组**（supplementary group）的成员。你新建的文件会归属于你的主组。在大多数发行版中，每个用户都会得到一个同名的私有主组——`elev` 就在 `elev` 组中。

```sh
groups
id
```

```quiz
你（`elev`）属于 `elev` 和 `sudo` 两个组，你的主组是 `elev`。你新建的文件会归属于哪个组？
- [x] `elev`
- [ ] `sudo`
- [ ] 两个都是
- [ ] `root`
---
新文件会归属于你的**主**组——也就是 `/etc/passwd` 中的 GID 字段。像 `sudo` 这样的附加组会给你额外的权限，但不会出现在你的文件上。
```

## 密码——`/etc/shadow`

注意 `/etc/passwd` 第 2 个字段中的 `x`。在过去，（加密后的）密码就直接放在那里。问题是 `/etc/passwd` **必须**对所有人可读——`ls -l` 就是从那里获取所有者名字的。所以任何人都可以复制这些加密后的密码，然后慢慢地尝试破解。因此，它们被移到了只有 root 能读取的 `/etc/shadow` 中：

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

第 2 个字段并不是密码本身，而是一个**哈希值**（hash）——一种无法逆推的“指纹”。登录时，系统会计算你输入内容的哈希值，然后与存储的哈希值进行比较。`$y$` 表示使用的是 *yescrypt* 算法。如果这里是 `!` 或 `*`，则表示没有密码，或者账户已被**锁定**。其余字段记录了密码最后一次修改的时间以及何时过期。`chage` 会以易读的文字显示它们：

```sh
chage -l elev
```

```try
chage -l elev
---
`Password expires: never`——elev 的密码永远不需要修改。
```

## 创建用户——`useradd`

创建用户需要 root 权限。最常用的命令在每个发行版中都有：

```sh
sudo useradd -m -s /bin/bash kim
```

| 选项 | 含义 |
|---|---|
| `-m` | 创建主目录 `/home/kim` |
| `-s /bin/bash` | 用户的 shell |
| `-c "Kim Svensson"` | 注释（全名） |
| `-G group1,group2` | 同时加入附加组 |

`useradd` 会从 1000 开始往上找下一个空闲的 UID——`kim` 得到的是 1001。这些范围设置在 `/etc/login.defs` 中。同时还会创建一个 `kim` 组，并把 `/etc/skel`（*skeleton*，骨架）中的文件复制到新的主目录。在那里放些东西，每个新用户都会得到它：

```sh
ls -a /etc/skel
```

在 Ubuntu 上，`useradd` 相当“吝啬”：不加 `-m` 就**不会**创建主目录，不加 `-s` 的话 shell 会是 `/bin/sh`。其他发行版有其他的默认设置，所以养成输入 `-m` 和 `-s` 的习惯吧——这样同一条命令在哪里都能用。

所以 Ubuntu 还提供了一个更友好的脚本 `adduser`，它属于 Debian 家族。它会创建主目录、选择 bash，并询问密码和姓名：

```sh
sudo adduser lisa
```

回答这些问题——大多数问题直接按 Enter 就行。`adduser` 还能把已有用户加入某个组：`sudo adduser lisa sudo`。

`useradd`、`passwd` 以及本章中的其他命令总是预装好的。在 Ubuntu 上，它们来自 `passwd` 软件包；其他家族给这个软件包起了别的名字。

## 设置密码——`passwd`

新账户没有密码（`/etc/shadow` 中是 `!`），所以没有人能登录它。用 `passwd` 设置一个密码：

```sh
sudo passwd kim
```

你需要输入两次密码。**你输入的内容不会显示出来**——没有星号，什么都没有。这是有意为之的：从你身后偷看的人甚至不应该知道密码有多长。输入密码，然后按 Enter。

不带用户名的 `passwd` 会修改你自己的密码。只有 root 才能修改其他用户的密码——试试不加 sudo：

```sh
passwd root
```

## 组——`groupadd`、`usermod -aG` 和 `gpasswd`

创建一个组并添加一个成员：

```sh
sudo groupadd utvecklare
sudo usermod -aG utvecklare kim
groups kim
```

`-aG` 的意思是 *append to Groups*（追加到组）。**别忘了 `-a`！** 如果只用 `-G`，附加组列表会被设置成你输入的内容，一个不多一个不少——用户会被移出其他所有组，比如 sudo 组。这是把自己锁在门外的常见方式。

```quiz
`kim` 属于附加组 `sudo` 和 `utvecklare`。管理员运行了 `sudo usermod -G backup kim`。之后 kim 属于哪些附加组？
- [ ] `sudo`、`utvecklare` 和 `backup`
- [x] 只有 `backup`
- [ ] `sudo` 和 `utvecklare`——不加 `-a` 命令会失败
- [ ] 一个都没有
---
不加 `-a` 时，列表会被设置成你输入的内容，一个不多一个不少。如果用 `sudo usermod -aG backup kim`，kim 就会保留其他组。
```

`gpasswd` 也能做同样的事，而且还能移除成员：

```sh
sudo gpasswd -a kim utvecklare
sudo gpasswd -d kim utvecklare
```

在真实的计算机上，新的组成员身份要等用户下次登录时才会生效。模拟器更友好一些——在这里会立即生效。

组常用于共享目录。用 `chgrp` 和 `chmod` 让组成为目录的所有者，并给它写权限：

```sh
sudo mkdir /srv/projekt
sudo chgrp utvecklare /srv/projekt
sudo chmod 775 /srv/projekt
ls -ld /srv/projekt
```

## 授予 sudo 权限——`sudo` 组

谁可以使用 `sudo`，由 `/etc/sudoers` 决定：

```sh
sudo cat /etc/sudoers
```

`%sudo ALL=(ALL:ALL) ALL` 这一行表示 **sudo** 组中的每个人都可以以 root 身份运行任何命令。所以，给某人 sudo 权限，只需要把他加入正确的组——在 Ubuntu 上就是 `sudo` 组：

```sh
sudo usermod -aG sudo kim
```

这个组在不同的家族中名字不同：在 Arch 和 Fedora 上，它叫 `wheel`——这是一个古老的 Unix 名字，指“说了算的人”（*big wheel*，大人物）。

永远不要用普通编辑器直接编辑 `/etc/sudoers`——一个拼写错误就可能导致再也没有人能使用 sudo。请使用 `visudo`，它会在保存前检查文件。通常，你只需要用组就够了。

## 切换用户——`su` 和 `sudo -u`

变成另一个用户有两种方式：

| 命令 | 输入谁的密码？ | 会发生什么 |
|---|---|---|
| `su - kim` | **kim 的** | 你以 kim 的身份登录，直到输入 `exit` |
| `sudo -u kim command` | **你自己的**（你需要有 sudo 权限） | 以 kim 的身份运行一条命令 |
| `sudo -iu kim` | 你自己的 | 以 kim 的身份打开一个登录 shell |

```sh
sudo -u kim whoami
```

用 `su` 时，你是真正地切换了用户。短横线（`-`）表示以登录方式切换：你会进入 kim 的主目录，并使用 kim 的设置。提示符会显示你是谁，`exit` 会带你回来：

```sh
su - kim
```

不带用户名的 `su` 表示切换到 root。在 Ubuntu 上 root 没有密码，所以 `su -` 在那里行不通——请改用 `sudo -i`。

```quiz
你想以 `kim` 的身份运行一条命令，但你不知道 kim 的密码。你有 sudo 权限。哪种方法可行？
- [ ] `su - kim`
- [x] `sudo -u kim command`
- [ ] `su kim command`
- [ ] 都不行——你需要 kim 的密码
---
`su` 要求输入你要变成的那个用户的密码。`sudo` 要求输入**你自己的**密码，并在 `/etc/sudoers` 中检查你是否有权这样做。
```

## 锁定和删除账户

一个暂时不应被使用的账户可以被**锁定**。`usermod -L` 会在 `/etc/shadow` 中的哈希值前面加一个 `!`，这样任何密码都不再匹配。`-U` 则解除锁定：

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` 显示账户状态：`P`（有密码）、`L`（已锁定）或 `NP`（无密码）。用 `chage -E` 可以让账户在某个日期过期——对暑期工和临时代课老师来说很方便。

在删除某人之前，最好先看看谁已登录，以及某人最后一次登录是什么时候：

```sh
who
last
```

然后用 `userdel` 删除用户。加上 `-r` 会连同主目录一起删除——不加 `-r` 的话，文件会被留下：

```sh
sudo useradd -m vikarie
sudo userdel -r vikarie
```

Ubuntu 还有 `deluser`，它是 `adduser` 的对应命令：`sudo deluser --remove-home vikarie`。`sudo deluser kim sudo` 会把 kim 从 sudo 组中移除。

`userdel` 拒绝删除已登录的用户——试试 `sudo userdel elev`。

## 小结

| 命令 | 作用 |
|---|---|
| `id`, `groups` | 显示 UID、GID 和所属的组 |
| `useradd -m -s /bin/bash name` | 创建用户 |
| `passwd name` | 设置密码 |
| `usermod -aG group name` | 加入组 |
| `groupadd group` | 创建组 |
| `usermod -L` / `-U` | 锁定 / 解锁 |
| `userdel -r name` | 删除用户及其主目录 |
| `su - name`, `sudo -u name` | 切换用户 |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | 这些信息存储的位置 |
