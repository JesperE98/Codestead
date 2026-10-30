# Arch 家族：pacman 和 AUR

Arch Linux 以及基于它构建的发行版（比如 Manjaro 和 EndeavourOS）组成了 **Arch 家族**。它们使用包管理器 **pacman** 和 `.pkg.tar.zst` 格式的软件包。本章总是运行在 Arch 家族的某个发行版上——现在是 **{{distro}}**。

## pacman 简介

| 操作 | 命令 |
|---|---|
| 刷新软件包列表 | `pacman -Sy` |
| 升级所有软件 | `pacman -Syu` |
| 安装 | `pacman -S X` |
| 删除 | `pacman -R X` |
| 搜索 | `pacman -Ss X` |
| 软件包信息 | `pacman -Si X` |
| 列出已安装的软件包 | `pacman -Q` |

会修改系统的命令需要 root 权限，所以要用 `sudo` 来运行。

pacman 使用短选项，其中**大写字母**表示操作，小写字母则是修饰符：

| 选项 | 含义 |
|---|---|
| `-S` | Sync（同步）——从软件源安装 |
| `-R` | Remove（删除） |
| `-Q` | Query（查询）——查询已安装的软件包 |
| `y` | 刷新软件包数据库 |
| `u` | 升级所有软件包 |
| `s` | 搜索（与 -S 和 -Q 一起使用），或删除依赖（与 -R 一起使用） |
| `i` | 信息（Info） |

```quiz
`pacman -Q` 中的大写 `Q` 是什么意思？
- [ ] Quit——退出 pacman
- [x] Query——查询已安装的软件包
- [ ] Quick——不经询问直接安装
---
`-Q` 查询已安装的软件包，`-S` 从软件源安装，`-R` 则是删除。
```

搜索不需要 root 权限。试试看：

```try
pacman -Ss htop
```

## 更新系统

```sh
sudo pacman -Syu
```

`-Syu` 的意思是：同步（`S`）、刷新数据库（`y`）并升级所有软件（`u`）。Arch 是*滚动发布*（rolling release）的，所以你会经常运行这条命令。

> **重要！** 千万不要只运行 `pacman -Sy`，然后接着运行 `pacman -S package`。这样一来，新软件包可能需要比你现有版本更新的库——这就是所谓的*部分升级*（partial upgrade），可能会搞坏你的系统。请始终使用 `-Syu`。

```quiz
为什么不应该先运行 `pacman -Sy`，再运行 `pacman -S package`？
- [ ] 因为 `-Sy` 会删除软件包数据库
- [x] 新软件包可能需要比你现有版本更新的库，这可能会搞坏系统
- [ ] 因为 pacman 每天只能安装一个软件包
---
请始终用 `-Syu` 一次性升级所有软件。
```

## 安装和删除

```sh
sudo pacman -S htop
```

`pacman -R package` 删除一个软件包，而 `pacman -Rs package` 还会同时删除不再被其他软件需要的依赖。

## AUR

发行版的软件源里有成千上万个软件包——但并不是什么都有。某个小众程序可能根本不在里面，或者只有一个很旧的版本。在 Arch 家族中，答案就是 **AUR**（*Arch User Repository*，Arch 用户软件仓库）。

AUR 和普通的软件源不一样：这里没有现成的软件包，只有**构建脚本**。这种脚本叫做 `PKGBUILD`，它是一个小小的 bash 脚本，说明了源代码在哪里以及程序该如何构建。你下载这个脚本，自己构建软件包，然后用 pacman 安装它。AUR 非常庞大——几乎所有为 Linux 开发的东西都能在里面找到——但任何人都可以上传脚本。

```quiz
你从 AUR 下载的是什么？
- [ ] 一个现成的、经过 Arch 审查的 `.pkg.tar.zst` 软件包
- [x] 一个构建脚本（`PKGBUILD`），你要用它自己构建软件包
- [ ] 一个 Flatpak
```

### 风险自负

发行版自己软件源中的软件包会一起经过测试、签名，并由发行版的开发者审查。而 AUR 中的软件包没有经过 Arch 的审查。请记住以下几点：

- **软件包是以 root 身份安装的。** 一个软件包可以对计算机做任何事情。你对脚本作者的信任，要和你对发行版的信任一样多。
- **它可能会产生冲突。** 软件包可能会替换系统自带的库，或者需要和你现有版本不同的其他版本。
- **它可能会停止更新。** 如果维护这个脚本的人失去了兴趣，你就再也得不到这个程序的安全更新了。

一条好的经验法则：先在发行版的软件源中找，然后找 Flatpak（见关于通用软件包的那一章），最后才去 AUR 中找。

在本章接下来的部分中，你将从 AUR 安装一个虚构的程序 `moonphase`（它会在终端中显示月相）。

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

```quiz
你从 AUR 安装了 `moonphase`，然后运行 `sudo pacman -Syu`。`moonphase` 会被更新吗？
- [ ] 会——pacman 会更新每一个已安装的软件包
- [x] 不会——pacman 对 AUR 一无所知
---
用 `git pull` 获取新的构建脚本并重新构建，或者使用 AUR 助手。
```

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

对于 AUR，没有需要删除的软件源——每个软件包都是它自己的构建脚本。把不再使用的清理掉吧。
