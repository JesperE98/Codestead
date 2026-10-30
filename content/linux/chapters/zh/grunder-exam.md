# 测验：基础知识

回答下面的问题，展示你在这一部分学到了什么。

```quiz
下面哪个路径是**绝对**路径？
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `dokument`
---
绝对路径以 `/` 开头，从根目录出发。其他几个都从你当前所在的目录出发。
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
每个 `..` 向上一级：从 `/var/log` 到 `/var`，再到 `/`。
```

```quiz
`cd -` 有什么作用？
- [ ] 向上一级
- [ ] 回到你的主目录
- [x] 回到你上一次所在的目录
```

```quiz
你想把整个 `bilder` 目录连同其中的所有内容复制到 `bilder-kopia`。哪条命令可以做到？
- [ ] `cp bilder bilder-kopia`
- [x] `cp -r bilder bilder-kopia`
- [ ] `mv bilder bilder-kopia`
---
复制目录要用 `-r`（*recursive*，递归）。`mv` 会移动它，而不是复制。
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` 一次性创建 `a`、`a/b` 和 `a/b/c`，所以 `a/b` 里有 `c`。
```

```quiz
你输入 `touch min fil.txt`——没有加引号。会发生什么？
- [ ] 创建一个名为 `min fil.txt` 的文件
- [x] 创建两个文件：`min` 和 `fil.txt`
- [ ] 什么也不会发生，因为名字里有空格
---
shell 会在空格处拆分这一行，所以 `touch` 收到两个参数。写成
`touch "min fil.txt"` 才能得到一个文件。
```

```quiz
`grep -i error dokument/server.log` 会显示哪些行？
- [ ] 只显示小写 `error` 的行
- [ ] 只显示大写 `ERROR` 的行
- [x] 显示含有 `error` 的行，不论大小写如何组合
```

```quiz
你想盯着一个日志文件，看到写入的新行。哪条命令合适？
- [ ] `head -n 10 dokument/server.log`
- [x] `tail -f dokument/server.log`
- [ ] `wc -l dokument/server.log`
---
`tail -f` 会*跟踪*（follow）这个文件。按 **Ctrl+C** 停止。
```

```quiz
给 `wc` 一个文件且不加任何选项时，它会输出什么？
- [ ] 只有行数
- [x] 行数、单词数和字节数
- [ ] 文件的前 10 行
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` 追加了 `b`，但最后的 `>` 覆盖了整个文件。
```

```quiz
在 `a || b` 中，`b` 什么时候运行？
- [ ] 总是在 `a` 之后运行
- [ ] 只在 `a` 成功时
- [x] 只在 `a` 失败时
```

```try
grep ERROR ~/dokument/server.log | tee fel.txt | wc -l
---
`tee` 把错误行保存到 `fel.txt`，并把它们继续传给 `wc -l`，由它来计数。
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` 把逗号设为分隔符，`-f2` 保留第 2 个字段。
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` 是这一行的字段数。字段之间用空格分隔。
```

```quiz
为什么像 `'{print $3}'` 这样的 awk 程序要用**单**引号括起来？
- [ ] awk 读不了双引号
- [x] 否则 shell 会把 `$3` 当成 shell 变量，在 awk 启动之前就把它替换掉
- [ ] 单引号能让 awk 运行得更快
```
