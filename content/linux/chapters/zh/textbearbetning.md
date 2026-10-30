# 用 sed、tr 和 awk 处理文本

用 `grep` 你可以*找到*行。但很多时候你想做的不止这些：替换一个单词、删除某些行、挑出一列，或者把一些数字加起来。这时就该请出三个经典工具了：

| 工具 | 处理对象 | 典型用途 |
|---|---|---|
| `tr` | 单个**字符** | 转换成大写、把 `:` 变成换行符 |
| `sed` | **行** | 替换单词、删除行 |
| `awk` | **列**（字段） | 挑出列、求和、计数 |

这三个工具都是*过滤器*（filter）：它们读取文本，对其进行处理，然后把结果写到 stdout。这让它们非常适合与管道搭配使用。而且原始文件**不会**被修改（只有一个例外：`sed -i`，我们稍后会讲到）。

`dokument` 中有第三个练习文件，这是一个记录学生分数的 CSV 文件（*namn* = 姓名，*ämne* = 科目，*poäng* = 分数）：

```sh
cat ~/dokument/betyg.csv
```

CSV 是 *comma-separated values*（逗号分隔值）的缩写——各列之间用逗号分隔，第一行是表头。

## 转换字符——`tr`

`tr`（*translate*，转换）会把第一个集合中的每个字符替换成第二个集合中相同位置的字符。`a-z` 表示从 a 到 z 的所有字母：

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

注意到那个 é 了吗？`tr` 处理的是单个*字节*，而像 é 这样的字母——或者瑞典语中的 å、ä 和 ö——并不在 `a-z` 的范围内。这一点值得记住——GNU `awk`（后面会讲到）处理得更好。

`tr` **只**从 stdin 读取，从不读取文件。如果你想处理一个文件，可以用 `<` 或管道把它送进去：

```sh
tr a-z A-Z < ~/dokument/frukter.txt
```

一个经典技巧是把冒号转换成换行符（`\n`），这样 `PATH` 中的每个目录就各占一行了：

```sh
echo $PATH | tr ':' '\n'
```

用 `-d`（*delete*，删除）可以删除字符，用 `-s`（*squeeze*，压缩）可以把连续出现的多个相同字符压缩成一个：

```sh
echo "070-123 45 67" | tr -d ' -'
echo "too     many      spaces" | tr -s ' '
```

```predict
$ echo "hello world" | tr -d o
hell wrld
---
`-d` 会删除每一个 `o`，无论它在哪里。
```

除了范围，你还可以使用*字符类*，例如 `[:upper:]`（大写字母）、`[:lower:]`（小写字母）、`[:digit:]`（数字）和 `[:space:]`（空白字符）：

```sh
echo "Room 101, floor 3" | tr -d '[:digit:]'
```

## 流编辑器——`sed`

`sed`（*stream editor*，流编辑器）逐行读取文本，并对每一行运行一个小*脚本*。最常用的命令是 `s`——*substitute*（替换）。

### 替换文本——`s`

```sh
sed 's/ERROR/FEL/' ~/dokument/server.log
```

脚本 `s/ERROR/FEL/` 的意思是：把 `ERROR` 替换成 `FEL`（瑞典语的“错误”）。它的格式是

```text
s/PATTERN/REPLACEMENT/FLAGS
```

不加标志时，每行只替换**第一个**匹配项。加上 `g`（*global*，全局）后，所有匹配项都会被替换：

```sh
echo "cat cat cat" | sed 's/cat/dog/'
echo "cat cat cat" | sed 's/cat/dog/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
不加 `g` 时，只有该行中的第一个 `a` 会被替换。
```

`i` 标志让搜索不区分大小写，就像 `grep -i` 一样：

```sh
sed 's/warn/WARNING/i' ~/dokument/server.log
```

模式是一个*正则表达式*，和 `grep` 中的一样。下面我们删除每行开头的日期（`^` = 行首，`[0-9-]*` = 数字和连字符）：

```sh
sed 's/^[0-9-]* //' ~/dokument/server.log
```

在替换文本中，`&` 表示“匹配到的内容”：

```sh
echo "Linux is fun" | sed 's/Linux/**&**/'
```

