# 测验：脚本和自动化

回答关于 shell 脚本的问题——需要答对 80% 才能通过。

```quiz
脚本第一行的 `#!/bin/bash` 有什么作用？
- [ ] 它是一条注释，shell 会跳过它
- [x] 它告诉系统应该用哪个程序来运行这个文件
- [ ] 它让文件变成可执行的
---
它叫做 *shebang*。你仍然需要 `chmod +x` 才能让文件可执行。
```

```quiz
`{{nameVar}} = Kim` 报错 `command not found`。为什么？
- [x] `=` 两边的空格让 shell 把 `{{nameVar}}` 当成了一条命令
- [ ] 变量名必须用大写字母
- [ ] 你必须写成 `${{nameVar}} = Kim`
```

```predict
$ count=$(ls ~/{{documents}} | wc -l)
$ echo "$count files"
3 files
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
在脚本中，`"$@"` 包含什么？
- [ ] 参数的个数
- [ ] 脚本的名字
- [x] 所有参数，每个参数各自独立
```

```quiz
当 `n` 中的数字大于 10 时，哪个测试为真？
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
数字用 `-eq`、`-lt`、`-gt` 等来比较；`=` 和 `<` 比较的是文本。
```

```predict
$ [ -d ~/{{missing}} ] && echo yes || echo no
no
```

```predict
$ file=report.txt
$ case $file in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` 直接跳到下一轮，所以 `3` 永远不会被输出。
```

```quiz
`local` 在函数中有什么作用？
- [x] 创建一个只在函数内部存在的变量
- [ ] 让函数运行得更快
- [ ] 以一个退出码结束函数
```

```quiz
为什么脚本在出错时要以 `exit 1` 结束？
- [ ] 为了重新启动脚本
- [x] 让调用这个脚本的人能从退出码看出它失败了
- [ ] 为了输出数字 1
```

```quiz
你用 `cat > {{helloScript}} << '{{heredocEnd}}'` 开始一个 here 文档。它在什么时候结束？
- [ ] 在空行上按 Enter 时
- [x] 在 `{{heredocEnd}}` 这一行
- [ ] 十行之后
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```
