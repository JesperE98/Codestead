# 总结：系统

在这一部分中，你了解了命令周围发生的事情：shell 的记忆、谁可以做什么、哪些程序正在运行，以及文件是如何打包在一起的。

## 变量、PATH 和别名

用 `$NAME` 读取变量，用 `NAME=value` 创建变量——`=` 两边不能有空格。`export` 把它变成环境变量，你启动的程序也能读取它。在双引号中，变量会被替换成它的值；在单引号中，所有内容都会原样打印出来。shell 在 `PATH` 中的目录里查找命令，而 `$?` 保存着最近一条命令的退出码：`0` 表示一切顺利。别名和变量会在关闭终端时消失，除非你把它们写进 `~/.bashrc`。

## 用户、权限和 sudo

每个文件都有一个所有者、一个所属组和三组权限——分别对应所有者、所属组和其他人。`r` = 4，`w` = 2，`x` = 1，所以 `755` 就是 `rwxr-xr-x`，`600` 就是 `rw-------`。脚本需要 `x` 权限，并且要用 `./` 来运行，因为你当前所在的目录不在 `PATH` 中。`sudo` 以 root 身份运行单条命令，并要求输入你自己的密码。在 Ubuntu 上，`sudo` 组中的用户可以使用它。

## 链接和文件信息

文件的内容和权限保存在 **inode** 中，目录中的名字指向 inode。`ln -s` 创建**符号链接**——一个保存路径的小文件，如果目标消失，它就会失效；其中的相对路径从链接自己所在的目录算起。不加 `-s` 的 `ln` 创建**硬链接**——同一个 inode 的又一个名字。`stat` 显示一个文件的一切，`file` 不管文件叫什么名字，都能告诉你它包含什么，而 **umask** 决定新文件的权限：`022` 时新文件得到 `644`，`077` 时只有 `600`。

## 进程和作业

每个正在运行的程序都是一个进程，它有一个 PID 和一个父进程（PPID）。`ps aux` 显示所有进程，`top` 则实时显示它们，并按处理器占用排序。`kill` 发送一个信号：默认是 `SIGTERM`（15），`SIGKILL`（9）则是最后的手段。加上 `&`，命令就会在后台运行，而 `jobs`、`fg` 和 `bg` 让你可以管理终端中的作业。`nohup` 让命令在你退出登录后继续运行，`watch` 则一遍又一遍地运行某个命令。

## 归档和压缩

`tar` 把文件收集到一个归档文件中，`gzip` 让单个文件变小——两者结合就得到了 `.tar.gz`。`c`、`x` 和 `t` 中有且只有一个告诉 tar 要做什么，`f` 后面跟着归档文件的名字。`zcat` 无需解压就能读取 `.gz` 文件，而 `zip -r` / `unzip` 处理 zip 文件，便于与 Windows 和 macOS 共享。

## 命令和选项

| 命令 | 作用 |
|---|---|
| `echo $NAME` | 显示变量的值 |
| `export NAME=value` | 创建环境变量 |
| `env` | 列出所有环境变量 |
| `which ls` · `type cd` | 显示程序在哪里 · 一个名字到底是什么 |
| `echo $?` | 显示上一条命令的退出码 |
| `alias ll='ls -la'` · `unalias ll` | 创建 · 删除别名 |
| `source ~/.bashrc` | 立即加载 `~/.bashrc` |
| `id` · `groups` | 显示你的用户和所属的组 |
| `ls -l` | 显示权限、所有者和所属组 |
| `chmod 644 file` · `chmod u+x file` | 用数字 · 符号修改权限 |
| `sudo command` · `sudo -i` | 以 root 身份运行命令 · 启动 root shell |
| `sudo tee -a file` | 放在管道末尾：向只有 root 能修改的文件追加文本 |
| `ln -s target name` · `ln file name` | 创建符号链接 · 硬链接 |
| `readlink link` · `realpath path` | 链接指向哪里 · 不含链接的完整路径 |
| `ls -li` | 显示 inode 编号和链接计数 |
| `stat file` · `stat -c '%a %U' file` | 文件的一切 · 只显示你要的内容 |
| `file file` | 文件包含什么 |
| `umask` · `umask 077` | 显示 · 设置新文件要去掉的权限 |
| `ps` · `ps aux` · `ps -ef` | 你的进程 · 所有进程 · 带父进程 PID |
| `ps aux --sort=-%cpu` | 所有进程，占用最多的排在最前面 |
| `pgrep -l name` | 按名字查找进程的 PID |
| `top` | 进程的实时视图 |
| `kill PID` · `kill -9 PID` | 请求进程退出 · 强制停止 |
| `pkill pattern` · `killall name` | 按名字停止进程 |
| `command &` | 在后台运行命令 |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | 列出 · 调到前台 · 放到后台 · 结束作业 |
| `nohup command &` | 退出登录后继续运行 |
| `watch -n 5 command` | 每五秒运行一次命令 |
| `uptime` · `free -h` | 负载 · 内存 |
| `tar -czvf archive.tar.gz dir` | 打包并压缩一个目录 |
| `tar -tzvf archive.tar.gz` | 列出归档文件的内容 |
| `tar -xzvf archive.tar.gz -C dir` | 把归档文件解包到某个目录 |
| `gzip file` · `gzip -k file` · `gunzip file.gz` | 压缩 · 保留原文件 · 解压 |
| `zcat file.gz` | 直接读取压缩文件 |
| `zip -r archive.zip dir` · `unzip archive.zip -d dir` | 创建 · 解包 zip 文件 |
| `du -sh dir` | 查看某样东西占用了多少空间 |
