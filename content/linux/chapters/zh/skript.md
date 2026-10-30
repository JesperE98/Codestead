# Shell 脚本

到目前为止你在终端里输入的所有内容，都可以保存到一个文件中，然后反复运行。这样的文件就叫做**脚本**（script）。脚本能帮你把枯燥的工作自动化：备份、给一百个文件重命名，或者每天早上检查日志。不仅如此，bash 还是一门真正的编程语言，拥有变量、条件、循环和函数。

## 第一个脚本

脚本就是一个普通的文本文件。在真实的计算机上，你会用 `nano` 或 `vim` 这样的文本编辑器来编写它。另一种方法是使用 **here document**（here 文档），它在这里和服务器上都能用：`<< 'SLUT'` 和 `SLUT` 那一行之间的所有内容都会被送进命令。（*Slut* 在瑞典语中就是“结束”的意思——你可以随意选择任何单词，`EOF` 是常见的选择。）

输入第一行并按 Enter。提示符会变成 `> `——shell 正在等待剩下的内容。逐行输入，最后以 `SLUT` 结束：

```sh
cat > hej.sh << 'SLUT'
#!/bin/bash
echo "Hello from a script!"
echo "Today is $(date)"
SLUT
```

第一行 `#!/bin/bash` 叫做 *shebang*，它告诉系统应该用哪个程序来运行这个文件。给脚本加上可执行权限，然后运行它：

```sh
chmod +x hej.sh
./hej.sh
```

以 `#` 开头的行（shebang 行除外）是**注释**，shell 会跳过它们。用注释来解释代码的作用吧！

## 变量

用 `name=value` 来创建变量。等号两边**不能**有空格——否则 shell 会以为 `name` 是一个命令。

```sh
stad=Göteborg
echo "I live in $stad"
```

（*Stad* 的意思是“城市”。）使用变量时，一定要把它放在**双引号**中。如果不加引号，变量的值会在空格处被拆开，当文件名中含有空格时就会导致奇怪的错误。如果你想在变量名后面紧接着写文本，请使用花括号：`"${stad}_2026"`——如果不加花括号，bash 会去找一个名为 `stad_2026` 的变量。

```quiz
`stad` 的值是 `Göteborg`，并且不存在名为 `stad_2026` 的变量。`echo "$stad_2026"` 会打印什么？
- [ ] `Göteborg_2026`
- [ ] `Göteborg`
- [x] 一个空行
---
bash 会把整个名字 `stad_2026` 读作变量名，而这个变量并不存在。写成 `"${stad}_2026"` 才能得到 `Göteborg_2026`。
```

## 命令替换——`$(...)`

`$(command)` 会被替换成该命令打印出的内容。这样就可以把命令的结果保存到变量中：

```sh
idag=$(date)
filer=$(ls ~ | wc -l)
echo "There are $filer items in your home directory"
```

## 算术运算——`$(( ))`

bash 在 `$(( ))` 中进行整数运算。在括号内，变量前面不需要加 `$`：

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) remainder $(( 17 % 5 ))
```

要修改变量的值，可以写 `(( a++ ))` 或 `(( a += 10 ))`。

```predict
$ echo $(( 7 / 2 )) $(( 7 % 2 ))
3 1
---
bash 只用整数计算：7 / 2 得 3，余数（`%`）是 1。
```

## 参数

当你运行 `./skript.sh one two` 时，脚本可以读取这些参数：

| 变量 | 内容 |
|---|---|
| `$0` | 脚本的名字 |
| `$1`、`$2` ... | 第一个、第二个……参数 |
| `$#` | 参数的个数 |
| `"$@"` | 所有参数，每个参数各自独立 |
| `$?` | 上一条命令的退出码 |

