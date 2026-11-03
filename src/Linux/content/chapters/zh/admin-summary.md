# 总结：系统管理

在这一部分中，你以管理员的身份照管这台计算机：在后台运行的服务、存放文件的磁盘，以及共用这台计算机的用户。这里几乎所有会**修改**东西的操作都需要 root 权限——所以 `sudo` 出现得很频繁。

## 用 systemd 管理服务和日志

**systemd** 是 1 号进程，它启动其他所有东西。它所管理的一切都是一个**单元**（unit），由一个单元文件描述——随软件包附带的单元文件位于 `/usr/lib/systemd/system`，你自己的位于 `/etc/systemd/system`，后者优先。`systemctl` 控制服务，而 **`start`（立即）和 `enable`（开机时）是两回事**。服务输出的所有内容都会进入 **journal**，你可以用 `journalctl` 读取和过滤它。当服务无法启动时：`systemctl --failed`、`systemctl status`，然后 `journalctl -xeu`——并逐字阅读日志。在 Ubuntu 上，SSH 服务叫 `ssh`；其他家族有时会给服务起不同的名字。

## 磁盘和文件系统

**磁盘**被划分为**分区**，每个分区都需要一个**文件系统**才能存放文件。磁盘就是 `/dev` 中的文件（`/dev/sda`、`/dev/sda1` ……）。Linux 没有盘符：每个文件系统都**挂载**在从 `/` 开始的那棵唯一的目录树中的某个位置。`lsblk` 显示磁盘，`df` 显示文件系统用了多少，`du` 显示文件占用了多少空间。拔出 U 盘之前一定要先**卸载**，因为更改可能还在内存中等待写入。开机时挂载什么列在 `/etc/fstab` 中，最好用永远不会改变的 **UUID** 来指定。`fdisk` 和 `mkfs` 是最危险的命令之一——务必检查两遍。

## 用户和组

每个用户都有一个 **UID**——root 是 0，系统用户的编号较小，而真人用户从 1000 开始。用户列在 `/etc/passwd` 中，组列在 `/etc/group` 中，密码哈希则保存在只有 root 能读取的 `/etc/shadow` 中。每个用户都有一个**主组**和任意多个**附加组**。`useradd -m -s /bin/bash` 创建用户，`passwd` 设置密码，`usermod -aG` 把用户加入组——**别忘了 `-a`**。在 Ubuntu 上，sudo 权限来自 `sudo` 组（其他家族使用 `wheel`）。`su -` 用那个用户的密码切换用户，`sudo -u` 则用你自己的密码以另一个用户的身份运行一条命令。

## 命令

| 命令 | 作用 |
|---|---|
| `systemctl status NAME` | 服务运行得怎么样？ |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | 启动、停止、重启、重新读取配置 |
| `sudo systemctl enable --now NAME` | 开机时启动——并且立即启动 |
| `systemctl is-active` / `is-enabled NAME` | 输出一个单词，“是”时退出状态为 0 |
| `systemctl --failed` | 已失败的服务 |
| `systemctl cat NAME` | 显示单元文件 |
| `sudo systemctl daemon-reload` | 重新加载修改过的单元文件 |
| `journalctl -u NAME` | 一个服务的日志 |
| `journalctl -p err -b` | 本次开机以来的错误及更严重的消息 |
| `journalctl -n 20`、`-f`、`--since today` | 最新的几行、实时跟踪、从午夜开始 |
| `lsblk -f` | 磁盘、分区和文件系统 |
| `blkid`、`findmnt -n -o UUID /` | 类型、卷标和 UUID |
| `df -h`、`du -sh DIR` | 磁盘用了多少，文件占用了多少空间 |
| `sudo mount /dev/sdb1 /mnt/usb` | 挂载文件系统 |
| `sudo umount /mnt/usb` | 卸载 |
| `cat /etc/fstab`、`sudo mount -a` | 开机时挂载什么——以及测试修改 |
| `swapon --show`、`free -h` | swap 和内存 |
| `id`、`groups` | UID、GID 和所属的组 |
| `sudo useradd -m -s /bin/bash NAME` | 创建用户 |
| `sudo passwd NAME` | 设置密码 |
| `sudo groupadd GROUP` | 创建组 |
| `sudo usermod -aG GROUP NAME` | 加入组 |
| `sudo usermod -L` / `-U NAME` | 锁定 / 解锁账户 |
| `sudo userdel -r NAME` | 删除用户及其主目录 |
| `su - NAME`、`sudo -u NAME COMMAND` | 切换用户、以另一个用户的身份运行 |
