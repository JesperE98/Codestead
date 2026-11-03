# Red Hat 家族：dnf 和 COPR

Fedora、Red Hat Enterprise Linux（RHEL）以及 Rocky Linux 等 RHEL 克隆版组成了 **Red Hat 家族**。它们使用包管理器 **dnf** 和 `.rpm` 格式的软件包。本章总是运行在 Red Hat 家族的某个发行版上——现在是 **{{distro}}**。

## dnf 简介

| 操作 | 命令 |
|---|---|
| 刷新软件包列表 | `dnf check-update` |
| 升级所有软件 | `dnf upgrade` |
| 安装 | `dnf install X` |
| 删除 | `dnf remove X` |
| 搜索 | `dnf search X` |
| 软件包信息 | `dnf info X` |
| 列出已安装的软件包 | `dnf list --installed` |

会修改系统的命令需要 root 权限，所以要用 `sudo` 来运行。

## 自动获取元数据

dnf 会在需要时自行获取新的软件包信息，所以不需要像 Debian 家族中 `apt update` 那样的单独步骤。如果你想查看有哪些可用的更新，请运行：

```sh
dnf check-update
```

`dnf check-update` 不需要 root 权限。如果有可用更新，退出码就是 `100`——这在脚本中非常方便。模拟器中有一些更新正在等待安装。下面的命令会打印什么？

```predict
$ dnf check-update > /dev/null; echo $?
100
---
`> /dev/null` 隐藏了更新列表，而 `$?` 是上一条命令的退出码：`100` 表示有可用的更新。
```

## 安装和删除

```sh
sudo dnf install htop
```

注意这个问题：`Is this ok [y/N]`。大写的 `N` 表示默认选项是 **No**（否）——如果你直接按 Enter，安装就会被取消。请输入 `y` 再按 Enter，或者使用 `-y`。

```quiz
dnf 询问 `Is this ok [y/N]`，你直接按了 Enter。会发生什么？
- [ ] 软件包被安装
- [x] 安装被取消
- [ ] dnf 再问一次
---
大写字母就是默认选项。在 Debian 家族中，apt 问的是 `[Y/n]`，所以在那里按 Enter 表示 yes。
```

`dnf remove package` 会再把软件包删除。

## 升级系统

```sh
sudo dnf upgrade
```

## 底层原理：rpm

软件包是 `.rpm` 文件，底层工具叫做 `rpm`。dnf 取代了较老的 `yum`，而 Fedora 41 带来了新版本 **dnf5**，速度明显更快。在 RHEL、Rocky 和 AlmaLinux 上，这个命令同样叫做 `dnf`。

## 额外的软件源——方便，但风险自负

发行版的软件源里有成千上万个软件包——但并不是什么都有。某个小众程序可能根本不在里面，或者只有一个很旧的版本。这就是为什么会有**额外的软件源**，开发者和用户在那里分享他们自己打的包。

发行版自己软件源中的软件包会一起经过测试、签名，并由发行版的开发者审查。而额外的软件源则是任何人都可以创建的。在添加之前，请记住以下几点：

- **软件包是以 root 身份安装的。** 一个软件包可以对计算机做任何事情。你对打包者的信任，要和你对发行版的信任一样多。
- **它可能会产生冲突。** 来自额外软件源的软件包可能会替换系统自带的库，或者需要和你现有版本不同的其他版本。
- **它可能会停止更新。** 如果维护这个软件源的人失去了兴趣，你就再也得不到这个程序的安全更新了。

一条好的经验法则：先在发行版的软件源中找，然后找 Flatpak（见关于通用软件包的那一章），最后才去找你信任的人提供的额外软件源。

## COPR

**COPR**（*Cool Other Package Repo*）是 Fedora 的构建服务。任何拥有 Fedora 账户的人都可以在上面构建 `.rpm` 软件包，每个项目都会成为一个独立的软件源，名为 `user/project`（用户/项目）。COPR 软件源不经过发行版的审查。

在本章接下来的部分中，你将从 COPR 安装一个虚构的程序 `moonphase`（它会在终端中显示月相）。

### 你现在有哪些软件源

```sh
dnf repolist
```

```try
dnf repolist
---
这些是 Fedora 自己的软件源。
```

### 启用 COPR 软件源

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf 会提醒你，这个软件源不属于 Fedora，质量可能参差不齐。这个提问的默认选项是 **No**，所以要回答 `y`。随后会在 `/etc/yum.repos.d/` 中创建一个新文件：

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

```quiz
任何拥有 Fedora 账户的人都可以在 COPR 中构建软件包。由谁来审查它们？
- [ ] Fedora 的开发者，在软件包发布之前
- [ ] Red Hat
- [x] 没有人——你必须信任维护这个软件源的人
```

### 安装并运行

dnf 会自己获取新软件源的信息，所以可以直接安装这个软件包：

```sh
sudo dnf install moonphase
moonphase
```

### 这个软件包来自哪里？

```sh
dnf info moonphase
```

`From repository` 这一行表明这个软件包来自 COPR。来自 COPR 的软件包和平常一样，用 `sudo dnf upgrade` 来更新。

### 禁用或删除

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` 会保留文件，但关闭这个软件源；`remove` 则会把它彻底删除。程序会保留下来，但不会再得到更新。

```quiz
`dnf copr disable` 和 `dnf copr remove` 有什么区别？
- [x] `disable` 关闭软件源但保留文件，`remove` 则把它删除
- [ ] `disable` 还会卸载软件包，`remove` 则不会
- [ ] 没有区别
```

### RPM Fusion

Fedora 另一个常用的额外软件源是 **RPM Fusion**。它提供 Fedora 不能或不愿收录的东西，比如某些媒体编解码器和驱动程序。它是一个大型的社区项目——而不是像 COPR 那样由单个用户维护的软件源。

你每添加一个软件源，就多信任了一个发布者。让这份列表保持简短，把不再使用的清理掉。