```quiz
用 `./skript.sh red green blue` 运行一个脚本。`$1` 和 `$#` 的内容是什么？
- [ ] `$1` 是 `./skript.sh`，`$#` 是 `4`
- [x] `$1` 是 `red`，`$#` 是 `3`
- [ ] `$1` 是 `red`，`$#` 是 `blue`
---
脚本自己的名字保存在 `$0` 中，所以不计入 `$#`。
```

## 条件——`if`

`if` 会运行一个命令并查看它的**退出码**：0 表示真，其他任何值都表示假。大多数时候，你会使用 `[` 命令（也叫 `test`）：

```sh
if [ -f ~/.bashrc ]; then echo "The file exists"; else echo "The file is missing"; fi
```

`[ ]` 内部的空格是必需的！像在脚本中那样分多行书写时，它看起来是这样的：

```text
if [ "$answer" = "yes" ]; then
    echo "Great!"
elif [ "$answer" = "no" ]; then
    echo "Too bad."
else
    echo "Please answer yes or no."
fi
```

最常用的测试：

| 测试 | 为真的条件 |
|---|---|
| `-f FILE` | 文件存在（并且是普通文件） |
| `-d DIR` | 目录存在 |
| `-z "$x"` | 变量为空 |
| `"$a" = "$b"` | 字符串相等（`!=` 表示不相等） |
| `$a -eq $b` | 数字相等 |
| `$a -lt $b` | 小于（`-le`、`-gt`、`-ge`、`-ne`） |
| `! CONDITION` | 条件*不*成立 |

注意，数字要用 `-eq`、`-lt` 等来比较，而 `=` 和 `<` 比较的是文本。bash 还有 `[[ ... ]]`，它要更聪明一些：在其中你可以写 `&&` 和 `||`，还可以用 `[[ $file == *.txt ]]` 这样的模式进行匹配。

对于简短的条件，用 `&&` 和 `||` 通常就够了：

```sh
[ -d ~/bilder ] && echo "The pictures directory exists"
```

```predict
$ x=""
$ if [ -z "$x" ]; then echo empty; else echo "not empty"; fi
empty
```

## 循环

**for 循环**会对列表中的每一项做同样的事：

```sh
for frukt in äpple banan kiwi; do echo "I like $frukt"; done
```

列表可以来自通配符或命令：

```sh
for fil in ~/dokument/*; do echo "File: $fil"; done
for i in $(seq 1 3); do echo "Round $i"; done
```

**while 循环**只要条件为真就会一直运行下去：

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

逐行处理文件最常用的方法是 `while read`，并在 `done` 后面用 `<` 把文件送进去：

```sh
while read rad; do echo "> $rad"; done < ~/dokument/frukter.txt
```

`break` 用来跳出循环，`continue` 则直接跳到下一轮。

```predict
$ for x in 2 4 6; do echo $(( x * 10 )); done
20
40
60
```

> **小心无限循环！** 如果循环的条件永远不会变为假，它就会永远运行下去。在真实的终端中，你可以按 **Ctrl+C** 来停止它。模拟器会在执行 20,000 步后自动停止它。

## 用 `case` 进行选择

当一个变量可能有很多不同的取值时，`case` 比一长串 `elif` 更清晰：

```sh
fil=semester.jpg
case $fil in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
```

每个分支都以 `;;` 结尾，而 `*)` 会匹配其他所有情况。

## 函数

**函数**（function）是一段有名字的代码，你可以像调用独立命令一样调用它。它接收参数的方式和脚本相同——`$1`、`$2` 和 `$#`：

```sh
halsa() { echo "Hello $1, welcome!"; }
halsa Kim
```

只应存在于函数内部的变量要用 `local` 来创建，而 `return` 会以一个退出码结束函数。

## 询问用户——`read`

`read` 从键盘读取一行内容，存入一个变量：

```sh
read -p "What's your name? " namn; echo "Hello $namn!"
```

## 一个完整的例子

下面这个脚本用到了本章讲过的大部分内容。它会为你作为参数传入的文件创建备份：

```text
#!/bin/bash
# backup.sh – 把每个文件复制为 file.bak

if [ $# -eq 0 ]; then
    echo "Usage: $0 FILE..."
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.bak"
        echo "Copied $file"
    else
        echo "Cannot find $file" >&2
    fi
done
```

`exit 1` 会以退出码 1 结束脚本，这样调用该脚本的一方就能知道出了问题。

## 编写好脚本的技巧

- 以 `#!/bin/bash` 开头，并写上注释。
- 把变量放在引号中：写 `"$file"`，而不是 `$file`。
- 很多人会在脚本开头写上 `set -euo pipefail`，这样脚本会在遇到第一个错误时就停下来，而不是盲目地继续执行。
- **ShellCheck** 程序可以找出 bash 脚本中的常见错误——在所有主流发行版上，你都可以用包管理器安装它。
