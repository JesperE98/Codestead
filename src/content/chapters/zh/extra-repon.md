# AUR、PPA 和 COPR

发行版的软件源里有成千上万个软件包——但并不是什么都有。某个小众程序可能根本不在里面，或者只有一个很旧的版本。这就是为什么会有**额外的软件源**，开发者和用户在那里分享他们自己打的包。每个家族都有自己的一套：Ubuntu 上的 **PPA**、Arch 上的 **AUR** 和 Fedora 上的 **COPR**。

在本章中，你将从 {{distro}} 的额外软件源中安装同一个虚构的程序 `moonphase`（它会在终端中显示月相）。如果你想比较它在其他家族中是怎么做的，可以在菜单中切换发行版。

## 方便——但风险自负

发行版自己软件源中的软件包会一起经过测试、签名，并由发行版的开发者审查。而额外的软件源则是任何人都可以创建的。在添加之前，请记住以下几点：

- **软件包是以 root 身份安装的。** 一个软件包可以对计算机做任何事情。你对打包者的信任，要和你对发行版的信任一样多。
- **它可能会产生冲突。** 来自额外软件源的软件包可能会替换系统自带的库，或者需要和你现有版本不同的其他版本。
- **它可能会停止更新。** 如果维护这个软件源的人失去了兴趣，你就再也得不到这个程序的安全更新了。

一条好的经验法则：先在发行版的软件源中找，然后找 Flatpak（下一章），最后才去找你信任的人提供的额外软件源。

## 三个家族，三种方案

| | PPA | AUR | COPR |
|---|---|---|---|
| 家族 | Ubuntu（以及 Linux Mint 等） | Arch（以及 Manjaro、EndeavourOS 等） | Fedora（以及 RHEL 家族） |
| 网站 | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| 你下载的是什么 | 现成的 `.deb` 软件包 | 构建脚本（`PKGBUILD`）——由你自己构建 | 现成的 `.rpm` 软件包 |
| 如何添加 | `add-apt-repository ppa:…` | `git clone …` 和 `makepkg -si` | `dnf copr enable …` |
| 是否经过发行版审查 | 否 | 否 | 否 |

:::debian
## {{distro}} 上的 PPA

**PPA**（*Personal Package Archive*，个人软件包档案）是 Launchpad 上的一个小型软件源，Launchpad 是 Canonical 为 Ubuntu 提供的服务。开发者上传源代码，Launchpad 为不同的 Ubuntu 版本构建 `.deb` 软件包。PPA 的写法是 `ppa:user/name`（用户/名称）。

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

### 在 Debian 上用 PPA？

PPA 是为 Ubuntu 构建的，而不是为 Debian。在 Debian 上它们也许能用，但这些软件包可能需要和 Debian 现有版本不同的库。Debian 和 Ubuntu 软件包的大杂烩被戏称为 *FrankenDebian*（“科学怪人 Debian”），这是把系统搞坏的常见方式之一。在 Debian 上，最好使用 *backports*、Flatpak 或开发者自己为 Debian 提供的软件源。

### 删除 PPA

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

程序会保留下来，但不会再得到更新。要把它彻底删掉，还要运行 `sudo apt remove moonphase`。
:::

:::arch
## {{distro}} 上的 AUR

**AUR**（*Arch User Repository*，Arch 用户软件仓库）和其他几种不一样：这里没有现成的软件包，只有**构建脚本**。这种脚本叫做 `PKGBUILD`，它是一个小小的 bash 脚本，说明了源代码在哪里以及程序该如何构建。你下载这个脚本，自己构建软件包，然后用 pacman 安装它。AUR 非常庞大——几乎所有为 Linux 开发的东西都能在里面找到——但任何人都可以上传脚本。

### 准备工作

要下载脚本并构建软件包，你需要 `git` 和 `base-devel`（编译器、`make`、`fakeroot` 等）：

```sh
sudo pacman -S --needed git base-devel
```

`--needed` 会跳过已经安装的软件包。

### 获取构建脚本

每个 AUR 软件包都是一个独立的 git 仓库：

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> 如果你把软件包名拼错了，git 会提示 *"You appear to have cloned an empty repository"*（你似乎克隆了一个空仓库），并且目录是空的。AUR 允许你克隆任何名字！

### 阅读 PKGBUILD——每一次都要读

```sh
less PKGBUILD
```

`PKGBUILD` 是一个会在你的计算机上运行的脚本。至少要检查：

- `source=` 是从程序真正的官网下载的，
- `build()` 和 `package()` 只做构建和复制文件的工作——而不会，比如说，下载并运行其他东西（`curl … | sh`），
- 这个软件包看起来有人在维护（日期、aur.archlinux.org 上的评论）。

### 构建并安装

```sh
makepkg -si
```

`makepkg` 读取 `PKGBUILD`，下载源代码，构建它，并打包成一个 `.pkg.tar.zst` 文件。`-s` 会安装缺失的依赖，`-i` 则在构建完成后用 pacman 安装这个软件包。**不要**用 sudo 运行 makepkg——它拒绝以 root 身份运行，并会在需要时自己调用 sudo。

```sh
ls
moonphase
```

### “外来”软件包

pacman 对 AUR 一无所知。不是来自软件源的软件包叫做 *foreign*（外来）软件包，可以这样列出：

```sh
pacman -Qm
```

这也意味着 `sudo pacman -Syu` **不会**更新 AUR 软件包。你得自己获取新的构建脚本（`git pull`）并重新构建——或者让 AUR 助手来做。

### AUR 助手 yay

AUR 助手（AUR helper）会替你完成上面所有这些工作：搜索、下载、显示 `PKGBUILD`、构建和安装。最常用的是 **yay**（另一个是 *paru*）。yay 本身只存在于 AUR 中，所以需要手动安装一次。`yay-bin` 软件包是预编译好的，安装起来最快：

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

之后，yay 的用法和 pacman 差不多——只是不需要 sudo：

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu`（或者直接输入 `yay`）会同时升级来自软件源的软件包和你的 AUR 软件包。方便并不意味着你可以不再阅读构建脚本！
:::

:::redhat
## {{distro}} 上的 COPR

**COPR**（*Cool Other Package Repo*）是 Fedora 的构建服务。任何拥有 Fedora 账户的人都可以在上面构建 `.rpm` 软件包，每个项目都会成为一个独立的软件源，名为 `user/project`（用户/项目）。

### 你现在有哪些软件源

```sh
dnf repolist
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

### RPM Fusion

Fedora 另一个常用的额外软件源是 **RPM Fusion**。它提供 Fedora 不能或不愿收录的东西，比如某些媒体编解码器和驱动程序。它是一个大型的社区项目——而不是像 COPR 那样由单个用户维护的软件源。
:::

## 更新和维护

| | 如何更新 | 如何删除软件源 |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu`——或者自己重新构建 | –（没有需要删除的软件源） |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

额外的软件源是一件强大的工具，但你每添加一个软件源，就多信任了一个发布者。让这份列表保持简短，把不再使用的清理掉。
