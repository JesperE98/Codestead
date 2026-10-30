# Flatpak、Snap 和 AppImage

普通的软件包是为某一个特定的发行版和版本构建的。对于开发桌面程序的人来说，这是个问题：同一个程序必须为 Debian、Ubuntu、Fedora、Arch 以及它们的各个版本分别重新打包。**通用软件包格式**解决了这个问题：它把程序所需的大部分东西都打包进软件包里——这样同一个软件包就能在所有发行版上运行。

三大格式是 **Flatpak**、**Snap** 和 **AppImage**。它们并不取代发行版的包管理器，而是对它的补充，主要用于桌面程序。

> 模拟器只有一个终端。当你启动图形程序时，会看到一行提示，告诉你它本来会在一个窗口中打开。

## 安装程序的四种方式

| | 发行版软件包 | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| 来源 | 发行版的软件源 | Flathub（或其他 *remote*） | Snap Store（Canonical） | 开发者的网站 |
| 适用于 | 一个发行版和版本 | 所有发行版 | 所有装有 `snapd` 的发行版 | 所有发行版（需要 FUSE） |
| 沙盒 | 无 | 有 | 有（*classic* 除外） | 无 |
| 体积 | 小——与系统共享库 | 第一次很大（运行时），之后共享 | 大——每个 snap 及其基础环境 | 大——所有东西都在一个文件里 |
| 更新 | 随系统一起（`apt upgrade` ……） | `flatpak update` | 在后台自动更新 | 自己动手——下载新文件 |
| 适合 | 系统程序、命令行工具、服务器 | 桌面程序 | Ubuntu、桌面和服务器 | 单个程序、试用新版本 |

**沙盒**（sandbox）的意思是，程序只能访问它被允许访问的东西，比如网络或你的下载文件夹，而不是你的整个主目录。

## Flatpak

Flatpak 是大多数发行版在桌面程序方面达成共识的格式。程序从一个 **remote**（远程源）下载——几乎总是 **Flathub**——并共享通用的**运行时**（runtime，例如 `org.gnome.Platform`），这样就不必每个程序都把所有东西自带一份。

:::debian
### 安装 Flatpak

{{distro}} 上没有预装 Flatpak：

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### 安装 Flatpak

Flatpak 在 Arch 的软件源中：

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### {{distro}} 上的 Flatpak

Fedora Workstation 自带 Flatpak，并且已经添加了 Fedora 自己的 remote `fedora`：

```sh
flatpak --version
flatpak remotes
```
:::

### 添加 Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` 让命令在 Flathub 已经存在时不会报错——这在脚本和安装指南中很有用。

### 搜索、安装和运行

每个程序都有一个 **ID**，写成反转的域名形式，例如 `org.gimp.GIMP`：

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak 会显示程序需要哪些**权限**，以及会一起安装哪些运行时。注意看体积：第一个程序会拉取一个几百 MB 的运行时，但下一个使用同一运行时的程序就会很小。

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### 为整个系统安装，还是只为你自己

不加选项时，Flatpak 会为**整个系统**安装（安装在 `/var/lib/flatpak` 中）。在桌面上，Flatpak 会弹出窗口要你输入密码，所以不需要 sudo。加上 `--user` 后，程序会安装到你的主目录中（`~/.local/share/flatpak`），其他用户看不到它。用户级安装有**它自己的 remote**，所以 Flathub 也要用 `--user` 再添加一次：

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

