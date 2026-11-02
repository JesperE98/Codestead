# 其他 shell：zsh 和 fish

到目前为止，你的每一条命令都是在 **bash** 中输入的。但 bash 只是众多 shell 中的一种——很多人更喜欢别的 shell。在本章中，你将安装两个流行的替代品 **zsh** 和 **fish**，试用它们，并看看它们与 bash 有什么不同。你还会了解为什么脚本几乎仍然总是为 bash 编写的。

## 再说一遍，shell 是什么？

**shell** 是这样一个程序：它读取你输入的内容，解释它，然后启动其他程序。理解 `|`、`>`、`$VARIABLES`、`*.txt` 这样的通配符以及循环的，正是 shell。终端只是 shell 运行所在的窗口。

像 `ls`、`grep` 和 `cat` 这样的程序是 `/usr/bin` 中独立的程序——无论你使用哪个 shell，它们的用法都一样。不同 shell 之间的区别在于**围绕这些程序的语言**：如何设置变量、如何编写循环和条件判断、提示符是什么样子，以及提供了哪些便利功能。

```quiz
你从 bash 换到了另一个 shell。下面哪一项会保持完全不变？
- [ ] 如何设置变量
- [ ] 如何编写循环
- [x] `grep` 如何处理它的选项
- [ ] 提示符是什么样子
---
`grep` 是 `/usr/bin` 中一个独立的程序。shell 只是启动它——不同 shell 之间不同的是围绕它的语言。
```

## 家族谱系：sh、bash、zsh 和 fish

| Shell | 诞生年份 | 特点 |
|---|---|---|
| `sh` | 1979 | Bourne shell。如今的 `sh` 遵循 **POSIX** 标准，是最基本的“公分母”。 |
| `bash` | 1989 | *Bourne Again SHell*。几乎所有 Linux 发行版的默认 shell。 |
| `zsh` | 1990 | 基本兼容 bash，但功能更多。macOS 的默认 shell。 |
| `fish` | 2005 | *Friendly interactive shell*（友好的交互式 shell）。易于使用，但有**自己的语法**。 |

**POSIX** 是一个描述 `sh` 类 shell 应该如何工作的标准。只使用 POSIX 功能的脚本可以在所有兼容 `sh` 的 shell 中运行：bash、zsh、`dash`（在 Debian 和 Ubuntu 上它就是 `/bin/sh`）以及 `ash`（用在 Alpine 这样的小型系统上）。fish 故意**不**兼容 POSIX——这让它更简单，但也让它与众不同。

## 安装了哪些 shell？

文件 `/etc/shells` 列出了可以用作登录 shell 的 shell：

```sh
cat /etc/shells
```

你登录时得到哪个 shell，由 `/etc/passwd` 中你那一行的最后一个字段决定，它也保存在变量 `$SHELL` 中：

```sh
grep {{user}} /etc/passwd
echo $SHELL
```

## zsh——增强版的 bash

### 安装 zsh

在 Ubuntu 终端中，你用 apt 安装 zsh：

```sh
sudo apt update
sudo apt install zsh
```

其他发行版使用各自的包管理器，这一点你在关于发行版和软件包的部分中已经学过。在那些发行版上，这个软件包同样叫做 `zsh`。

再看看 `/etc/shells`——这个软件包添加了 `/usr/bin/zsh`（以及 `/bin/zsh`）：

```sh
cat /etc/shells
```

### 启动 zsh

shell 和其他程序一样也是程序，所以只要输入它的名字就能启动 zsh：

```sh
zsh
```

第一次启动时，迎接你的是 **zsh-newuser-install**，因为你还没有 zsh 的配置文件。这是一个帮助你入门的菜单：

| 按键 | 作用 |
|---|---|
| `q` | 什么都不做就退出（下次还会再问你） |
| `0` | 创建一个几乎为空的 `~/.zshrc` |
| `1` | 包含所有设置的主菜单（模拟器中不可用） |
| `2` | 创建带有推荐设置的 `~/.zshrc` |

回答 `2`。提示符变成了 `{{user}}@ubuntu ~ %`——在 zsh 中，`%` 是普通用户的常用标志（root 则是 `#`，和 bash 一样）。

你现在运行的是哪个 shell？变量 `$0` 保存着 shell 的名字：

```sh
echo $0
ps
```

