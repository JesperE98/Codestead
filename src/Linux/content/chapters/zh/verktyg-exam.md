# 测验：更多工具

这里有十四道关于 git 和其他 shell 的题目。你需要答对 80% 才能通过。带命令的题目会在一个全新的终端中运行，
所以它们会先安装需要的程序——`> /dev/null 2>&1` 会丢掉这些行的输出。

```quiz
你修改了 `index.html`，又创建了新文件 `contact.html`。你运行
`git commit -am "Contact page"`。哪些内容会进入这次提交？
- [x] 只有对 `index.html` 的修改
- [ ] 只有 `contact.html`
- [ ] 两个文件都会
---
`-a` 会添加 git 已经在跟踪的所有已修改文件——但从不添加新文件。`contact.html`
必须先用 `git add` 添加。
```

```quiz
你已经对 `style.css` 中的一处修改运行了 `git add`。哪条命令能显示这处修改？
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` 比较的是工作区和暂存区，所以修改一旦进入暂存区，它就什么也不显示了。`--staged`
显示的是等待提交的内容。
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge {{newDesign}} > /dev/null
$ git log --oneline | wc -l
2
---
自从创建分支以来，`main` 一直没有变化，所以这次合并是一次*快进*（fast-forward）：git 只是把
`main` 向前移动到 `{{newDesign}}` 的那个提交。没有创建合并提交。
```

```quiz
从技术上讲，git 中的分支是什么？
- [ ] 项目中每个文件的完整副本
- [x] 一个指向某个提交的标签，你做新的提交时它会跟着移动
- [ ] 一个拥有自己 `.git` 目录的独立仓库
---
正因为如此，git 中的分支成本很低——经常使用它们吧。
```

```quiz
`git merge` 因为 `index.html` 中的冲突而停了下来。你已经修好了这个文件，并删除了标记行。接下来做什么？
- [ ] 再运行一次 `git merge`
- [x] `git add index.html`，然后 `git commit`
- [ ] `git restore index.html`
---
`git add` 告诉 git 冲突已经解决，`git commit` 则完成这次合并。`git restore`
会丢掉你的修复。
```

```quiz
文件 `error.log` 被误提交了。你把 `*.log` 添加到 `.gitignore` 中，但 git 仍然在跟踪这个文件。
怎样才能把它从仓库中移除，但保留在磁盘上？
- [ ] `rm error.log`
- [x] `git rm --cached error.log`
- [ ] `git restore error.log`
---
`.gitignore` 只对 git 尚未跟踪的文件生效。`--cached` 会把文件从 git 中移除，但把它留在磁盘上。
```

```quiz
哪条命令从远程仓库获取新的提交，但**不**把它们与你的提交合并？
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` 获取并合并；`git fetch` 只获取。
```

```quiz
下面哪些修改会永久丢失？选择所有符合的选项。
- [x] 某个文件中从未提交过的修改，被 `git restore` 丢掉了
- [x] 从未提交过的修改，被 `git reset --hard` 丢掉了
- [ ] 你昨天做的一个提交，之后你运行了 `git reset --hard`
---
只要某个时刻提交过，几乎总能找回来——`git reflog` 会显示你去过哪里。
```

```quiz
你从 bash 中启动了 zsh。哪条命令能显示你现在正在运行的 shell？
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` 是你的登录 shell——仍然是 `/bin/bash`。`/etc/shells` 列出了可以用作登录 shell 的 shell。
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` 能处理小数。
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
在 fish 中，上一条命令的退出状态叫做 `$status`——`false` 总是失败。
```

```quiz
在 fish 中，怎样把 `EDITOR` 设为值为 `nano` 的环境变量？
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` 导出变量；`-e` 删除变量。
```

```quiz
zsh 启动时会读取哪个文件？
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep {{user}} /etc/passwd
---
这一行的最后一个字段就是你的登录 shell——也就是 `chsh -s` 要修改的那个。
```
