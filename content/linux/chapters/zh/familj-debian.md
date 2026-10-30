# Debian 家族：apt 和 PPA

Debian、Ubuntu 以及基于它们构建的发行版（比如 Linux Mint）组成了 **Debian 家族**。它们都使用包管理器 **apt** 和 `.deb` 格式的软件包。本章总是运行在 Debian 家族的某个发行版上——现在是 **{{distro}}**。你可以在顶部的菜单中在 Ubuntu 和 Debian 之间切换。

## apt 简介

| 操作 | 命令 |
|---|---|
| 刷新软件包列表 | `apt update` |
| 升级所有软件 | `apt upgrade` |
| 安装 | `apt install X` |
| 删除 | `apt remove X` |
| 搜索 | `apt search X` |
| 软件包信息 | `apt show X` |
| 列出已安装的软件包 | `apt list --installed` |

会修改系统的命令需要 root 权限，所以要用 `sudo` 来运行。

```quiz
下面哪些命令会修改系统，因此需要 `sudo`？
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
搜索和显示信息只会读取软件包列表。安装和删除则会修改系统。
```

## update 和 upgrade 是两回事

几乎每个人一开始都会被这一点搞糊涂：

- `apt update` 下载可用软件包及其版本的**列表**。它不会安装任何东西。
- `apt upgrade` 为你已有的软件**安装**新版本。

所以一定要先运行 `update`。更新系统最常用的方法是：

```sh
sudo apt update && sudo apt upgrade
```

在运行 `apt update` 之前（例如在一台刚安装好的服务器上），软件包列表是空的，apt 根本找不到任何软件包。

```quiz
`sudo apt update` 会做什么？
- [x] 下载可用软件包及其版本的列表
- [ ] 为你已有的软件包安装新版本
- [ ] 把 apt 本身更新到最新版本
---
`apt update` 只刷新列表。真正安装新版本的是 `apt upgrade`。
```

## 安装和删除

```sh
sudo apt install htop
```

`apt remove` 会删除程序，但会保留它的配置文件。`apt purge` 则会把配置文件也一起删除。当 apt 询问 `Do you want to continue? [Y/n]` 时，大写的 `Y` 表示直接按 Enter 就等于回答 yes。使用 `-y` 选项，apt 会自动回答 yes。

搜索不需要 root 权限。试试看：

```try
apt search htop
```

### apt 还是 apt-get？

`apt` 是现代的、对用户友好的版本，带有进度条和彩色显示。`apt-get` 和 `apt-cache` 比较老，但它们的输出格式更稳定，所以在脚本中仍然会用到它们。

### 底层原理：dpkg 和 .deb

软件包是 `.deb` 文件，实际负责解包的是 `dpkg` 程序。apt 则负责处理周边的一切：下载、依赖和更新。

## 额外的软件源——方便，但风险自负

发行版的软件源里有成千上万个软件包——但并不是什么都有。某个小众程序可能根本不在里面，或者只有一个很旧的版本。这就是为什么会有**额外的软件源**，开发者和用户在那里分享他们自己打的包。

发行版自己软件源中的软件包会一起经过测试、签名，并由发行版的开发者审查。而额外的软件源则是任何人都可以创建的。在添加之前，请记住以下几点：

- **软件包是以 root 身份安装的。** 一个软件包可以对计算机做任何事情。你对打包者的信任，要和你对发行版的信任一样多。
- **它可能会产生冲突。** 来自额外软件源的软件包可能会替换系统自带的库，或者需要和你现有版本不同的其他版本。
- **它可能会停止更新。** 如果维护这个软件源的人失去了兴趣，你就再也得不到这个程序的安全更新了。

一条好的经验法则：先在发行版的软件源中找，然后找 Flatpak（见关于通用软件包的那一章），最后才去找你信任的人提供的额外软件源。

## PPA

**PPA**（*Personal Package Archive*，个人软件包档案）是 Launchpad 上的一个小型软件源，Launchpad 是 Canonical 为 Ubuntu 提供的服务。开发者上传源代码，Launchpad 为不同的 Ubuntu 版本构建 `.deb` 软件包。PPA 的写法是 `ppa:user/name`（用户/名称）。PPA 不经过发行版的审查。

在本章接下来的部分中，你将从一个 PPA 安装一个虚构的程序 `moonphase`（它会在终端中显示月相）。

### add-apt-repository 工具

PPA 用 `add-apt-repository` 来添加，它位于 `software-properties-common` 软件包中。Ubuntu 上预装了它，但 Debian 上没有：

```sh
sudo apt update
sudo apt install software-properties-common
```

### 添加 PPA

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

你会看到将要添加的内容以及这个 PPA 的说明。按 Enter 继续（加上 `-y` 可以跳过这个提问）。接下来会发生两件事：

1. 在 `/etc/apt/sources.list.d/` 中创建一个文件。它写明了软件源的位置，并包含用于给软件包签名的密钥。
2. `add-apt-repository` 会替你运行 `apt update`——否则 apt 不会知道有新的软件包。如果你手动添加软件源（通过创建文件），之后就得自己运行 `sudo apt update`。

```quiz
你通过在 `/etc/apt/sources.list.d/` 中创建一个文件，手动添加了一个软件源。在 apt 能从它安装软件包之前，你需要做什么？
- [ ] 什么都不用做——下次安装时 apt 会自己读取这个文件
- [x] 运行 `sudo apt update`
- [ ] 重启计算机
---
`add-apt-repository` 会替你运行 `apt update`。如果文件是你自己创建的，这一步就得你自己来做。
```

看看这个文件：

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

注意 `Suites: noble`——这些软件包是为 Ubuntu 24.04 构建的。

### 安装并运行

现在，这个软件包的安装方式和其他软件包完全一样：

```sh
sudo apt install moonphase
moonphase
```

### 这个软件包来自哪里？

`apt policy` 会显示一个软件包存在于哪些软件源中，以及哪一个胜出：

```sh
apt policy moonphase
```

`***` 标记的是已安装的版本。数字 `500` 是软件源的优先级，`100` 表示“已经安装的版本”。如果同一个软件包存在于多个软件源中，apt 会选择版本最高的那个——所以 PPA 可以用它自己的版本替换掉发行版自带的某个软件包。

```quiz
同一个软件包既在发行版的软件源中，也在你添加的一个 PPA 中。apt 会选择哪个版本？
- [ ] 总是来自发行版软件源的那个
- [ ] 来自最后添加的那个软件源的版本
- [x] 版本最高的那个
---
这就是为什么 PPA 可以替换掉发行版自带的某个软件包。
```

### 在 Debian 上用 PPA？

PPA 是为 Ubuntu 构建的，而不是为 Debian。在 Debian 上它们也许能用，但这些软件包可能需要和 Debian 现有版本不同的库。Debian 和 Ubuntu 软件包的大杂烩被戏称为 *FrankenDebian*（“科学怪人 Debian”），这是把系统搞坏的常见方式之一。在 Debian 上，最好使用 *backports*、Flatpak 或开发者自己为 Debian 提供的软件源。

### 更新和删除 PPA

来自 PPA 的软件包会和其他所有软件一起，用 `sudo apt update && sudo apt upgrade` 来更新。要删除这个 PPA：

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

程序会保留下来，但不会再得到更新。要把它彻底删掉，还要运行 `sudo apt remove moonphase`。

你每添加一个软件源，就多信任了一个发布者。让这份列表保持简短，把不再使用的清理掉。
