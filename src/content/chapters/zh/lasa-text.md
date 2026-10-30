# 阅读和搜索文本

在 Linux 中，几乎一切都是文本：设置、日志、列表。因此有很多小工具专门用来阅读和搜索文本文件。你的主目录中有一个名为 `dokument` 的目录，里面有两个可以用来练习的文件：`frukter.txt`（一份水果清单）和 `server.log`（一个虚构的 Web 服务器的日志）。它们的内容是瑞典语的，但你要搜索的词——`INFO`、`WARN` 和 `ERROR`——与真实日志中的一模一样。

## 显示文件——`cat` 和 `less`

`cat` 会打印整个文件：

```sh
cat dokument/frukter.txt
```

对于很长的文件，`less` 更好用。在 `less` 中，你可以用方向键和空格键滚动，用 `/word` 搜索单词，按 `q` 退出。

## 开头和结尾——`head` 和 `tail`

`head` 显示前几行，`tail` 显示最后几行。默认是 10 行，但你可以用 `-n` 指定行数：

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` 会*跟踪*一个文件，在新行写入时立即显示出来——非常适合查看日志。按 **Ctrl+C** 停止。

## 计数——`wc`

`wc`（*word count*，字数统计）统计行数、单词数和字节数：

```sh
wc dokument/frukter.txt
```

通常你只需要行数：`wc -l`。

## 搜索——`grep`

`grep` 是最有用的命令之一。它会显示所有包含某个模式的行：

```sh
grep INFO dokument/server.log
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
grep -n WARN dokument/server.log
```

这里的模式是一个*正则表达式*（regular expression）。举几个例子：`^` 表示行首，`$` 表示行尾，所以 `grep "^2026"` 会找出以 2026 开头的行。

## 排序——`sort` 和 `uniq`

`sort` 按字母顺序对行进行排序（`-n` 按数字排序，`-r` 逆序排列）。`uniq` 会删除与*紧邻的上一行*完全相同的行——这就是为什么它几乎总是跟在 `sort` 后面使用：

```sh
sort dokument/frukter.txt
```

## 手册——`man`

忘了某个选项是做什么的？每个命令都有手册页：

```sh
man grep
```