### 更新和卸载

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` 会删除不再被任何已安装程序使用的运行时。

## Snap

Snap 是 **Canonical** 的格式，也是 Ubuntu 上的默认格式——例如在 Ubuntu 上，Firefox 就是一个 snap。snap 来自由 Canonical 运营的 **Snap Store**，并由 `snapd` 服务管理。它们会在后台自动更新。

:::debian
### Ubuntu 和 Debian 上的 Snap

Ubuntu 已经自带 Snap。在 Debian 上，你需要先安装 `snapd`：

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Arch 上的 Snap

Snap 不在 Arch 的软件源中——只在 AUR 里有。像上一章那样构建它：

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

在真实的系统上，你还需要用 `sudo systemctl enable --now snapd.socket` 启动这个服务。这说明 Snap 在 Arch 上并不“如鱼得水”：那里的大多数人都用 Flatpak。
:::

:::redhat
### Fedora 上的 Snap

Fedora 押注于 Flatpak，但 Snap 也在它的软件源中：

```sh
sudo dnf install snapd
```
:::

### 使用 snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

已安装的 snap 会以程序的形式出现在 `/snap/bin` 中。安装和删除都需要 root 权限。

### 严格模式还是经典模式

大多数 snap 都以**严格模式**（strict）在沙盒中运行。需要访问整个系统的程序，比如代码编辑器，会以**经典约束**（classic confinement）的方式发布。这时你必须自己用 `--classic` 来批准：

```sh
sudo snap install code
sudo snap install code --classic
```

### 通道和更新

每个 snap 都有若干**通道**（channel）：`stable`、`candidate`、`beta` 和 `edge`（最新的、未经测试的版本）。`snap info` 会显示这些通道，`--channel=beta` 可以选择另一个通道。更新是自动进行的，但你也可以强制更新，或者删除 snap：

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap 也有批评者：Snap Store 完全由 Canonical 一家运营，自动更新无法彻底关闭，而且程序第一次启动时可能会很慢。

## AppImage

**AppImage** 就是把整个程序装进**一个单独的文件**里。你从程序的网站上下载它，让它可执行，然后启动——无需安装，也无需 root。想去掉这个程序，删掉这个文件就行了。

你的主目录中已经有一个下载好的 AppImage，在 `~/Nedladdningar`（瑞典语的“下载”）里：

```sh
cd ~/Nedladdningar
ls -l
```

下载下来的文件一开始总是不可执行的。让它变成可执行文件，然后启动它：

```sh
chmod +x Kalkylator.AppImage
./Kalkylator.AppImage
```

### FUSE

AppImage 会借助 **FUSE** 把自己挂载成一个文件系统，并且需要旧版本 2 的库（`libfuse.so.2`）。没有它，你就会得到错误信息 *"AppImages require FUSE to run"*。

:::debian
在 Ubuntu 24.04 和 Debian 13 上，这个软件包叫做 `libfuse2t64`（*t64* 来自向 64 位时间的过渡；在较旧的版本中它叫 `libfuse2`）：

```sh
sudo apt update
sudo apt install libfuse2t64
./Kalkylator.AppImage
```

> 在 Ubuntu 上**不要**安装 `fuse` 软件包——它会替换掉桌面所需的 `fuse3`。
:::

:::arch
在 Arch 上，这个软件包叫做 `fuse2`：

```sh
sudo pacman -S fuse2
./Kalkylator.AppImage
```
:::

:::redhat
在 Fedora 上，这个软件包叫做 `fuse-libs`：

```sh
sudo dnf install fuse-libs
./Kalkylator.AppImage
```
:::

### 看看里面

AppImage 也可以被解包。即使没有 FUSE 也能做到：

```sh
./Kalkylator.AppImage --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` 会临时解包并立即启动。

### 请记住

- AppImage **没有沙盒**——程序以你的身份运行，你能访问的一切它都能访问。只从程序的官方网站下载。
- **没有自动更新**。有新版本发布时，你要自己下载新文件（有些程序可以自我更新）。
- 程序不会自动出现在应用程序菜单中。*Gear Lever* 或 *AppImageLauncher* 之类的工具可以解决这个问题。

## 我该选哪一种？

1. 系统程序和命令行程序用**发行版的软件包**——它们最小、最快，并且会随系统的其他部分一起更新。
2. 想要更新的版本，或者软件源中缺少某个程序时，桌面程序用 **Flatpak**。
3. 如果你用的是 Ubuntu，或者程序只有 snap 版本，就用 **Snap**。
4. 想快速试用一个程序，或者开发者只提供这种格式时，用 **AppImage**。
