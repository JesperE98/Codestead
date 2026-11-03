# 阅读和搜索文本

在 Linux 中，几乎一切都是文本：设置、日志、列表。因此有很多小工具专门用来阅读和搜索文本文件。你的主目录中有一个名为 `{{documents}}` 的目录，里面有一些可以用来练习的文件，其中包括水果清单 `{{fruits}}` 和一个虚构的 Web 服务器的日志 `server.log`。日志中的级别——`INFO`、`WARN` 和 `ERROR`——与真实日志中的一模一样。

## 显示文件——`cat` 和 `less`

`cat` 会打印整个文件：

```sh
cat {{documents}}/{{fruits}}
```

对于很长的文件，`less` 更好用。在 `less` 中，你可以用方向键和空格键滚动，用 `/word` 搜索单词，按 `q` 退出。

看看这份水果清单——下一个问题会用到它：

```try
cat {{documents}}/{{fruits}}
```

## 开头和结尾——`head` 和 `tail`

`head` 显示前几行，`tail` 显示最后几行。默认是 10 行，但你可以用 `-n` 指定行数：

```sh
head -n 5 {{documents}}/server.log
tail -n 3 {{documents}}/server.log
```

`tail -f` 会*跟踪*一个文件，在新行写入时立即显示出来——非常适合查看日志。按 **Ctrl+C** 停止。

```predict
$ tail -n 1 {{documents}}/{{fruits}}
芒果
---
`tail -n 1` 只显示最后一行。
```

## 计数——`wc`

`wc`（*word count*，字数统计）统计行数、单词数和字节数：

```sh
wc {{documents}}/{{fruits}}
```

通常你只需要行数：`wc -l`。

## 搜索——`grep`

`grep` 是最有用的命令之一。它会显示所有包含某个模式的行：

```sh
grep INFO {{documents}}/server.log
```

下面是一些你会经常用到的选项：

| 选项 | 含义 |
|---|---|
| `-i` | 忽略大小写的区别 |
| `-n` | 显示行号 |
| `-v` | 显示*不*匹配的行 |
| `-c` | 统计匹配的行数 |
| `-r` | 在目录中的所有文件里递归搜索 |
| `-E` | 扩展模式，例如 `"ERROR|WARN"` |

```sh
grep -n WARN {{documents}}/server.log
```

这里的模式是一个*正则表达式*（regular expression）。举几个例子：`^` 表示行首，`$` 表示行尾，所以 `grep "^2026"` 会找出以 2026 开头的行。

```quiz
`server.log` 中有两行包含 `WARN`，还有一行包含小写的 `warn`。`grep -c WARN {{documents}}/server.log` 会打印什么？
- [ ] 1
- [x] 2
- [ ] 3
---
`-c` 统计匹配的行数，而不加 `-i` 时大小写是有区别的。`grep -ic WARN` 会把这三行都算进去。
```

```quiz
哪个命令会显示 `server.log` 中所有**不**包含 `INFO` 的行？
- [ ] `grep -i INFO {{documents}}/server.log`
- [ ] `grep -c INFO {{documents}}/server.log`
- [x] `grep -v INFO {{documents}}/server.log`
```

## 排序——`sort` 和 `uniq`

`sort` 按字母顺序对行进行排序（`-n` 按数字排序，`-r` 逆序排列）。`uniq` 会删除与*紧邻的上一行*完全相同的行——这就是为什么它几乎总是跟在 `sort` 后面使用：

```sh
sort {{documents}}/{{fruits}}
```

```quiz
为什么 `uniq` 几乎总是跟在 `sort` 后面使用？
- [ ] `uniq` 只能处理排好序的文件，否则就会出错
- [x] `uniq` 只删除与紧邻的上一行完全相同的行，所以相同的行必须挨在一起
- [ ] `sort` 删除重复行，`uniq` 再把它们放回去
```

## 手册——`man`

忘了某个选项是做什么的？每个命令都有手册页：

```sh
man grep
```
