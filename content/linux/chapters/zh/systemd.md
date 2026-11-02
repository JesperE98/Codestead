# 用 systemd 管理服务和日志

Linux 计算机一直在做许多没人手动启动的事情：接受 SSH 连接、保持时钟同步、运行定时任务、写日志。做这些事的程序叫做**服务**（service），而在几乎所有现代发行版中，都由 **systemd** 来管理它们。在本章中，你将学习如何启动和停止服务、让它们在开机时自动启动，以及——最重要的——在出问题时阅读日志。

## init 和 systemd

Linux 内核启动后，只会运行一个程序：**init**，也就是 1 号进程。然后由 init 启动其他所有东西。如今 init 几乎总是 **systemd**——Debian、Ubuntu、Arch 和 Fedora 都是如此。看一看：

```sh
ps -p 1
```

这个进程叫 `/sbin/init`，但它只是指向 `systemd` 程序的一个链接。

systemd 不只是启动服务。它会跟踪服务是否还活着，在服务崩溃时重启它们（如果你希望这样的话），把它们输出的所有内容收集到一个共享的日志——**journal**（日志）——中，并且为系统的大部分功能提供了工具：

| 工具 | 作用 |
|---|---|
| `systemctl` | 控制服务：状态、启动、停止、开机启动 |
| `journalctl` | 读取 journal（日志） |
| `hostnamectl` | 显示和修改计算机的名字 |
| `systemd-analyze` | 显示开机花了多长时间 |

## 单元和服务

systemd 管理的每样东西都叫做一个**单元**（unit）。单元有好几种，种类从后缀就能看出来：`.service`（服务）、`.timer`（定时任务）、`.socket`、`.mount`、`.target`（一组单元，有点像开机过程中的一个“阶段”）等等。本章讲的是服务。

每个单元都由一个**单元文件**（unit file）来描述，它是一个小小的文本文件。单元文件存放在两个地方：

| 目录 | 内容 |
|---|---|
| `/usr/lib/systemd/system/` | 随软件包一起安装的单元文件。不要在这里编辑！ |
| `/etc/systemd/system/` | 管理员自己的单元文件。它们的优先级更高。 |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

较旧的 Debian 和 Ubuntu 版本经常写的是 `/lib/systemd/system`。这是同一个目录——`/lib` 是指向 `/usr/lib` 的链接。

服务的名字就是文件名，例如 `myserver.service`。输入命令时可以省略 `.service`：`systemctl status myserver` 也一样能用。

## 服务运行得怎么样？——`systemctl status`

你最常用的命令是 `systemctl status`：

```sh
systemctl status ssh
```

在 Ubuntu 上，SSH 服务器叫 `ssh`。输出大致如下：

```text
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 UTC; 2h 13min ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/ssh.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 ubuntu systemd[1]: Starting ssh.service - OpenBSD Secure Shell server...
Oct 30 07:54:07 ubuntu sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 ubuntu systemd[1]: Started ssh.service - OpenBSD Secure Shell server.
```

逐行解释：

| 行 | 含义 |
|---|---|
| `●` | 绿点 = 正在运行。红色 `×` = 已失败。白色 `○` = 已停止。 |
| `Loaded` | 单元文件在哪里、服务是否开机启动（`enabled`/`disabled`/`static`），以及发行版的默认设置（`preset`） |
| `Active` | 最重要的一行：`active (running)`、`inactive (dead)` 或 `failed`——以及从什么时候开始 |
| `Docs` | 去哪里阅读更多信息（`man sshd`） |
| `Main PID` | 服务的主进程——和 `ps aux` 中的 PID 相同 |
| `Memory`, `CGroup` | 它占用了多少内存，以及哪些进程属于它 |
| 最后几行 | journal 中该服务日志的最新几行 |

`static` 表示这个服务不能单独启用——它会在另一个单元需要它时被启动。

> **提示：** 在真实的终端中，较长的输出会显示在分页器（`less`）中。按 `q` 返回。如果你不想用分页器，可以加上 `--no-pager`。

## 启动、停止和重启

```text
sudo systemctl start myserver      # 立即启动
sudo systemctl stop myserver       # 立即停止
sudo systemctl restart myserver    # 停止后再启动
sudo systemctl reload myserver     # 让它重新读取配置
```

所有会**改变**状态的操作都需要 root 权限，所以别忘了 `sudo`。如果不加，systemctl 会回答：

```text
Failed to start myserver.service: Interactive authentication required.
```

`reload` 只适用于支持它的服务。它的好处是服务在此期间会一直运行——不会断开任何连接。修改了服务的配置文件之后，最后一步就是 `reload` 或 `restart`。

