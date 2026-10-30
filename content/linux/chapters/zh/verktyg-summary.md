# 总结：更多工具

在这一部分中，你认识了两样你在终端里会用一辈子的工具：保存文件历史的 git，以及 bash 之外的其他 shell。下面是测验之前你应该记住的内容。

## 终端中的 git

**Git** 是一个版本控制系统：它保存整个项目的快照，记住谁修改了什么以及为什么，并让你可以回到过去。在 Ubuntu 上，你用 `sudo apt install git` 安装它；其他发行版使用各自的包管理器。

- 在第一次提交之前，你要用 `git config --global user.name` 和 `user.email` 告诉 git 你是谁。`--global` 表示适用于你的所有项目；这些设置保存在 `~/.gitconfig` 中。
- `git init` 把一个目录变成**仓库**（repository）。全部历史都保存在隐藏目录 `.git` 中。
- 一个修改会经过三个地方：**工作区**（你看到的文件）、**暂存区**（放进下一次提交的内容）和**历史**（各次提交）。`git add` 把修改放进暂存区，`git commit` 把暂存区保存为一次新的提交。
- `git commit -a` 会添加 git 已经在跟踪的每个修改过的文件——但永远不包括新文件。
- `git diff` 显示还没有放进暂存区的修改；`git diff --staged` 显示暂存区中的内容。
- **分支**（branch）是一个指向某次提交的标签，它会随着新的提交向前移动。切换分支时，git 会改写工作区。
- `git merge` 把一个分支合并到你当前所在的分支。如果两个分支修改了相同的行，就会出现**冲突**：修好文件，用 `git add` 添加它，最后用 `git commit` 完成合并。
- `.gitignore` 列出 git 不应跟踪的文件。它只对 git 尚未跟踪的文件有效。
- **远程仓库**（remote）是仓库在别处的一个副本，通常叫做 `origin`。`git pull` 获取并合并，`git push` 发送你的提交。

| 命令 | 作用 |
|---|---|
| `git config --global user.name "…"` | 告诉 git 你的名字（以及 `user.email`） |
| `git init` | 把目录变成仓库 |
| `git status` | 显示每个修改所处的位置 |
| `git add FILE` / `git add .` | 把修改放进暂存区 |
| `git commit -m "…"` | 把暂存区保存为一次新的提交 |
| `git commit -am "…"` | 一步完成：添加每个已跟踪的文件并提交 |
| `git diff` / `git diff --staged` | 显示尚未提交的修改 |
| `git log --oneline --graph --all` | 显示历史 |
| `git restore FILE` | 丢弃文件中的修改 |
| `git restore --staged FILE` | 把文件移出暂存区 |
| `git switch -c BRANCH` / `git switch BRANCH` | 创建分支 / 切换分支 |
| `git merge BRANCH` | 把一个分支合并到你当前所在的分支 |
| `git branch -d BRANCH` | 删除已合并的分支 |
| `git rm --cached FILE` | 停止跟踪文件，但把它保留在磁盘上 |
| `git clone`、`git pull`、`git push` | 通过远程仓库协作 |

## 其他 shell：zsh 和 fish

**shell** 读取你输入的内容并启动其他程序。像 `ls` 和 `grep` 这样的程序在每个 shell 中的用法都一样——不同的是围绕它们的语言：变量、循环、条件判断和提示符。

- `/etc/shells` 列出可以用作登录 shell 的 shell。你的登录 shell 是 `/etc/passwd` 中你那一行的最后一个字段，它也保存在 `$SHELL` 中。`$0` 保存着你此刻正在运行的 shell。
- **zsh** 几乎能理解 bash 的所有语法，还增加了一些便利功能：`**/` 搜索所有子目录，开启 `autocd` 后只需输入目录名就能进入那个目录。选项用 `setopt` 和 `unsetopt` 来开启和关闭。与 bash 不同，zsh 不会按空格拆分没有加引号的变量。
- **fish** 从一开始就很好用，但有**自己的语法**：用 `set` 代替 `=`，用 `$status` 代替 `$?`，用 `math` 代替 `$((...))`，每个代码块都以 `end` 结束。每个变量都是一个列表，从 1 开始编号。
- 启动的 shell 运行在 bash **内部**；`exit` 带你回去。使用 `-c` 时，shell 运行一条命令后就退出。
- 脚本仍然为 bash（或 POSIX `sh`）编写：`#!` 行决定了由哪个 shell 运行脚本，不管你当前坐在哪个 shell 里。
- `chsh -s` 更改你的登录 shell。更改在下次登录时生效。

| 命令 | 作用 |
|---|---|
| `cat /etc/shells` | 列出可以使用的 shell |
| `echo $0` / `ps` | 查看你此刻正在运行的 shell |
| `echo $SHELL` | 查看你的登录 shell |
| `zsh` / `fish` / `exit` | 启动另一个 shell / 返回 |
| `zsh -c '…'` / `fish -c '…'` | 在另一个 shell 中运行一条命令 |
| `setopt autocd` / `unsetopt autocd` | 开启 / 关闭一个 zsh 选项 |
| `set frukt äpple` / `set -e frukt` | 在 fish 中设置 / 删除变量 |
| `set -x NAME value` | 在 fish 中设置环境变量 |
| `math 17 x 23` | 在 fish 中做算术运算 |
| `chsh -s /usr/bin/zsh` | 更改你的登录 shell |

配置文件：`~/.bashrc`（bash）、`~/.zshrc`（zsh）和 `~/.config/fish/config.fish`（fish）。
