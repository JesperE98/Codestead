# 总结：脚本和自动化

在这一部分中，你把命令变成了你自己的程序。

## 用 sed 和 awk 处理文本

`sed` 编辑行：`s/old/new/` 进行替换（`g` 替换所有匹配项），地址用来选择行，`d` 删除行，`-n` 搭配 `p` 只打印你要求的内容。`sed -i` 会直接修改文件本身。`awk` 处理列：`-F` 设置分隔符，`$1` … `$NF` 是各个字段，`{ }` 前面的模式用来选择行，`END { }` 在最后一行之后运行。

## Shell 脚本

脚本是一个包含命令的文本文件，以 shebang `#!/bin/bash` 开头。你可以用 here document（`cat > file << '{{heredocEnd}}'`）来编写它，用 `chmod +x` 让它可执行，然后用 `./` 运行它。以 `#` 开头的行是注释。

用 `name=value` 创建变量——不能有空格——并在双引号中使用它们：`"$name"`，如果后面紧跟着文本，就写成 `"${name}_text"`。`$(command)` 会被替换成该命令打印出的内容，`$(( ))` 进行整数运算。脚本从 `$1`、`$2` ……、`$#` 和 `"$@"` 中读取它的参数。

`if` 查看命令的退出码，通常是测试命令 `[ ]` 的退出码。数字用 `-eq`、`-lt` 等来比较；文本用 `=` 和 `!=` 来比较。`for` 遍历一个列表，`while` 只要条件为真就一直运行，`while read` 逐行处理文件。`case` 在多个模式之间进行选择，函数是有名字的代码片段，有自己的 `$1`，而 `read` 让用户输入内容。`exit 1` 告诉调用脚本的一方出了问题。

## 用 cron 运行定时任务

**cron** 在设定的时间运行你的 **crontab** 中的任务。每一行有五个时间字段——分钟、小时、日期、月份和星期几——后面是命令；`*` 表示每一个，`*/5` 表示每隔五个。`crontab -l` 显示任务，`crontab -` 从输入安装新任务——同时替换掉所有旧任务。任务运行时不带你终端的设置，`PATH` 也很短，所以要把它们的输出发送到文件。`journalctl -u cron` 显示每次运行，`systemctl list-timers` 显示 systemd 的定时器。

## 命令和语法

| 语法 | 作用 |
|---|---|
| `sed`: `s/…/…/g`、`d`、`p`、`q`、`-n`、`-i`、`-E`、`-e` | 编辑行流 |
| `awk`: `-F` 分隔符，`$1`、`$NF`、`NF`、`NR`、`BEGIN`、`END` | 处理列 |
| `#!/bin/bash` | shebang：由哪个程序运行脚本 |
| `cat > file << '{{heredocEnd}}'` | 把各行写进文件，直到遇到 `{{heredocEnd}}` 这一行 |
| `name=value` · `"$name"` · `"${name}"` | 创建 · 使用变量 |
| `$(command)` | 被替换成命令打印出的内容 |
| `$(( a * 6 ))` · `(( a++ ))` | 整数运算 · 修改变量 |
| `$0` · `$1` · `$#` · `"$@"` | 脚本的名字 · 第一个参数 · 参数个数 · 所有参数 |
| `if [ ... ]; then ...; elif ...; else ...; fi` | 条件 |
| `-f` · `-d` · `-z` | 文件存在 · 目录存在 · 变量为空 |
| `=` · `!=` | 文本相等 · 不相等 |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | 比较数字 |
| `[[ $file == *.txt ]]` | bash 更聪明的测试，支持模式 |
| `for x in list; do ...; done` | 遍历列表 |
| `while [ ... ]; do ...; done` | 只要条件为真就一直循环 |
| `while read line; do ...; done < file` | 逐行处理文件 |
| `break` · `continue` | 跳出循环 · 进入下一轮 |
| `case $x in pattern) ...;; *) ...;; esac` | 按模式选择 |
| `name() { ...; }` · `local` · `return` | 函数 · 局部变量 · 结束函数 |
| `read -p "Question " var` | 从键盘读取一行 |
| `exit 1` | 以一个退出码结束脚本 |
| `set -euo pipefail` | 遇到第一个错误就停止脚本 |
| `crontab -l` · `crontab -r` | 显示 · 删除你的 crontab |
| `echo '* * * * * command' \| crontab -` | 从输入安装 crontab（替换旧的） |
| `(crontab -l; echo 'LINE') \| crontab -` | 添加一个任务并保留旧任务 |
| `MIN HOUR DAY MONTH WEEKDAY command` | 一行 crontab，例如 `30 2 * * 1-5` |
| `systemctl list-timers` | 显示 systemd 的定时器 |
