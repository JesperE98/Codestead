# 文件和目录

既然你已经能找到方向了，现在就来学习如何创建、复制、移动和删除东西吧。

## 创建目录——`mkdir`

```sh
mkdir pictures2
```

如果想一次创建多级目录，就需要 `-p`（*parents*，父目录）。如果没有它，当上级目录不存在时，`mkdir` 会报错：

```sh
mkdir -p trip/2026/june
```

## 创建空文件——`touch`

如果文件不存在，`touch` 会创建一个空文件（如果已存在，则只更新它的时间戳）：

```sh
touch shopping-list.txt
```

```quiz
如果文件 `{{notes}}` 已经存在，`touch {{notes}}` 会做什么？
- [ ] 清空文件
- [ ] 报错说文件已存在
- [x] 只更新文件的时间戳——内容保持不变
```

## 复制——`cp`

```sh
cp {{notes}} notes-copy.txt
```

如果目标是一个目录，副本会以相同的名字放进这个目录里。要复制整个目录，需要使用 `-r`（*recursive*，递归）：

```sh
cp -r {{documents}} {{documents}}-backup
```

```predict
$ mkdir copies
$ cp {{notes}} copies
$ ls copies
{{notes}}
---
`copies` 是一个目录，所以副本会以相同的名字放进这个目录里。
```

## 移动和重命名——`mv`

在 Linux 中，*移动*和*重命名*是同一回事。`mv` 两件事都能做：

```sh
mv shopping-list.txt {{documents}}/
mv {{documents}}/shopping-list.txt {{documents}}/shopping.txt
```

```quiz
不存在名为 `b.txt` 的文件。`mv a.txt b.txt` 会做什么？
- [ ] 把 `a.txt` 复制为 `b.txt`
- [x] 把 `a.txt` 重命名为 `b.txt`
- [ ] 失败，因为 `b.txt` 不存在
---
移动和重命名是同一回事。执行之后只剩下 `b.txt`。
```

## 删除——`rm` 和 `rmdir`

```sh
rm notes-copy.txt
```

`rmdir` 用来删除*空*目录。要删除一个目录以及其中的所有内容，请使用 `rm -r`：

```sh
rm -r {{documents}}-backup
```

> **警告！** 终端里没有回收站。用 `rm` 删除的东西就永远消失了。命令 `rm -rf`（*recursive, force*，递归、强制）既不会询问，也从不报错——在按下 Enter 之前，一定要再检查一遍路径。

```quiz
哪个命令*只在*目录 `{{old}}` 为空时才删除它？
- [ ] `rm {{old}}`
- [x] `rmdir {{old}}`
- [ ] `rm -r {{old}}`
---
`rmdir` 拒绝删除里面还有东西的目录。`rm -r` 会删除目录以及其中的所有内容。
```

## 通配符

在命令运行之前，shell 可以把模式展开成多个文件名：

| 模式 | 匹配 |
|---|---|
| `*` | 任意内容（零个或多个字符） |
| `?` | 恰好一个字符 |
| `[abc]` | 字符 a、b 或 c 中的一个 |

你主目录下的 `{{documents}}` 目录里有三个文件：`{{fruits}}`、`{{grades}}` 和 `server.log`。下面的命令只列出以 `.txt` 结尾的文件：

```sh
ls {{documents}}/*.txt
```

```text
{{documents}}/{{fruits}}
```

在这里，`ls` 根本看不到星号——shell 已经把 `{{documents}}/*.txt` 替换成了所有匹配的文件名。

```predict
$ ls {{documents}}/?e????.*
{{documents}}/server.log
---
每个 `?` 恰好代表一个字符，所以点号前面的名字必须正好是六个字符，而且第二个字符是 `e`。只有 `server` 符合。
```

## 文件名中的空格

shell 会按空格拆分命令行。如果文件名中有空格，就必须使用引号（或者在空格前加一个 `\`）：

```sh
touch "my file.txt"
ls -l "my file.txt"
```

正因如此，很多人更喜欢在文件名中使用连字符或下划线。
