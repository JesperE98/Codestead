# 测验：系统

回答关于变量、权限、进程和归档的问题——需要答对 80% 才能通过。

```predict
$ echo "$HOME" '$USER'
/home/{{user}} $USER
---
双引号会把变量替换成它的值；单引号则按原样输出。
```

```quiz
`export` 对变量做了什么？
- [ ] 把它保存到 `~/.bashrc`
- [x] 把它变成环境变量，让你启动的程序也能读取它
- [ ] 删除它
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
`ls` 运行顺利，所以退出码是 `0`。输出本身则消失在了 `/dev/null` 中。
```

```quiz
哪个数字表示权限 `rwxr-x---`？
- [ ] `755`
- [x] `750`
- [ ] `640`
---
所有者：4 + 2 + 1 = 7。组：4 + 1 = 5。其他人：0。
```

```predict
$ touch tools.sh
$ chmod 755 tools.sh
$ chmod go-x tools.sh
$ ls -l tools.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
在 Ubuntu 上，哪个组的成员可以使用 `sudo`？
- [x] `sudo`
- [ ] `root`
- [ ] `{{user}}`
```

```quiz
`sudo -i` 有什么作用？
- [ ] 显示有关 sudo 的信息
- [x] 启动一个 root shell，提示符变为 `#`，直到你输入 `exit`
- [ ] 以 root 身份再次运行上一条命令
```

```quiz
在 `ps aux` 中，某个进程的 `STAT` 列是 `R`。这是什么意思？
- [x] 它正在运行
- [ ] 它正在休眠
- [ ] 它属于 root
```

```quiz
哪个变量保存着最近一个后台作业的 PID？
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
你对一个属于 root 的进程执行 `kill 812`，结果得到
`Operation not permitted`。你该怎么做？
- [ ] 改用 `kill -9 812`
- [x] 用 `sudo` 运行：`sudo kill 812`
- [ ] 什么也做不了——root 的进程永远无法停止
```

```quiz
`pkill` 和 `killall` 有什么区别？
- [x] `pkill` 匹配一个模式，`killall` 需要准确的名字
- [ ] `pkill` 发送 `SIGKILL`，`killall` 发送 `SIGTERM`
- [ ] 没有区别——它们是同一个程序
```

```quiz
`tar -cvf {{documents}} {{documents}}.tar` 有什么问题？
- [ ] `-v` 不能和 `-c` 一起用
- [x] 顺序不对：归档文件的名字必须紧跟在 `f` 后面，放在要打包的文件之前
- [ ] tar 归档必须以 `.tgz` 结尾
```

```predict
$ cp {{documents}}/{{fruits}} .
$ gzip {{fruits}}
$ gunzip {{fruits}}.gz
$ ls {{fruits}}*
{{fruits}}
```

```quiz
`zcat server.log.gz` 有什么作用？
- [x] 输出解压后的内容，而 `server.log.gz` 保持不变
- [ ] 把文件解压为 `server.log`
- [ ] 把文件再压缩一次
---
`zcat` 等同于 `gzip -dc`：解压到标准输出。
```

```try
du -sh {{documents}}
---
`-s` 给出整个目录的总计，`-h` 让大小更易读。
```
