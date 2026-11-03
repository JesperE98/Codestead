# 总结：发行版和软件包

## 家族

基础部分在每个发行版上都一样：Linux 内核、bash 和 GNU 工具、目录布局，以及（几乎所有地方都有的）systemd。区分各个家族的，主要是程序的安装方式。

| | Debian 家族 | Arch 家族 | Red Hat 家族 |
|---|---|---|---|
| 例子 | Debian、Ubuntu、Linux Mint | Arch、Manjaro、EndeavourOS | Fedora、RHEL、Rocky Linux |
| 包管理器 | `apt` | `pacman` | `dnf` |
| 软件包格式 | `.deb` | `.pkg.tar.zst` | `.rpm` |
| 底层工具 | `dpkg` | （pacman） | `rpm` |
| sudo 组 | `sudo` | `wheel` | `wheel` |
| 发布方式 | 稳定版本 | 滚动更新 | 每 6 个月发布一个新版本（Fedora） |

- `cat /etc/os-release` 显示你运行的是哪个发行版，`uname -r` 显示内核版本。
- **软件包**是打包成一个文件的程序，**软件源**是存放发行版经过测试和签名的软件包的服务器，**依赖**是另一个必需的软件包——包管理器会自动安装它。
- 会修改系统的命令需要 root 权限，所以要用 `sudo` 来运行。

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

需要记住的几点：

- **apt**：`apt update` 只下载软件包列表——`apt upgrade` 才会安装新版本。先运行 `update`。`[Y/n]` 表示按 Enter 就等于回答 yes。
- **pacman**：大写字母表示操作（`-S`、`-R`、`-Q`），小写字母是修饰符。始终用 `-Syu` 升级——千万不要先 `-Sy` 再 `-S package`（部分升级可能会搞坏系统）。
- **dnf**：会自行获取软件包信息。有可用更新时，`dnf check-update` 以 `100` 退出。`[y/N]` 表示按 Enter 就等于回答 **no**。

软件包的名字在各处通常都一样，但并非总是如此——在 Fedora 中，Vim 叫 `vim-enhanced`。不确定时就搜索一下。

## 额外的软件源

| | PPA | AUR | COPR |
|---|---|---|---|
| 家族 | Ubuntu（以及 Linux Mint 等） | Arch（以及 Manjaro、EndeavourOS 等） | Fedora（以及 RHEL 家族） |
| 你下载的是什么 | 现成的 `.deb` 软件包 | 构建脚本（`PKGBUILD`）——由你自己构建 | 现成的 `.rpm` 软件包 |
| 如何添加 | `add-apt-repository ppa:…` | `git clone …` 和 `makepkg -si` | `dnf copr enable …` |
| 如何更新 | `sudo apt update && sudo apt upgrade` | `yay -Syu`——或者自己重新构建 | `sudo dnf upgrade` |
| 删除软件源 | `sudo add-apt-repository --remove ppa:…` | –（没有需要删除的软件源） | `sudo dnf copr remove …` |
| 是否经过发行版审查 | 否 | 否 | 否 |

- 来自额外软件源的软件包是以 root 身份安装的，可能会与系统自带的软件包冲突，也可能会停止更新。先在发行版的软件源中找，然后找 Flatpak，最后才去找你信任的人提供的额外软件源。
- `apt policy` 显示软件包来自哪里；apt 会选择版本最高的那个。
- 构建之前一定要阅读 `PKGBUILD`。不要用 sudo 运行 `makepkg`。`pacman -Qm` 列出*外来*（foreign）软件包，而 `pacman -Syu` 不会更新它们——`yay` 这样的 AUR 助手才会。

## 通用软件包

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| 来源 | Flathub（或其他 *remote*） | Snap Store（Canonical） | 开发者的网站 |
| 沙盒 | 有 | 有（*classic* 除外） | 无 |
| 更新 | `flatpak update` | 在后台自动更新 | 自己更新——下载一个新文件 |
| 安装 | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file`，然后运行它 |

- Flatpak 程序有一个写成反向域名形式的 ID（`org.gimp.GIMP`），用 `flatpak run` 启动。`--user` 会安装到你的主目录中，并有它自己的 remote。
- Snap 是 Ubuntu 的默认格式。采用经典约束的 snap 需要 `--classic`，每个 snap 都有 `stable` 和 `edge` 这样的通道。
- AppImage 需要 FUSE 2（在 Ubuntu 24.04 和 Debian 13 上是 `libfuse2t64`，在 Arch 上是 `fuse2`，在 Fedora 上是 `fuse-libs`），它没有沙盒，也不会自动更新。

**经验法则：** 系统程序和命令行程序用发行版的软件包，桌面程序用 Flatpak，在 Ubuntu 上或者程序只以 snap 形式存在时用 Snap，想快速试用某个程序就用 AppImage。
