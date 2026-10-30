# 变量、PATH 和别名

shell 以**变量**的形式拥有自己的“记忆”。在本章中，你将学习如何读取和设置变量、shell 如何找到程序，以及如何创建你自己的快捷命令。

## 环境变量

在变量名前面加上 `$` 就可以读取它：

```sh
echo $HOME
echo "My name is $USER"
```

`env` 会列出所有*环境变量*——也就是你启动的程序也能读取的变量：

```sh
env
```

用 `NAME=value` 来创建变量（`=` 两边不能有空格！）。用 `export` 可以把它变成环境变量：

```sh
export EDITOR=nano
```

```quiz
哪一行会创建值为 `blue` 的变量 `FARG`？
- [ ] `FARG = blue`
- [x] `FARG=blue`
- [ ] `$FARG=blue`
---
`=` 两边不能有空格。如果有空格，shell 会以为 `FARG` 是一个命令。`$` 只在*读取*变量时使用。
```

## 单引号和双引号

两者有一个重要的区别：

```sh
echo "Home: $HOME"
echo 'Home: $HOME'
```

在**双**引号中，变量会被替换成它的值。在**单**引号中，所有内容都会原样打印出来。

```predict
$ x=linux
$ echo "I like $x"
$ echo 'I like $x'
I like linux
I like $x
```

## PATH——命令是在哪里找到的？

当你输入 `ls` 时，shell 会依次在 `PATH` 变量列出的各个目录中查找名为 `ls` 的文件：

```sh
echo $PATH
```

`which` 显示程序是在哪里找到的。有些命令（比如 `cd`）根本不是文件，而是*内置*在 shell 中的——`type` 会告诉你一个名字到底是什么：

```sh
which ls
type cd
```

如果你想运行一个不在 `PATH` 中的程序，就必须给出它的路径，例如对于当前目录中的文件，要写成 `./myprogram`。

```quiz
当前目录中有一个名为 `hej` 的程序，而这个目录不在 `PATH` 中。你要怎样运行它？
- [ ] `hej`
- [x] `./hej`
- [ ] `type hej`
---
不带路径时，shell 只会在 `PATH` 中的目录里查找。`./hej` 准确地指出了文件所在的位置：当前目录。
```

## 退出码——`$?`

每个命令结束时都会留下一个**退出码**（exit code）：`0` 表示一切顺利，其他任何值都表示出错。最近一次的退出码保存在 `$?` 中：

```sh
ls /finnsinte
echo $?
```

`&&` 和 `||` 看的正是这个退出码。

## 别名

**别名**（alias）就是你自己定义的快捷命令：

```sh
alias ll='ls -la'
ll
```

不带参数的 `alias` 会列出所有别名，而 `unalias ll` 可以删除一个别名。

```predict
$ alias hej='echo Hello'
$ hej
Hello
```

## 保存设置——`~/.bashrc`

你创建的变量和别名会在关闭终端时消失。要想保留它们，就把它们写进文件 `~/.bashrc`，bash 每次打开新终端时都会读取这个文件。修改该文件后，可以用下面的命令立即加载它：

```sh
source ~/.bashrc
```

```quiz
你创建了一个别名，关闭终端后又打开了一个新终端。别名不见了。你本应该怎么做？
- [ ] 运行不带参数的 `alias`
- [x] 把别名写进 `~/.bashrc`
- [ ] 用 `export` 创建它
---
每次打开新终端时，你写进 `~/.bashrc` 的所有内容都会被重新读取。
```
