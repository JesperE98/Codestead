# 通过 SSH 复制文件

在网络一章中，你用 `ssh` 在服务器 `192.168.1.10` 上运行了命令。在这里，你将给服务器起一个简短的名字，用 `scp` 在它和你的计算机之间复制文件，并用 `rsync` 让整个目录保持同步。

## 简短的名字——`~/.ssh/config`

每次都输入 `ssh {{user}}@192.168.1.10` 很快就会让人厌烦。在 `~/.ssh/config` 文件中，你可以给服务器起一个简短的名字：

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` 是简短的名字，`HostName` 是真实的地址（或名字），`User` 是服务器上的用户名。如果服务器监听的不是 22 端口，就加上一行，例如 `Port 2222`。之后这样就够了：

```sh
ssh srv hostname
```

模拟器目前还没有文本编辑器，所以用 `echo` 来写这个文件。缩进只是为了便于阅读：

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh 对这个文件要求很严格。如果其他人可以写入它，ssh 会以 *Bad owner or permissions* 拒绝工作；一个拼错的词也会让它立即停止：

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh 在连接之前会读取整个文件，所以一个错误的词就会阻止所有连接——而错误信息会告诉你它在哪一行。
```

这些名字同样适用于 `scp` 和 `rsync`。

```quiz
在 `~/.ssh/config` 中，哪一行说明 ssh 实际要连接到哪里？
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` 是你自己输入的简短名字，`HostName` 是真实的地址，`User` 是你登录时使用的用户。
```

## 复制——`scp`

`scp`（*secure copy*）的用法和 `cp` 一样，只是其中一方可以在另一台计算机上。这一方写成 `HOST:PATH`：

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- 源在前，目标在后，和 `cp` 一样。
- 冒号后面的路径从你在服务器上的主目录算起，单独的 `srv:` 表示主目录。
- 复制目录需要 `-r`。
- 端口用大写的 `-P` 指定（`ssh` 用的是小写的 `-p`）。

对于每个文件，`scp` 都会显示一行，包含文件名、`100%`、大小和速度。

```quiz
你输入了 `scp report.txt srv`——没有冒号。会发生什么？
- [ ] 文件被复制到你在服务器上的主目录
- [x] 你得到一个名为 `srv` 的本地副本
- [ ] scp 会问你指的是哪台计算机
---
没有冒号，`srv` 就只是一个文件名，`scp` 会像 `cp` 一样在本地复制。冒号很容易忘记！
```

## 保持同步——`rsync`

对于大量文件，或者需要一次又一次复制的东西（备份！），`rsync` 更合适。它只复制缺少的或者发生了变化的内容：

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a`（*archive*）会递归复制目录，并保留权限和时间，`-v` 会列出复制了哪些内容。再运行一次同样的命令，列表就是空的——没有任何变化。rsync 会比较每个文件的大小和修改时间；不加 `-a` 的话，副本会得到新的时间，于是每次都会把所有内容重新发送一遍。

### 末尾的斜杠

源末尾的斜杠很重要：

| 命令 | 结果 |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...`——目录本身 |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...`——只有目录里面的内容 |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
没有斜杠时，目录本身被复制到了 `/tmp/x` 中。
```

### 通过 SSH 以及 `--delete`

当目标是服务器时，rsync 会通过 ssh 传输：

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` 还会删除目标中那些在源里已经不存在的文件，让目标成为一份完全相同的副本。这时一个写错的路径可能会删掉很多东西，所以先用 `-n`（*dry run*）试运行一下。这样什么都不会发生，rsync 只显示它将要做什么，最后一行以 `(DRY RUN)` 结尾：

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
在 `rsync -avn --delete a/ b/` 中，`-n` 的作用是什么？
- [ ] 只复制新文件
- [x] 显示将会发生什么，但不做任何操作
- [ ] 跳过那些将被删除的文件
---
`-n` 表示试运行。先检查列表——然后去掉 `-n` 再运行同样的命令。
```

## scp 还是 rsync？

| | `scp` | `rsync` |
|---|---|---|
| 适合 | 少量文件，复制一次 | 备份和反复复制 |
| 发送 | 每次都发送全部内容 | 只发送变化的部分 |
| 本地复制 | 可以，但 `cp` 更简单 | 可以 |
| 用 `--delete` 做镜像 | 不行 | 可以 |

`scp` 随 ssh 客户端一起提供。`rsync` 必须在两台计算机上都安装：Ubuntu、Debian 和 Fedora 一开始就带有它，而在 Arch 上需要安装 `rsync` 软件包。

在模拟器中，关闭应用后服务器会忘记它上面的文件。