`ps` 显示 zsh 是在 bash **内部**运行的：bash 把 zsh 作为一个新进程启动了。还要注意，`$SHELL` 仍然是 `/bin/bash`——这个变量告诉你的是你的*登录 shell*，而不是你此刻碰巧在运行的 shell。

```sh
echo $SHELL
```

### 大多数东西和 bash 一样

zsh 几乎能理解 bash 的所有语法。pipe、重定向、变量、`if`、`for` 和函数都和你习惯的用法一样：

```sh
for f in ~/{{documents}}/*.txt; do wc -l $f; done
```

### 功能 1：`**` 搜索所有子目录

在 zsh 中，`**/` 表示“所有目录，任意层级”。下面的命令会列出你主目录及其下所有位置的每个 `.txt` 文件：

```sh
ls ~/**/*.txt
```

在 bash 中，`**` 的作用和普通的 `*` 一样——除非你先用 `shopt -s globstar` 打开这个功能。

### 功能 2：autocd

开启 `autocd` 选项后（它是推荐设置的一部分），你只需输入目录名就能进入那个目录——不需要 `cd`：

```sh
{{documents}}
..
```

选项用 `setopt` 和 `unsetopt` 来开启和关闭：

```sh
setopt
unsetopt autocd
setopt autocd
```

### 需要注意的区别：变量不会被拆分

在 bash 中，没有加引号的变量会按空格拆分。在 zsh 中则不会：

```sh
files="a.txt b.txt"
for f in $files; do echo "[$f]"; done
```

bash 会输出 `[a.txt]` 和 `[b.txt]`——zsh 则输出 `[a.txt b.txt]`。zsh 的做法通常正是你想要的，但这意味着 bash 脚本在 zsh 中不一定会做同样的事。（使用 `setopt shwordsplit` 后，zsh 的行为就会和 bash 一样。）

要在某个 shell 中试一条命令，并不需要先启动它。使用 `-c` 时，shell 会运行这条命令，然后立即退出——`zsh -c 'echo $0'` 会打印 `zsh`，之后你仍然在 bash 中。

下面的问题从一个全新的终端开始，所以它会先安装 zsh。`> /dev/null 2>&1` 会丢弃那一行的输出。最后一条命令会打印什么？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'files="x.txt y.txt z.txt"; for f in $files; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
zsh 不会按空格拆分变量，所以循环只用整个值运行一次。在 bash 中，同样的循环会打印三行：`<x.txt>`、`<y.txt>` 和 `<z.txt>`。
```

### ~/.zshrc 和提示符

bash 启动时读取 `~/.bashrc`——zsh 读取的是 `~/.zshrc`。看看 zsh-newuser-install 创建的文件：

```sh
cat ~/.zshrc
```

提示符由变量 `PROMPT` 设置，使用以 `%` 开头的代码：

| 代码 | 含义 |
|---|---|
| `%n` | 用户名 |
| `%m` | 计算机的名字 |
| `%~` | 完整的目录（主目录显示为 `~`） |
| `%1~` | 只显示目录的最后一部分 |
| `%#` | 普通用户显示 `%`，root 显示 `#` |
| `%F{green}` … `%f` | 颜色（red、green、blue、yellow ……） |

试一试：

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

这个更改只在你离开 zsh 之前有效。如果你希望每次都这样，就把这一行写进 `~/.zshrc`。

### Oh My Zsh

很多 zsh 用户会安装 **Oh My Zsh**，它是一套主题和插件的合集——例如在提示符中显示 Git 信息、更好的 Tab 补全，以及输入时的建议。它通过项目网站上的一个脚本安装，并在 `~/.zshrc` 中配置。模拟器中没有它，但现在你知道别人谈论它时指的是什么了。

### 回到 bash

zsh 是一个在 bash 内部运行的进程。用 `exit` 离开它，你就回到了 bash——在 zsh 中设置的变量、别名以及切换的目录都不复存在：

```sh
exit
echo $0
```

## fish——友好的交互式 shell

fish 希望无需配置就能立即上手：彩色显示、Tab 补全以及**自动建议**（autosuggestions）——fish 会根据你的历史记录，用灰色文字建议命令的剩余部分，按右方向键即可接受建议。（模拟器不会显示建议，但语法是可用的。）

### 安装并启动 fish

fish 也用同样的方式通过 apt 安装——在其他发行版上则用各自的包管理器：

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