**换一个分隔符。** 如果文本本身包含斜杠，就会变得很乱：`s/\/usr\/local/\/opt/`。不过紧跟在 `s` 后面的字符决定了分隔符，所以你完全可以改用 `|` 或 `#`：

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**分组。** 使用 `-E`（扩展正则表达式），你可以用圆括号捕获匹配内容的一部分，并在替换文本中以 `\1`、`\2` …… 的形式使用它们。下面我们把日期的顺序颠倒过来：

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/dokument/server.log
```

### 选择行——地址

在命令前面，你可以写一个*地址*（address），用来选择命令作用于哪些行。`d` 命令（*delete*，删除）删除行，`p` 命令（*print*，打印）打印行：

```sh
sed '/INFO/d' ~/dokument/server.log
sed '1d' ~/dokument/betyg.csv
```

第一条命令删除所有包含 `INFO` 的行，第二条删除第 1 行——也就是表头。

`sed` 默认会打印*每一*行。加上 `-n` 后它就不再这样做，只打印 `p` 要求打印的内容。下面是显示第 5 到第 8 行的方法：

```sh
sed -n '5,8p' ~/dokument/server.log
```

| 地址 | 含义 |
|---|---|
| `5` | 第 5 行 |
| `$` | 最后一行 |
| `/ERROR/` | 匹配该模式的行 |
| `2,4` | 第 2 到第 4 行 |
| `/WARN/,/ERROR/` | 从包含 WARN 的行到下一个包含 ERROR 的行 |
| `/INFO/!` | **除了**匹配行以外的所有行 |

地址适用于所有命令，包括 `s`。下面只有错误行会被标记出来：

```sh
sed '/ERROR/s/^/>>> /' ~/dokument/server.log
```

`q` 命令（*quit*，退出）在指定的行之后停止——所以 `sed 3q` 的效果和 `head -n 3` 相同。多个命令之间可以用 `;` 分隔，也可以使用多个 `-e`：

```sh
sed -e '/INFO/d' -e 's/ERROR/FEL/' ~/dokument/server.log
```

### 直接修改文件——`sed -i`

到目前为止，所有结果都只是被*打印*出来，文件本身并没有改变——你可以用 `cat` 检查一下。使用 `-i`（*in-place*，就地修改），`sed` 会把结果写回文件。先在副本上试试：

```sh
cp ~/dokument/frukter.txt ~/frukter-kopia.txt
sed -i 's/kiwi/kiwifruit/' ~/frukter-kopia.txt
cat ~/frukter-kopia.txt
```

`sed -i` 没有撤销功能。一个好的做法是先**不加** `-i` 运行命令，看看结果，确认无误后再加上 `-i`。如果你写成 `-i.bak`，原文件还会另存为 `file.bak`。

```quiz
你运行 `sed 's/kiwi/KIWI/' ~/dokument/frukter.txt`。文件会发生什么变化？
- [ ] 文件中的每个 `kiwi` 都变成 `KIWI`
- [ ] 只有文件中的第一个 `kiwi` 变成 `KIWI`
- [x] 什么都不会发生——结果只是被打印出来，文件保持不变
---
不加 `-i` 时，`sed` 只会写到 stdout。文件保持原样。
```

`/etc` 中的配置文件属于 root，所以在那里你需要使用 `sudo sed -i ...`。这是在脚本中修改设置、而无需打开文本编辑器的常用方法。

## 截取字段——`cut`

当一个文件由字段组成、字段之间有分隔符时，`cut` 可以挑出其中一个字段。`-d` 选择分隔符（*delimiter*），`-f` 选择要保留哪个字段。下面是 CSV 文件中的科目——第 2 个字段：

```sh
cut -d, -f2 ~/dokument/betyg.csv
```

在 `/etc/passwd` 中，字段之间用冒号分隔，第 1 个字段是用户名，所以 `cut -d: -f1 /etc/passwd` 会列出所有用户。和其他过滤器一样，`cut` 也适合放在管道中——例如放在 `tr` 前面。

## 列——`awk`

`awk` 其实是一门完整的小型编程语言，但大多数时候它只用来做一件事：处理**列**。awk 会把每一行拆分成*字段*（field）：

| 字段 | 含义 |
|---|---|
| `$1`、`$2` … | 第一个、第二个……字段 |
| `$0` | 整行 |
| `NF` | 该行的字段数（*number of fields*） |
| `$NF` | 最后一个字段 |
| `NR` | 行号（*number of record*） |

默认情况下，字段之间用空格（任意数量）分隔。在 `server.log` 中，第 3 个字段是日志级别：

```sh
awk '{print $3}' ~/dokument/server.log
```

程序写在 `{ }` 里，并对每一行运行一次。一定要把 awk 程序放在**单**引号中——否则 shell 会以为 `$3` 是一个 shell 变量，在 awk 启动之前就把它替换掉。

awk 非常适合放在管道中使用。每个级别各有多少行？

```sh
awk '{print $3}' ~/dokument/server.log | sort | uniq -c
```

### 其他分隔符——`-F`

用 `-F` 可以选择字段分隔符。在 `/etc/passwd` 中，分隔符是冒号；第 1 个字段是用户名，第 7 个字段是 shell：

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

`print` 中的逗号在输出中会变成空格。如果不加逗号，字段就会紧挨在一起，这样你就可以在其中插入自己的文字：

```sh
awk -F: '{print $1 " uses " $7}' /etc/passwd
```

和上一节中的 `cut -d: -f1` 比较一下。区别在于 awk 可以调换字段的顺序、插入文字，还能处理连续的多个空格。

```predict
$ echo "Alva,matte,87" | awk -F, '{print $3, $1}'
87 Alva
---
`-F,` 在逗号处拆分这一行。awk 先打印第 3 个字段，再打印第 1 个字段，由于 `print` 中有逗号，它们之间会有一个空格。
```

### 模式——选择行

在 `{ }` 前面可以写一个*模式*（pattern）。这样程序就只对匹配的行运行。模式可以是正则表达式，就像在 `grep` 中一样：

```sh
awk '/ERROR/ {print $2}' ~/dokument/server.log
```

……也可以是一个条件。文本要放在双引号中：

```sh
awk -F, '$2 == "matte" {print $1, $3}' ~/dokument/betyg.csv
```

（*Matte* 是瑞典语的“数学”。）比较运算符写作 `==`、`!=`、`<`、`<=`、`>` 和 `>=`，条件可以用 `&&`（与）、`||`（或）和 `!`（非）组合起来。下面列出所有至少得了 90 分的学生（没有 `{ }` 时会打印整行）：

```sh
awk -F, '$3 >= 90' ~/dokument/betyg.csv
```

表头那一行是不是也出现了？在表头中，第 3 个字段是单词 `poäng`，而当一个值不是数字时，awk 会把它当作*文本*来比较——按字母顺序，`"poäng"` 排在 `"90"` 后面。用 `NR > 1` 可以跳过表头：

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/dokument/betyg.csv
```