> **试试看！** 在进程那一章中，你用 `pkill` 停止了练习服务器。看看 `systemctl status myserver`——systemd 注意到了这个进程已经消失。用 `systemctl` 重新启动它，然后把它的 PID 和 `pgrep -l myserver` 的结果比较一下。

## 现在还是开机时？`start` 和 `enable`

这是关于 systemd 最常见的误解：**`start` 和 `enable` 是两回事。**

| 命令 | 作用 |
|---|---|
| `systemctl start X` | **立即**启动服务。重启之后它就又没了。 |
| `systemctl enable X` | 让服务在**开机时**自动启动——但现在不启动。 |
| `systemctl enable --now X` | 两者同时进行。 |
| `systemctl disable X` | 开机时不启动（加上 `--now` 还会把它停止）。 |

`enable` 会在一个目录中创建一个链接，这个目录以单元文件 `[Install]` 部分中指定的 target 命名，通常是 `multi-user.target.wants`：

```text
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

计算机开机时，systemd 会遍历这个目录，并启动其中的所有内容。你可以这样查询状态：

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

`is-active` 和 `is-enabled` 非常适合在脚本中使用——它们只输出一个单词，也就是你在 `systemctl status` 中看到的那个状态（`active`、`inactive` 或 `failed`，以及 `enabled`、`disabled` 或 `static`），如果答案是“是”，就以状态 0 退出。加上 `-q`，它们会完全不输出任何内容：

```text
if systemctl is-active -q myserver; then echo "the server is running"; fi
```

在模拟器中一台刚刚启动的计算机上，`myserver` 正在运行，但没有人启用过它。下面这两条命令会打印什么？

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
myserver **现在**正在运行，但没有人运行过 `enable`——重启之后它就不会被启动。`start` 和 `enable` 确实是两回事。
```

## 列出服务

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` 显示正在运行（或已失败）的服务。加上 `--all` 会把已停止的也包括进来。
- `--failed` 只显示已失败的服务。感觉哪里不对劲时，这是很好的第一个命令！
- `list-unit-files` 显示所有已安装的单元文件，以及它们是 `enabled`、`disabled` 还是 `static`。

## journal——`journalctl`

服务、内核以及 systemd 本身输出的所有内容都会进入 journal。不带选项时，你会得到整个 journal，最旧的在最前面：

```sh
journalctl
```

内容很快就会变得非常多，所以几乎总是需要过滤：

| 命令 | 显示 |
|---|---|
| `journalctl -u ssh` | 只显示一个服务（`-u` 代表 *unit*） |
| `journalctl -n 20` | 最新的 20 行 |
| `journalctl -f` | 最新的几行，然后实时显示新到达的行（按 Ctrl+C 退出） |
| `journalctl -b` | 只显示本次开机（`-b -1` = 上一次开机） |
| `journalctl --since today` | 从午夜开始。也可以用 `yesterday`、`"10:00"`、`"1 hour ago"` |
| `journalctl -p err` | 只显示错误及更严重的消息 |
| `journalctl -xe` | 跳到末尾并附加解释 |
| `journalctl -k` | 只显示内核消息（类似 `dmesg`） |

这些选项可以组合使用。几个经典用法：

```sh
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
```

### 优先级

journal 中的每一行都有一个**优先级**（priority）。`-p` 会显示你选择的级别*以及所有更严重的级别*：

| 数字 | 名称 | 含义 |
|---|---|---|
| 0 | `emerg` | 系统已无法使用 |
| 1 | `alert` | 必须立即处理 |
| 2 | `crit` | 严重错误 |
| 3 | `err` | 错误——以红色显示 |
| 4 | `warning` | 警告——以黄色显示 |
| 5 | `notice` | 正常，但值得注意 |
| 6 | `info` | 信息 |
| 7 | `debug` | 调试信息 |

如果 `journalctl -p err` 显示了几条像 `ACPI BIOS Error` 这样的内核错误，不用担心。几乎每台计算机上都有这类错误，它们通常是无害的——是计算机固件中的 bug，内核会绕过它们。

通常，你必须是 root，或者是允许读取 journal 的用户组的成员（在 Ubuntu 上是 `adm` 或 `systemd-journal`——其他家族使用别的组），才能看到全部内容。模拟器中的用户可以读取整个 journal。

```quiz
`journalctl -p warning` 会显示哪些优先级？
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` 会显示你选择的优先级*以及所有更严重的级别*——也就是数字相同或更小的所有级别（`warning` 是 4）。
```

## 排查无法启动的服务

有人在这台计算机上设置了 **reportd** 服务，但出了点问题。通常的排查步骤如下：

