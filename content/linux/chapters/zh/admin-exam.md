# 测验：系统管理

展示你在服务、磁盘和用户方面学到了什么。问题覆盖整个部分，你需要答对 80%
才能通过。

```quiz
`myserver` 应该在每次开机时自动启动，但现在**不**能启动它。哪条命令恰好做到这一点？
- [ ] `sudo systemctl start myserver`
- [x] `sudo systemctl enable myserver`
- [ ] `sudo systemctl enable --now myserver`
- [ ] `sudo systemctl restart myserver`
---
`enable` 在开机时生效，`start` 立即生效，`--now` 两者都做。
```

这台计算机上的服务 `reportd` 启动失败了。这条命令会输出什么？

```predict
$ systemctl is-active reportd
failed
---
`is-active` 只输出一个词——这里就是 `systemctl --failed` 列出的那个状态。只有当答案是
`active` 时，退出状态才是 0。
```

```quiz
你想在测试 `myserver` 时盯着它的日志，让新行一出现就显示出来。你用哪条命令？
- [ ] `journalctl -n 20`
- [x] `journalctl -u myserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status myserver --all`
---
`-u` 选择一个单元，`-f` 会持续显示新行，直到你按下 Ctrl+C。
```

```try
systemctl cat myserver
---
`ExecStart=` 是启动服务的命令，`WantedBy=` 则是 `enable` 要用到的。
```

```quiz
你不加 `sudo` 运行 `systemctl stop myserver`，结果得到
*Interactive authentication required*。为什么？
- [ ] myserver 没有在运行
- [x] 所有改变服务的操作都需要 root
- [ ] 你必须先运行 `daemon-reload`
- [ ] `stop` 只对已启用的服务有效
```

```quiz
为什么 `/etc/fstab` 里通常写的是 `UUID=…`，而不是 `/dev/sda2`？
- [ ] UUID 打起来更短
- [x] 添加磁盘时设备名可能会变，但 UUID 永远不变
- [ ] `mount` 看不懂设备名
- [ ] UUID 显示文件系统有多满
---
UUID 是和文件系统一起创建的。你可以用 `lsblk -f`、`blkid` 或 `findmnt` 找到它。
```

```quiz
`df -h` 显示 `/` 已经满了 98%。哪条命令能帮你找出是**哪些目录**占用了空间？
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` 询问文件系统有多满；`du` 则遍历文件并把它们加起来。
```

在这台计算机上，你的主目录不在单独的文件系统上。这条命令会输出什么？

```predict
$ df -h ~ | awk 'NR > 1 {print $6}'
/
---
给定一个路径时，`df` 只显示该路径所在的文件系统。第六列是 `Mounted on`——也就是根文件系统。
```

```quiz
你在 `/etc/fstab` 中添加了一行。在重启**之前**你应该做什么？
- [ ] 什么也不用做——这个文件只在开机时读取
- [x] 用 `sudo mount -a` 测试一下
- [ ] 运行 `sudo systemctl daemon-reload`
- [ ] 用 `mkfs` 格式化分区
---
`/etc/fstab` 中的错误可能导致计算机无法正常启动。`mount -a` 会挂载文件中所有尚未挂载的内容，
这样你现在就能看到错误。
```

```quiz
你准备在一台真实的计算机上用 `mkfs` 格式化一个分区。你应该先检查什么？（选择所有符合的选项。）
- [x] 用 `lsblk -f` 确认大小、`RM` 列和卷标都对得上
- [x] 确认分区没有被挂载
- [x] 确认你已经备份了所有重要的东西
- [ ] 确认分区列在 `/etc/fstab` 中
```

```quiz
为什么密码哈希放在 `/etc/shadow` 里，而不是 `/etc/passwd` 里？
- [ ] `/etc/passwd` 太小了
- [x] `/etc/passwd` 必须让所有人都能读取，而 `/etc/shadow` 只有 root 能读
- [ ] 哈希是可逆的，所以必须藏起来
- [ ] `/etc/passwd` 只在开机时读取
---
否则任何人都可以复制这些哈希，然后慢慢尝试破解。`ls -l` 需要 `/etc/passwd`
来显示所有者的名字。
```

`/etc/group` 中的字段依次是组名、`x`、GID 和成员。谁在 `sudo` 组里？

```predict
$ grep ^sudo /etc/group | cut -d: -f4
elev
```

```quiz
执行 `sudo userdel kim`——不加 `-r`——会发生什么？
- [x] 用户被删除，但主目录 `/home/kim` 会留下来
- [ ] 什么也不会发生——`userdel` 总是需要 `-r`
- [ ] 用户和主目录都会被删除
- [ ] 账户只是被锁定
```

```quiz
某个用户的 UID 是 33，shell 是 `/usr/sbin/nologin`。它最可能是什么？
- [ ] root
- [ ] 普通用户——一个人
- [x] 某个服务用来运行的系统用户
- [ ] 一个已删除的用户
---
UID 1–999 用于系统用户，`nologin` 表示没有人能以它的身份登录。
```

```try
getent group sudo
---
`getent` 用和系统相同的方式查找这个组。
```
