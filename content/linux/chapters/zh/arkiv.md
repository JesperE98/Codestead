# 归档和压缩

迟早有一天，你会想把整个目录发给别人、做一份备份，或者下载某个程序的源代码。这时就需要把大量文件变成**一个**文件——最好还能更小一些。在 Linux 上，这通常由两个不同的程序配合完成。

## 归档和压缩——两回事

- **归档**是指把许多文件和目录收集到一个文件中，也就是*归档文件*（archive）。权限、所有者和时间戳也会一并保存。这个程序叫做 `tar`（来自 *tape archive*，磁带归档——它是在 20 世纪 70 年代为磁带机编写的）。归档文件**并不会**比其中的文件更小——如果说有什么变化的话，它反而更大。
- **压缩**是指通过更巧妙地编码重复内容，让文件变得更小。最常用的程序是 `gzip`。它一次只能处理一个文件，对目录一无所知。

所以它们总是一起使用：先用 `tar` 得到单个文件，再用 `gzip` 把它变小。结果的扩展名是 `.tar.gz`，简写为 `.tgz`。这就是 Unix 哲学的精髓——每个小程序只做一件事，并且可以相互组合。

```quiz
为什么 `tar` 和 `gzip` 通常一起使用？
- [ ] `gzip` 无法读取不是由 `tar` 创建的文件
- [x] `tar` 把许多文件收集成一个，而 `gzip` 让这一个文件变小
- [ ] `tar` 让文件变小，而 `gzip` 给它们设置正确的权限
---
gzip 一次只能处理一个文件，对目录一无所知；而单独的 tar 归档文件并不会比其中的文件更小。
```

| 文件扩展名 | 是什么？ | 解包方式 |
|---|---|---|
| `.tar` | 未压缩的归档文件 | `tar -xf` |
| `.gz` | 单个压缩文件 | `gunzip` |
| `.tar.gz`、`.tgz` | 压缩的归档文件 | `tar -xzf` |
| `.zip` | 归档和压缩合二为一（在 Windows 上很常见） | `unzip` |

你还会遇到 `.tar.xz`、`.tar.bz2` 和 `.tar.zst`。思路相同，只是使用了其他压缩程序（`xz`、`bzip2` 和 `zstd`）。

## 用 `tar` 打包

进入你的主目录，把 `dokument` 目录打包：

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/betyg.csv
dokument/frukter.txt
dokument/server.log
```

`-c` 表示*创建归档*（create），`-v` 让 tar 显示它正在做什么，`-f` 表示接下来是归档文件的名字。归档文件名之后的所有内容都会被打包——文件和目录想放多少都可以。

> **注意！** 顺序是*先写归档文件名，再写要打包的文件*。如果你把顺序弄反了，比如写成 `tar -cvf dokument dokument.tar`，tar 会试图覆盖这个目录——或者更糟，覆盖一个你本想保留的文件。

## 需要记住的选项

| 选项 | 代表 | 含义 |
|---|---|---|
| `c` | **c**reate | 创建新的归档文件 |
| `x` | e**x**tract | 解包 |
| `t` | lis**t**（*table of contents*） | 列出内容 |
| `v` | **v**erbose | 显示正在处理的文件 |
| `f` | **f**ile | 接下来是归档文件的名字 |
| `z` | g**z**ip | 用 gzip 压缩或解压 |

`c`、`x` 和 `t` 中必须有且只有**一个**——它告诉 tar *要做什么*。其余的都是修饰选项。一个常用的记忆方法：

- **c**reate **z**ipped **v**erbose **f**ile（创建、压缩、详细、文件）→ `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile（解包、压缩、详细、文件）→ `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile（列出、压缩、详细、文件）→ `tar -tzvf`

把选项写在一起时，一定要把 `f` 放在**最后**，因为文件名必须紧跟在它后面。由于历史原因，你也可以省略短横线：`tar czvf` 与 `tar -czvf` 的意思相同。

```quiz
`tar -xzvf backup.tar.gz` 会做什么？
- [ ] 创建压缩归档文件 `backup.tar.gz`
- [ ] 列出 `backup.tar.gz` 的内容，但不解包
- [x] 用 gzip 解包 `backup.tar.gz`，并显示每个文件
---
`x` 是要执行的操作（解包），`z` 表示 gzip，`v` 显示文件，`f` 后面跟着归档文件的名字。
```

## 用 `-z` 压缩

加上 `z`，归档文件就会在生成过程中经过 gzip 处理：

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   837 Oct 30 12:00 dokument.tar.gz
```

未压缩的归档文件足足有 10,240 字节，而里面的文件加起来才刚过 1,000 字节。这是因为 tar 会在每个文件前加上一个 512 字节的头部，并把归档文件填充到完整的块大小。所有这些空白都会被 gzip 压缩掉。

