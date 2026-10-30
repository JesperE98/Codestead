# 软件包管理

在 Windows 和 macOS 上，你经常从网站上下载程序。而在 Linux 上，你几乎所有东西都是用**包管理器**（package manager）来安装的。这是各个发行版家族之间最大的区别——本章的内容也会因你所选的发行版而有所不同。现在显示的是 {{distro}} 上的 **{{pm}}**。

## 软件包、软件源和依赖

- **软件包**（package）是打包成一个文件的程序（或库），同时附带有关其版本和所需依赖的信息。
- **软件源**（repository，也叫仓库）是发行版发布其所有软件包的服务器。这些软件包经过测试和签名，所以你可以确信它们没有被篡改过。
- **依赖**（dependency）是另一个必需的软件包。包管理器会自动安装依赖。

包管理器还会记录已经安装了哪些软件，并且只需一条命令就能更新计算机上的*所有*软件。

## 同一件事——三种“方言”

| 操作 | apt（Debian） | pacman（Arch） | dnf（Red Hat） |
|---|---|---|---|
| 刷新软件包列表 | `apt update` | `pacman -Sy` | `dnf check-update` |
| 升级所有软件 | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| 安装 | `apt install X` | `pacman -S X` | `dnf install X` |
| 删除 | `apt remove X` | `pacman -R X` | `dnf remove X` |
| 搜索 | `apt search X` | `pacman -Ss X` | `dnf search X` |
| 软件包信息 | `apt show X` | `pacman -Si X` | `dnf info X` |
| 列出已安装的软件包 | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

会修改系统的命令需要 root 权限，所以要用 `sudo` 来运行。

:::debian
## {{distro}} 上的 apt

### update 和 upgrade 是两回事

几乎每个人一开始都会被这一点搞糊涂：

- `apt update` 下载可用软件包及其版本的**列表**。它不会安装任何东西。
- `apt upgrade` 为你已有的软件**安装**新版本。

所以一定要先运行 `update`。更新系统最常用的方法是：

```sh
sudo apt update && sudo apt upgrade
```

在运行 `apt update` 之前（例如在一台刚安装好的服务器上），软件包列表是空的，apt 根本找不到任何软件包。

### 安装和删除

```sh
sudo apt install htop
```

`apt remove` 会删除程序，但会保留它的配置文件。`apt purge` 则会把配置文件也一起删除。当 apt 询问 `Do you want to continue? [Y/n]` 时，大写的 `Y` 表示直接按 Enter 就等于回答 yes。使用 `-y` 选项，apt 会自动回答 yes。

### apt 还是 apt-get？

`apt` 是现代的、对用户友好的版本，带有进度条和彩色显示。`apt-get` 和 `apt-cache` 比较老，但它们的输出格式更稳定，所以在脚本中仍然会用到它们。

### 底层原理：dpkg 和 .deb

软件包是 `.deb` 文件，实际负责解包的是 `dpkg` 程序。apt 则负责处理周边的一切：下载、依赖和更新。
:::

:::arch
## {{distro}} 上的 pacman

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

### 更新系统

```sh
sudo pacman -Syu
```

`-Syu` 的意思是：同步（`S`）、刷新数据库（`y`）并升级所有软件（`u`）。Arch 是*滚动发布*（rolling release）的，所以你会经常运行这条命令。

> **重要！** 千万不要只运行 `pacman -Sy`，然后接着运行 `pacman -S package`。这样一来，新软件包可能需要比你现有版本更新的库——这就是所谓的*部分升级*（partial upgrade），可能会搞坏你的系统。请始终使用 `-Syu`。

### 安装和删除

```sh
sudo pacman -S htop
```

`pacman -R package` 删除一个软件包，而 `pacman -Rs package` 还会同时删除不再被其他软件需要的依赖。

### AUR

除了官方软件源之外，还有 **AUR**（*Arch User Repository*，Arch 用户软件仓库），用户在这里分享成千上万个程序的构建脚本。人们通常会借助 `yay` 或 `paru` 这样的辅助工具从 AUR 安装软件。AUR 中的软件包没有经过 Arch 官方审核——安装前一定要先阅读构建脚本（PKGBUILD）。
:::

:::redhat
## {{distro}} 上的 dnf

### 自动获取元数据

dnf 会在需要时自行获取新的软件包信息，所以不需要像 `apt update` 那样的单独步骤。如果你想查看有哪些可用的更新，请运行：

```sh
dnf check-update
```

如果有可用更新，退出码就是 `100`——这在脚本中非常方便。

### 安装和删除

```sh
sudo dnf install htop
```

注意这个问题：`Is this ok [y/N]`。大写的 `N` 表示默认选项是 **No**（否）——如果你直接按 Enter，安装就会被取消。请输入 `y` 再按 Enter，或者使用 `-y`。

### 升级系统

```sh
sudo dnf upgrade
```

### 底层原理：rpm

软件包是 `.rpm` 文件，底层工具叫做 `rpm`。dnf 取代了较老的 `yum`，而 Fedora 41 带来了新版本 **dnf5**，速度明显更快。在 RHEL、Rocky 和 AlmaLinux 上，这个命令同样叫做 `dnf`。
:::

## 同一个程序，不同的名字

软件包在各处通常都使用相同的名字——但并非总是如此。举几个例子：

| 程序 | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH 客户端 | `openssh-client` | `openssh` | `openssh-clients` |

如果你不确定软件包的名字，请始终先用包管理器搜索一下。

## 通用软件包格式

还有一些在所有发行版上都能使用的格式：**Flatpak**（常用于桌面应用程序，通过 Flathub 获取）、**Snap**（来自 Canonical，是 Ubuntu 的默认格式）和 **AppImage**（单个可执行文件）。它们有各自的命令，是对发行版包管理器的补充。
