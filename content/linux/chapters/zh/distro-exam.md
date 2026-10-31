# 测验：发行版和软件包

回答下面的问题。你需要答对 80% 才能通过。

```quiz
在所有现代发行版上，哪个文件会告诉你发行版的名称和版本？
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` 显示 Linux 内核的版本。
```

```quiz
哪一组软件包管理器和软件包格式是对应的？
- [x] `pacman` 和 `.pkg.tar.zst`
- [ ] `dnf` 和 `.deb`
- [ ] `apt` 和 `.rpm`
```

```quiz
哪个发行版是没有版本号的*滚动更新*（rolling release）发行版？
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
`apt update` 和 `apt upgrade` 有什么区别？
- [x] `update` 下载可用软件包的列表，`upgrade` 安装新版本
- [ ] `update` 安装新版本，`upgrade` 下载列表
- [ ] 没有区别
```

```quiz
在 Arch 上，哪条命令安装 `htop` 软件包？
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
为什么先运行 `pacman -Sy`、再运行 `pacman -S package` 是个坏主意？
- [ ] 它会把软件包安装两次
- [x] 这是一次部分升级，可能会搞坏系统
- [ ] `-Sy` 会删除所有已安装的软件包
```

```quiz
dnf 问你 `Is this ok [y/N]`，你直接按了 Enter。会发生什么？
- [ ] 软件包被安装
- [x] 什么也不会安装——默认是 No
```

```quiz
关于 AUR，下面哪些说法是正确的？
- [x] 它包含的是构建脚本（`PKGBUILD`），而不是现成的软件包
- [x] 它的软件包没有经过 Arch 审核
- [ ] `sudo pacman -Syu` 会更新 AUR 软件包
- [ ] `makepkg` 应该用 sudo 运行
```

```quiz
在 Fedora 上，哪条命令添加一个 COPR 软件源？
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` 加上 `makepkg -si`
```

```quiz
Snap 软件包是怎样更新的？
- [ ] 用 `flatpak update`
- [x] 在后台自动更新
- [ ] 从开发者的网站下载一个新文件
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
下载的文件一开始从来都不是可执行的。请先运行
`chmod +x ~/{{downloads}}/{{calculator}}`。
```

```quiz
你想要一个桌面程序的更新版本，而发行版的软件源里没有。经验法则建议你首先尝试什么？
- [ ] 来自一个你不认识的人的额外软件源
- [x] Flatpak
- [ ] 以 root 身份从源代码构建这个程序
```
