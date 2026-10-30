# 文件和目录

既然你已经能找到方向了，现在就来学习如何创建、复制、移动和删除东西吧。

## 创建目录——`mkdir`

```sh
mkdir bilder2
```

如果想一次创建多级目录，就需要 `-p`（*parents*，父目录）。如果没有它，当上级目录不存在时，`mkdir` 会报错：

```sh
mkdir -p resa/2026/juni
```

## 创建空文件——`touch`

如果文件不存在，`touch` 会创建一个空文件（如果已存在，则只更新它的时间戳）：

```sh
touch inkopslista.txt
```

## 复制——`cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

如果目标是一个目录，副本会以相同的名字放进这个目录里。要复制整个目录，需要使用 `-r`（*recursive*，递归）：

```sh
cp -r dokument dokument-backup
```

## 移动和重命名——`mv`

在 Linux 中，*移动*和*重命名*是同一回事。`mv` 两件事都能做：

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

## 删除——`rm` 和 `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` 用来删除*空*目录。要删除一个目录以及其中的所有内容，请使用 `rm -r`：

```sh
rm -r dokument-backup
```

> **警告！** 终端里没有回收站。用 `rm` 删除的东西就永远消失了。命令 `rm -rf`（*recursive, force*，递归、强制）既不会询问，也从不报错——在按下 Enter 之前，一定要再检查一遍路径。

## 通配符

在命令运行之前，shell 可以把模式展开成多个文件名：

| 模式 | 匹配 |
|---|---|
| `*` | 任意内容（零个或多个字符） |
| `?` | 恰好一个字符 |
| `[abc]` | 字符 a、b 或 c 中的一个 |

```sh
ls dokument/*.txt
```

在这里，`ls` 根本看不到星号——shell 已经把 `dokument/*.txt` 替换成了所有匹配的文件名。

## 文件名中的空格

shell 会按空格拆分命令行。如果文件名中有空格，就必须使用引号（或者在空格前加一个 `\`）：

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

正因如此，很多人更喜欢在文件名中使用连字符或下划线。
