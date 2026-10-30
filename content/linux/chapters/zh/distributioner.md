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

你可以随时在顶部的菜单中切换发行版，然后把任务再做一遍——你马上就会看到它们的区别。

## 哪些地方到处都一样？

- **Linux 内核**——只是版本不同。
- **bash shell** 以及来自 GNU 的基本工具（`ls`、`cp`、`grep` ……）。
- **目录布局**——`/etc`、`/home`、`/usr/bin` 等等。
- **systemd**，几乎所有主流发行版都用它来启动系统和管理服务。

## 哪些地方不一样？

| | Debian 家族 | Arch 家族 | Red Hat 家族 |
|---|---|---|---|
| 包管理器 | `apt` | `pacman` | `dnf` |
| 软件包格式 | `.deb` | `.pkg.tar.zst` | `.rpm` |
| 底层工具 | `dpkg` | （pacman） | `rpm` |
| sudo 组 | `sudo` | `wheel` | `wheel` |
| 发布方式 | 稳定版本 | 滚动更新 | 每 6 个月发布一个新版本（Fedora） |

### 发布模式

- **固定版本的稳定发布**——Debian 大约每两年发布一个新版本，Ubuntu LTS（*Long Term Support*，长期支持）也是每两年发布一次，并提供五年的支持。程序会得到安全修复，但很少被替换成更新的版本。非常适合服务器。
- **滚动更新**（rolling release）——Arch 根本没有版本号。你持续不断地更新，始终获得最新的软件。它对用户的要求要稍高一些。
- **快速迭代**——Fedora 大约每六个月发布一个新版本，在某种程度上是 Red Hat Enterprise Linux（RHEL）的试验田；而 RHEL 则提供十年的支持，主要供企业使用。

## 我运行的是哪个发行版？

文件 `/etc/os-release` 存在于所有现代发行版上，它会告诉你发行版的名称和版本：

```sh
cat /etc/os-release
```

内核版本可以用 `uname -r` 查看：

```sh
uname -r
```

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