1. **什么失败了？** 列出失败的服务：

   ```sh
   systemctl --failed
   ```

2. **查看状态。** 最后几行往往就够了：

   ```sh
   systemctl status reportd
   ```

3. **阅读该服务的完整日志。** 它几乎总会告诉你哪里出了问题——仔细地、一个词一个词地读：

   ```sh
   journalctl -xeu reportd
   ```

   启动失败时，`systemctl` 自己也会建议你用这个命令：`See "systemctl status reportd.service" and "journalctl -xeu reportd.service" for details.`

4. **解决问题**，例如某个配置文件缺失或者有拼写错误。

5. **重启并检查：**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

`Main process exited, code=exited, status=1/FAILURE` 这一行表示程序自己因错误而退出了。如果显示的是 `status=203/EXEC`，说明 systemd 根本找不到这个程序——检查 `ExecStart=` 中的路径。

```quiz
某个服务无法启动，journal 中显示 `status=203/EXEC`。你首先应该检查哪里？
- [ ] `/etc/fstab`
- [x] 单元文件中 `ExecStart=` 的路径
- [ ] 用 `journalctl -p err` 查看优先级
- [ ] 哪儿都不用看——这表示程序自己因错误而退出了
---
203/EXEC 表示 systemd 根本找不到这个程序。如果程序启动后因错误而退出，显示的则是 `status=1/FAILURE`。
```

## 单元文件——`systemctl cat`

要确切了解一个服务是如何启动的，就读一读它的单元文件：

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| 部分 | 内容 |
|---|---|
| `[Unit]` | 描述和启动顺序：`After=network.target` = 在网络之后启动 |
| `[Service]` | 程序如何运行：`ExecStart=`（命令）、`User=`、`Restart=on-failure` …… |
| `[Install]` | `enable` 应该做什么：`WantedBy=multi-user.target` |

如果你修改了单元文件，systemd 必须重新加载它，修改才会生效——否则你会在 `systemctl status` 中看到一条警告：

```text
sudo systemctl daemon-reload
```

永远不要编辑 `/usr/lib/systemd/system` 中的文件——下次软件包更新时它们会被覆盖。应该把你自己的版本放到 `/etc/systemd/system` 中。

```quiz
你想修改一个随软件包附带的服务的启动方式。正确的做法是什么？
- [ ] 编辑它在 `/usr/lib/systemd/system` 中的文件，然后重启服务
- [x] 把你自己的版本放到 `/etc/systemd/system` 中，运行 `sudo systemctl daemon-reload`，然后重启服务
- [ ] 把你自己的版本放到 `/etc/systemd/system` 中——systemd 会自己发现这个修改
- [ ] 编辑 `/usr/lib/systemd/system` 中的文件，然后对它运行 `sudo systemctl enable`
---
`/etc/systemd/system` 中的文件优先，而且软件包更新时它们不会被覆盖。`daemon-reload` 让 systemd 重新加载修改过的单元文件。
```

## 服务都叫什么名字？

systemd 在所有地方的用法都一样，但**服务的名字并不总是相同的**——这取决于软件包叫什么名字，以及发行版选择了哪些程序。在 Ubuntu 上：

| 服务 | 在 Ubuntu 上的名字 |
|---|---|
| SSH 服务器 | `ssh`（别名 `sshd`） |
| 定时任务（cron） | `cron` |
| 网络 | `NetworkManager` |
| 防火墙 | `ufw`（如果已安装） |
| 时钟 | `systemd-timesyncd` |

SSH 服务真正的名字是 `ssh.service`。它有一个别名 `sshd.service`，所以 `systemctl status sshd` 也能用——但输出中显示的是真正的名字。其他家族可能会给同样的服务起不同的名字（在 Arch 和 Fedora 上，SSH 服务叫 `sshd`）——关于发行版和软件包的部分讲的就是这类差异。

不确定某个服务叫什么？在列表中搜索：

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` 是真正的单元文件，而 `sshd.service` 被列为它的 `alias`（别名）。
```

## 重启计算机

`enable` 的效果只有在计算机重启后才能看到。你可以在模拟器中试一试——它一眨眼就重启好了：

```text
sudo systemctl reboot
```

重启后，只有已启用的服务在运行。用 `journalctl -b -1` 可以查看上一次开机的日志（以及所有东西是如何关闭的），`journalctl --list-boots` 会显示 journal 中记录的所有开机记录。

## systemd 的更多功能

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` 显示计算机的名字、操作系统和内核（用 `sudo hostnamectl set-hostname NEWNAME` 可以给它改名）。`systemd-analyze` 显示开机花了多长时间，而 `blame` 显示哪些服务耗时最长——计算机开机很慢时，这非常有用。
