# 发行版和家族

你现在已经掌握了基础知识，而这些在每个发行版上都是一样的。那么，究竟是什么让它们各不相同呢？

:::debian
你当前运行的是 **Debian 家族**的 **{{distro}}**。
:::

:::arch
你当前运行的是 **Arch 家族**的 **{{distro}}**。
:::

:::redhat
你当前运行的是 **Red Hat 家族**的 **{{distro}}**。
:::

本章是一个概览。你可以随时在顶部的菜单中切换发行版，然后把任务再做一遍——你马上就会看到它们的区别。本章之后，每个家族各有一章：**Debian 家族**（apt）、**Arch 家族**（pacman）和 **Red Hat 家族**（dnf）。每一章总是运行在该家族的某个发行版上，所以三章你都可以学。

## 哪些地方到处都一样？

- **Linux 内核**——只是版本不同。
- **bash shell** 以及来自 GNU 的基本工具（`ls`、`cp`、`grep` ……）。
- **目录布局**——`/etc`、`/home`、`/usr/bin` 等等。
- **systemd**，几乎所有主流发行版都用它来启动系统和管理服务。

```predict
$ echo $SHELL
/bin/bash
---
在模拟器中的每个发行版上，shell 都是 bash——无论你选择了哪一个。
```

## 哪些地方不一样？

| | Debian 家族 | Arch 家族 | Red Hat 家族 |
|---|---|---|---|
| 包管理器 | `apt` | `pacman` | `dnf` |
| 软件包格式 | `.deb` | `.pkg.tar.zst` | `.rpm` |
| 底层工具 | `dpkg` | （pacman） | `rpm` |
| sudo 组 | `sudo` | `wheel` | `wheel` |
| 发布方式 | 稳定版本 | 滚动更新 | 每 6 个月发布一个新版本（Fedora） |

```quiz
在哪些家族中，可以使用 sudo 的组叫做 `wheel`？
- [ ] Debian 家族
- [x] Arch 家族
- [x] Red Hat 家族
---
Debian 家族把这个组叫做 `sudo`；Arch 和 Red Hat 则叫它 `wheel`。
```

### 发布模式

- **固定版本的稳定发布**——Debian 大约每两年发布一个新版本，Ubuntu LTS（*Long Term Support*，长期支持）也是每两年发布一次，并提供五年的支持。程序会得到安全修复，但很少被替换成更新的版本。非常适合服务器。
- **滚动更新**（rolling release）——Arch 根本没有版本号。你持续不断地更新，始终获得最新的软件。它对用户的要求要稍高一些。
- **快速迭代**——Fedora 大约每六个月发布一个新版本，在某种程度上是 Red Hat Enterprise Linux（RHEL）的试验田；而 RHEL 则提供十年的支持，主要供企业使用。

```quiz
哪个发行版根本没有版本号，而是持续不断地更新（*滚动更新*，rolling）？
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

## 我运行的是哪个发行版？

文件 `/etc/os-release` 存在于所有现代发行版上，它会告诉你发行版的名称和版本：

```sh
cat /etc/os-release
```

内核版本可以用 `uname -r` 查看：

```sh
uname -r
```

```try
cat /etc/os-release
---
`NAME` 和 `PRETTY_NAME` 这两行会告诉你这是哪个发行版。
```

## 软件包、软件源和依赖

在 Windows 和 macOS 上，你经常从网站上下载程序。而在 Linux 上，你几乎所有东西都是用**包管理器**（package manager）来安装的。这是各个发行版家族之间最大的区别。

- **软件包**（package）是打包成一个文件的程序（或库），同时附带有关其版本和所需依赖的信息。
- **软件源**（repository，也叫仓库）是发行版发布其所有软件包的服务器。这些软件包经过测试和签名，所以你可以确信它们没有被篡改过。
- **依赖**（dependency）是另一个必需的软件包。包管理器会自动安装依赖。

包管理器还会记录已经安装了哪些软件，并且只需一条命令就能更新计算机上的*所有*软件。会修改系统的命令需要 root 权限，所以要用 `sudo` 来运行。

```quiz
某个软件包需要另一个你没有的软件包。当你用包管理器安装它时，会发生什么？
- [ ] 安装中止，你必须自己去找另一个软件包
- [x] 包管理器会自动安装这个依赖
- [ ] 软件包会被安装，但在你下载另一个软件包之前无法使用
```

### 同一个程序，不同的名字

软件包在各处通常都使用相同的名字——但并非总是如此。举几个例子：

| 程序 | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH 客户端 | `openssh-client` | `openssh` | `openssh-clients` |

如果你不确定软件包的名字，请始终先用包管理器搜索一下。

## 包管理器的配置

:::debian
在 Debian 家族中，`/etc/apt/sources.list.d/` 中的文件指定了 apt 从哪些*软件源*（repository）获取软件包：

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
在 Arch 家族中，pacman 通过 `/etc/pacman.conf` 进行配置，镜像服务器列表则位于 `/etc/pacman.d/mirrorlist`：

```sh
cat /etc/pacman.conf
```
:::

:::redhat
在 Red Hat 家族中，dnf 的设置位于 `/etc/dnf/dnf.conf`，而*软件源*（repository）则由 `/etc/yum.repos.d/` 中的文件描述：

```sh
ls /etc/yum.repos.d
```
:::

## 我该选择哪一个？

没有标准答案，不过这里有一条经验法则：

- **刚接触 Linux？** Ubuntu、Linux Mint 或 Fedora。
- **用作服务器？** Debian、Ubuntu LTS，或者 RHEL 的克隆版，比如 Rocky Linux。
- **想了解一切是如何组合在一起的？** Arch——以及它那出色的 wiki。