fish 会向你打招呼，提示符变成 `{{user}}@ubuntu ~>`。往下进入几层目录，看看 fish 是如何缩短提示符中的路径的：

```sh
mkdir -p ~/{{documents}}/{{project}}
cd ~/{{documents}}/{{project}}
cd ~
```

在目录 `~/{{documents}}/{{project}}` 中，提示符显示为 `~/d/{{project}}>`——除了最后一个目录，其他每个目录都被缩写成一个字母。

### fish 有自己的语法

这是 fish 与 bash 和 zsh 差别最大的地方：

| 操作 | bash 和 zsh | fish |
|---|---|---|
| 设置变量 | `{{fruitVar}}={{fruitWord}}` | `set {{fruitVar}} {{fruitWord}}` |
| 环境变量 | `export EDITOR=nano` | `set -x EDITOR nano` |
| 删除变量 | `unset {{fruitVar}}` | `set -e {{fruitVar}}` |
| 命令替换 | `$(pwd)` | `(pwd)` |
| 上一条命令的退出状态 | `$?` | `$status` |
| 脚本参数 | `$@`, `$1` | `$argv`, `$argv[1]` |
| 条件判断 | `if …; then …; fi` | `if …; …; end` |
| 循环 | `for …; do …; done` | `for …; …; end` |
| 函数 | `hello() { …; }` | `function hello; …; end` |
| 算术运算 | `$((17 * 23))` | `math 17 x 23` |

### 用 set 设置变量

试试用 bash 的方式设置一个变量：

```sh
{{fruitVar}}={{fruitWord}}
```

fish 会拒绝，并告诉你应该怎么写：

```text
fish: Unsupported use of '='. In fish, please use 'set {{fruitVar}} {{fruitWord}}'.
```

在 fish 中要这样做：

```sh
set {{fruitVar}} {{fruitWord}}
echo ${{fruitVar}}
set -x EDITOR nano
set -e {{fruitVar}}
```

`-x`（*export*，导出）让变量成为环境变量，你启动的程序都能看到它；`-e`（*erase*，擦除）则删除变量。

在 fish 中，每个变量都是一个**列表**。元素从 1 开始编号：

```sh
set fruits 苹果 梨 香蕉
echo $fruits[2]
count $fruits
```