`du` 命令（*disk usage*，磁盘用量）显示某样东西在磁盘上占用了多少空间。加上 `-h` 可以得到易读的大小，加上 `-s` 则显示整个目录的总计：

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
16K	dokument
```

磁盘被划分为 4 KiB 大小的块，所以对于非空文件，`du` 显示的值永远不会小于 `4.0K`。要查看确切的大小，请使用 `ls -l`（或 `ls -lh`）。

## 解包前先看看归档文件里有什么

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev       146 2026-10-30 12:00 dokument/betyg.csv
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

加上 `v` 后，内容会像 `ls -l` 那样显示，包括权限、所有者和大小。先看一眼是个好习惯：有些归档文件没有共同的顶层目录，解包时会把几百个文件撒得到处都是——就撒在你当时所在的目录里。

## 解包

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C`（大写 C）用来选择 tar 解包到哪个目录（*uppackat* 的意思是“已解包”）。如果不加，所有内容都会解包到你当前所在的目录。新版本的 tar 在解包时会自动检测归档文件是否经过压缩，所以 `tar -xf dokument.tar.gz` 也能正常工作。

> **警告！** tar 在覆盖已存在的文件之前不会询问。如果不确定，请先列出内容。

### 绝对路径

如果你打包的是绝对路径，开头的 `/` 会被去掉，这样归档文件就可以解包到任何地方：

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

现在归档文件中包含的是 `home/elev/dokument/...`。如果你只想让归档文件中包含 `dokument/`，可以用 `-C` 让 tar 先切换目录：

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

```quiz
你运行 `tar -czf backup.tar.gz -C ~ dokument`。归档文件中包含什么？
- [x] `dokument/` 及其中的文件
- [ ] `home/elev/dokument/` 及其中的文件
- [ ] `/home/elev/dokument/` 及其中的文件
---
`-C ~` 让 tar 先切换到你的主目录，所以归档文件中的名字从 `dokument/` 开始。
```

## 用 `gzip` 压缩单个文件

`gzip` 会压缩一个文件，并用 `.gz` 文件**替换**它。权限和时间戳会保留下来：

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` 显示压缩前后的大小，`gunzip` 则把文件重新解压：

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

如果想保留原文件，请使用 `gzip -k`（*keep*，保留）。用一个非常小的文件试试——它实际上会变得**更大**，因为 gzip 会添加一个头部，其中包含文件名等信息：

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

```predict
$ cp dokument/frukter.txt .
$ cp dokument/server.log .
$ gzip frukter.txt
$ gzip -k server.log
$ ls frukter* server*
frukter.txt.gz  server.log  server.log.gz
---
普通的 `gzip` 会用 `.gz` 文件替换原文件；`-k` 则会保留原文件。
```

### 直接读取压缩文件

为了节省空间，`/var/log` 中的旧日志文件通常以 `.gz` 格式保存。用 `zcat` 可以在不解压的情况下读取它们——而且结果可以像往常一样通过管道继续传递：

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` 等同于 `gzip -dc`：解压（`d`）到标准输出（`c`）。在真实的系统上，还有 `zless` 和 `zgrep`。

## zip——与 Windows 用户共享

`.zip` 格式同时完成两项工作：它既收集文件，*又*压缩文件。Windows 和 macOS 无需额外软件就能打开 zip 文件，所以当你要把文件发给不用 Linux 的人时，它是理所当然的选择。在 Linux 世界里，`.tar.gz` 更常见，因为它能更好地保留所有者和权限信息。

`zip` 和 `unzip` 这两个程序并不总是预装的，在这个终端里你必须先安装它们。这要用包管理器来完成——在关于发行版和软件包的部分中，你会学到有关它的一切。在 Ubuntu 上，你可以这样做：

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` 会下载可用软件包的列表。如果不先运行它，apt 根本找不到任何软件包。

然后把目录打包。别忘了 `-r`（*recursive*，递归）——如果不加，zip 只会添加空目录，而不会添加其中的文件：

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/betyg.csv (deflated 17%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

注意，顺序和 tar 一样：先写归档文件名，再写要打包的文件。`unzip -l` 列出内容，`-d` 用来选择解包到哪里（如果该目录不存在，就会自动创建）：

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

如果文件已经存在，unzip 会跳过它们。使用 `unzip -o` 则会覆盖它们。

```quiz
你运行了不带 `-r` 的 `zip dokument.zip dokument`。zip 文件里会有什么？
- [ ] `dokument` 中的所有文件
- [x] 只有空目录 `dokument/`
- [ ] 什么都没有——zip 拒绝运行
---
不加 `-r`（*recursive*，递归），zip 就不会进入目录。
```

## 小结

| 如果你想…… | 命令 |
|---|---|
| 打包并压缩一个目录 | `tar -czvf archive.tar.gz directory` |
| 查看归档文件中包含什么 | `tar -tzvf archive.tar.gz` |
| 解包归档文件 | `tar -xzvf archive.tar.gz`（加上 `-C directory`） |
| 压缩一个文件 | `gzip file`（或 `gzip -k file`） |
| 解压 `.gz` 文件 | `gunzip file.gz` |
| 直接读取 `.gz` 文件 | `zcat file.gz` |
| 创建或解包 zip 文件 | `zip -r archive.zip directory` · `unzip archive.zip` |
| 查看某样东西有多大 | `du -sh directory` · `ls -lh` |