试试你自己的模式——列出所有学习 *svenska*（瑞典语）的学生的名字：

```try
awk -F, '$2 == "svenska" {print $1}' ~/dokument/betyg.csv
```

### 计算——变量和 `END`

awk 中的变量不需要声明——它们的初始值是 0。`END { }` 块在最后一行**之后**运行一次。把两者结合起来，就能轻松地对一列求和：

```sh
awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv
```

`summa += $3` 的意思是“把第 3 个字段加到 summa 上”（*summa* 是瑞典语的“总和”）。如果同时统计行数（`antal++` 会让 *antal*，即计数，加 1），就可以算出平均值：

```sh
awk -F, 'NR > 1 {summa += $3; antal++} END {print "Average:", summa / antal}' ~/dokument/betyg.csv
```

还有 `BEGIN { }`，它在第一行**之前**运行——很适合用来输出标题。而用 `printf`，你可以精确地控制输出的格式：`%-8s` 表示在 8 个字符宽度内左对齐的文本，`%5d` 表示占 5 个字符宽度的整数。

```sh
awk -F, 'BEGIN {print "Student  Score"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/dokument/betyg.csv
```

awk 还有一些函数，例如 `length()`、`toupper()` 和 `tolower()`：

```sh
awk '{print toupper($0)}' ~/dokument/frukter.txt
```

仔细看看 `äpple` 和 `päron`。在这里的终端所运行的 Ubuntu 上，`awk` 默认是 **mawk**，一个小巧快速的变体。对于像这里这样的简单程序，你不会察觉到任何区别——不过 mawk 的 `toupper()` 不会转换 å、ä 和 ö。而 **GNU awk**（`gawk` 软件包）会转换，这一点与 `tr` 不同。各个发行版使用的 awk 不同，安装软件的方式也不同——这些内容会在关于发行版的那一章中讲到。

模拟器只支持 awk 语言的一部分——也就是这里讲到的内容，再加上一点点别的（`if`、循环和数组）。请参阅 `man awk`。

## 我该选哪个工具？

| 你想要…… | 使用 |
|---|---|
| 查找包含某些内容的行 | `grep` |
| 替换或删除单个字符 | `tr` |
| 替换单词或模式、删除行 | `sed` |
| 挑出列、比较数字、求和 | `awk` |

真正的威力来自把它们组合起来。在*不是* INFO 的那些行中，都有哪些级别——如果忽略大小写的话？

```sh
grep -v INFO ~/dokument/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