`-c` 在 fish 中也能用。最后一条命令会打印什么？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set fruits 苹果 梨 香蕉; echo $fruits[3]'
香蕉
---
fish 列表中的元素从 1 开始编号，所以 `[3]` 是第三个，也是最后一个元素。
```

### 命令替换和 $status

在 fish 中，命令替换用普通的圆括号来写：

```sh
echo "I am in" (pwd)
```

在引号内，圆括号只是普通文本——这就是为什么 `(pwd)` 要放在引号外面。上一条命令的退出状态叫做 `$status`：

```sh
false
echo $status
```

### and、or 和 not

fish 有自己的命令来串联条件：

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

较新版本的 fish（3.0 及以上）也能理解 `&&` 和 `||`，从 3.4 开始 `$(...)` 也能用了。但 `X=1`、`$?` 和 `$((...))` 仍然不行——它们会报错，并告诉你 fish 的写法。

### 代码块以 end 结束

在 fish 中，每个代码块——`if`、`for`、`while`、`switch` 和 `function`——都以 `end` 结束。没有 `then`、`do`、`done` 或 `fi`：

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

你也可以把代码块写成多行。shell 会等到 `end` 出现后才运行循环：

```sh
for f in ~/{{documents}}/*.txt
echo (basename $f)
end
```

函数通过列表 `$argv` 获取参数：

```sh
function hello; echo "Hello $argv!"; end
hello Kim
```

### 用 math 做算术运算

fish 没有 `$((...))`。取而代之的是 `math` 命令，它还能处理小数：

```sh
math 17 x 23
math 10 / 4
```

乘法要写成 `x`（或者放在引号里写成 `"17 * 23"`）——单独的 `*` 在 fish 中是通配符，和 bash 一样。

### fish 的设置

fish 启动时会读取 `~/.config/fish/config.fish`。如果你想去掉欢迎信息，就把变量 `fish_greeting` 清空。加上 `-U`，变量就成为**全局通用的**（universal）：它会保存在 `~/.config/fish/fish_variables` 中，在每个 fish shell 中都有效，即使重启之后也一样。

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

用 `exit` 离开 fish：

```sh
exit
```

## 为什么脚本仍然为 bash 编写

在终端中使用哪个 shell 是个人喜好问题。但**脚本**几乎总是为 bash（或 POSIX `sh`）编写的：

- 几乎每个 Linux 系统上都安装了 bash——zsh 和 fish 则不然。
- fish 的语法在 bash 中不能用，反之亦然。
- 脚本顶部的 `#!` 行决定了由哪个 shell 来运行它——**不管**你当前坐在哪个 shell 里。

试着写一个 bash 脚本，然后在 fish 中运行它：

```sh
cat > ~/{{helloScript}} << '{{heredocEnd}}'
#!/bin/bash
name=Kim
echo "Hello $name, I am run by bash"
{{heredocEnd}}
chmod +x ~/{{helloScript}}
fish
~/{{helloScript}}
exit
```

这个脚本在 fish 中可以正常运行，尽管 `name=Kim` 在 fish 中是不允许的——因为运行它的是 bash。这就是 `#!/bin/bash`（或 `#!/usr/bin/env bash`）如此重要的原因。一个必须在任何地方都能运行的脚本——即使在没有 bash 的地方——要用 `#!/bin/sh` 并且只使用 POSIX 语法来编写。

```quiz
你正在 fish 中运行一个以 `#!/bin/bash` 开头、并且包含 `count=3` 这一行的脚本。会发生什么？
- [ ] fish 拒绝运行，因为 fish 中不允许 `count=3`
- [x] 它能正常运行——无论你在哪个 shell 中，运行这个脚本的都是 bash
- [ ] 只有先用 `chsh` 把登录 shell 改成 bash 才能运行
---
`#!` 行决定了由哪个 shell 来运行脚本。fish 只是启动它。
```

## 用 chsh 更改默认 shell

每次打开终端都要输入 `zsh`，很快就会让人厌烦。用 `chsh`（*change shell*，更改 shell）可以更改你的**登录 shell**——也就是 `/etc/passwd` 中的那一个：

```sh
chsh -s /usr/bin/zsh
grep {{user}} /etc/passwd
```

- shell 必须用完整路径给出，并且要列在 `/etc/shells` 中。
- `chsh` 会要求输入你的密码（模拟器会跳过这一步）。
- 更改在**下次登录**时生效。你已经打开的终端会保留原来的 shell，而 `$SHELL` 要等你重新登录后才会改变。
- root 可以为其他用户更改 shell：`sudo chsh -s /usr/bin/fish kim`。

要切换回 bash，做法相同：

```sh
chsh -s /bin/bash
```

对于 fish，一个常见的建议是保留 bash 作为登录 shell，而让终端程序去启动 fish——这样所有在登录时需要 POSIX shell 的东西都能继续正常工作。

下面的问题从一个全新的终端开始，安装 zsh 并把它设为登录 shell。最后一条命令会打印什么？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
`chsh` 修改了 `/etc/passwd` 中你的那一行，但更改要到下次登录时才生效。你已经打开的终端仍然使用 bash，`$SHELL` 也一样。
```

## 该选择哪个 shell？

- **bash**——到处都是默认的。你在这里学到的东西，在你将来登录的每台服务器上都能用。用 bash 编写你的脚本。
- **zsh**——适合想要更多便利、又想保留 bash 语法的你。Oh My Zsh 为你提供主题和插件。
- **fish**——开箱即用体验最好，但语法不同。从网上复制的命令不一定能用。
- **sh/dash**——用于必须在任何地方都能运行的脚本，以及小型系统。

## 小结

| 命令 | 作用 |
|---|---|
| `cat /etc/shells` | 列出可以使用的 shell |
| `echo $0` / `ps` | 查看你此刻正在运行的 shell |
| `echo $SHELL` | 查看你的登录 shell |
| `zsh` / `fish` / `exit` | 启动另一个 shell / 返回 |
| `ls ~/**/*.txt` | 搜索所有子目录（zsh、fish） |
| `setopt autocd` | 开启一个 zsh 选项 |
| `set {{fruitVar}} {{fruitWord}}` | 在 fish 中设置变量 |
| `set -x NAME value` | 在 fish 中设置环境变量 |
| `chsh -s /usr/bin/zsh` | 更改你的登录 shell |

配置文件：`~/.bashrc`（bash）、`~/.zshrc`（zsh）和 `~/.config/fish/config.fish`（fish）。
