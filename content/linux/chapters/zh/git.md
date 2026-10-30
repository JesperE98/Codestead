# 终端中的 Git

你有没有保存过名为 `report-final.txt`、`report-final-2.txt` 和 `report-REALLY-final.txt` 的文件？如果有，那你其实已经在手动做*版本控制*了。版本控制系统会把这件事做得更规范：它保存整个项目的快照，记住谁在什么时候、出于什么原因改了什么，让你可以“穿越”回过去，还能让很多人同时在同一批文件上工作。

**Git** 是迄今为止最常用的版本控制系统。它由 Linus Torvalds 在 2005 年编写——他也正是 Linux 内核的作者——最初是为了管理内核的源代码。如今几乎所有软件都在用 git，但它同样适合管理网页、配置文件、笔记和书稿。只要是文本，就非常适合用 git 来管理。

Git 是为终端而生的。图形化程序和编辑器里虽然也有 git 按钮，但它们在底层运行的，正是你在这里学到的这些命令。

## 安装 git

git 并不总是预装的。在 {{distro}} 上，你可以这样安装它：

:::debian
```sh
sudo apt update
sudo apt install git
```
:::

:::arch
```sh
sudo pacman -S git
```

当 pacman 询问是否继续时，回答 yes。
:::

:::redhat
```sh
sudo dnf install git
```

回答 `y`——`[y/N]` 中大写的 `N` 表示默认选项是 No。
:::

在每个家族中，这个软件包都叫 `git`。检查一下它能否正常工作：

```sh
git --version
```

所有 git 命令的格式都是 `git 子命令`，例如 `git status` 或 `git log`。用 `man git` 可以查看手册。

## 告诉 git 你是谁

git 中保存的每个版本都包含创建者的姓名和电子邮件地址。所以在你保存任何东西之前，git 需要知道你是谁。每台计算机只需设置一次：

```sh
git config --global user.name "Elev Elevsson"
git config --global user.email "elev@example.com"
```

你可以随意填写自己的名字。`--global` 表示这项设置对你所有的项目都生效。它保存在普通的文本文件 `~/.gitconfig` 中：

```sh
cat ~/.gitconfig
```

```text
[user]
	name = Elev Elevsson
	email = elev@example.com
```

如果你忘了这一步，git 会在你尝试保存时报错：`*** Please tell me who you are.`——并且建议你运行的正是这两条命令。

> **提示：** 再加上 `git config --global init.defaultBranch main`。这样在你所有的计算机上，每个新项目的主分支都会叫 `main`。旧版本的 git 把它叫做 `master`，在实际中这两个名字你都会见到。

## 新建一个仓库

你的主目录中有一个小型网站项目 `~/projekt-webb`（瑞典语的“网站项目”），里面有三个文件。进去看看：

```sh
cd ~/projekt-webb
ls
```

要让 git 开始跟踪这个目录，需要把它变成一个**仓库**（repository，简称 *repo*）：

```sh
git init
```

```text
Initialized empty Git repository in /home/elev/projekt-webb/.git/
```

唯一发生的变化是创建了一个隐藏目录 `.git`。git 把全部历史都保存在那里。git 不会动你的文件。

```sh
ls -a
ls .git
```

除非你想丢掉历史记录，否则千万不要删除 `.git`——也不要手动编辑其中的文件。如果你想在某个项目中停止使用 git，只要删除 `.git` 就够了；你的普通文件都会保留下来。

## 三个地方：工作区、暂存区和历史

关于 git，最重要的一点是要理解：一项修改会经过三个地方：

```text
 working tree  ──git add──▶  index  ──git commit──▶  history
 (the files you see)       (next commit)             (.git)
```

- **工作区**（working tree）就是文件现在的样子，也就是你正在编辑的那些文件。
- **暂存区**（index，也叫 *staging area*）有点像一张打包台。你把要放进下一个保存版本的内容放到这里。
- **历史**由一个个**提交**（commit）组成。一个提交就是所有文件的一份保存快照，附带一条提交信息、作者和时间。

为什么要有中间这一步？为了让你可以挑选。如果你改了五个文件，但只有其中两个属于同一件事，你就可以只把这两个放进暂存区并提交，剩下的留给另一个单独的提交。

## `git status` 是你的指南针

你最常运行的命令就是 `git status`。它会告诉你每一处修改所在的位置——而且经常会建议你下一步该做什么。宁可多运行几次，也不要太少！

```sh
git status
```

```text
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md
	index.html
	style.css

nothing added to commit but untracked files present (use "git add" to track)
```

*Untracked files*（未跟踪的文件）是 git 能看到、但还没有开始跟踪的文件。在真实的终端中它们显示为红色。用 `git add` 把它们放进暂存区：

```sh
git add index.html style.css README.md
git status
```

```text
Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
	new file:   index.html
	new file:   style.css
```

现在它们列在 *Changes to be committed*（待提交的修改）下面——显示为绿色。除了逐个写出文件名，你也可以输入 `git add .`，它会添加当前目录中的所有内容（点表示“这里”）。`git add -A` 则会添加整个仓库中的所有修改。

## 第一次提交

用 `git commit` 保存快照。`-m` 选项用来给出提交信息：

```sh
git commit -m "Första versionen av webbplatsen"
```

```text
[main (root-commit) 3f2a9c1] Första versionen av webbplatsen
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

（这条信息是瑞典语的“网站的第一个版本”——你自己的提交信息可以用任何语言来写。）`3f2a9c1` 是这个提交的 **ID** 的开头——它是一个根据内容计算出来的 40 个字符的*哈希值*（hash）。你的 ID 会不一样，因为时间和你的名字也是计算的一部分。通常前七个字符就足以确定一个提交。

再运行一次 `git status`：

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean*（工作区是干净的）表示所有内容都已保存。很好！

## 查看改了什么：`git diff`

在 `README.md` 中加一行，然后问问 git 发生了什么：

```sh
echo 'Sidan är byggd med HTML och CSS.' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 1100cf4..e5bd3a0 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # Min webbplats
 
 En liten webbplats som jag versionshanterar med git.
+Sidan är byggd med HTML och CSS.
```

以 `+` 开头的行是新增的（绿色），以 `-` 开头的行是被删除的（红色），其余的行作为上下文显示。`@@ -1,3 +1,4 @@` 表示旧版本的第 1–3 行对应新版本的第 1–4 行。

`git diff` 比较的是工作区和暂存区——也就是你*还没有*添加的内容。要查看已经放进暂存区、等待提交的内容，请输入 `git diff --staged`。

添加并提交这项修改。`-a` 选项会对 git 已经在跟踪的所有文件运行 `git add`，所以一步就能完成：

```sh
git commit -a -m "Beskriv hur sidan är byggd"
```

注意，`-a` *不会*包含 git 还没有跟踪的新文件。这些文件你总是需要先用 `git add` 添加。

## 好的提交信息

半年之后，讲述整个故事的就是这些提交信息——讲给你自己，也讲给别人。几条经验法则：

- 第一行写得简短些，最好不超过 50 个字符，概括这次修改。
- 描述这次修改*做了什么*，最好再说明*为什么*，而不是*你是怎么*写的。
- 一个提交只做一件事。三个小提交胜过一个大提交。
- 需要解释更多？空一行，然后在下面写一段更长的说明。每个 `-m` 都会成为单独的一段：`git commit -m "Title" -m "Explanation."`

| 不好 | 更好 |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

在英语中，提交信息通常用祈使语气来写：*Add contact form*、*Fix broken link*。读起来就像“这个提交将会……”。

## 查看历史

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: Elev Elevsson <elev@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    Beskriv hur sidan är byggd

commit 3f2a9c1...
```

最新的提交排在最前面。`HEAD -> main` 表示你在 `main` 分支上，而且这是它的最新提交。几个有用的变体：

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` 每个提交只显示一行，`-n 1` 只显示最新的一个，`--stat` 显示哪些文件被修改了，而 `git show` 会显示一个提交以及修改本身。你还可以查看某个文件在特定提交中的样子：`git show HEAD~1:README.md`（`HEAD~1` 表示“最新提交的前一个提交”）。

## 撤销

git 让撤销变得很简单——这正是它一半的意义所在：

| 如果你想…… | 命令 |
|---|---|
| 丢弃某个文件中的修改（尚未添加） | `git restore FILE` |
| 把文件从暂存区中撤出（修改仍然保留） | `git restore --staged FILE` |
| 修改最新提交的提交信息 | `git commit --amend -m "New message"` |
| 让一切回到最新提交时的样子 | `git reset --hard` |

试着把一个文件弄坏，再把它找回来：

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **注意！** `git restore FILE` 和 `git reset --hard` 会丢弃从未提交过的修改。这些修改是无法恢复的。相反，只要是曾经提交过的内容，几乎总能找回来——问问 `git reflog`，看看你都去过哪里。

## 分支

**分支**（branch）是一条独立的开发线。你可以在一个分支中尝试新的想法，而不会碰到 `main` 中能正常工作的版本。如果效果不错，就把分支合并进 `main`；如果不好，就把它扔掉。

从技术上讲，分支只是一个指向某个提交的标签，当你创建新的提交时，它会跟着向前移动。这就是为什么 git 中的分支代价很低——多多使用它们吧！

```sh
git branch
git switch -c ny-design
git branch
```

`git switch -c ny-design`（瑞典语的“新设计”）会创建这个分支并切换过去。`git branch` 中的星号表示你当前所在的位置。做一处修改，然后在这个分支上提交：

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "Lila rubriker"
```

（*Lila rubriker* 的意思是“紫色标题”。）切换回 `main`，看看 `style.css`：

```sh
git switch main
tail -3 style.css
```

紫色不见了！当你切换分支时，git 会把工作区改写成该分支最新提交的样子。这项修改安全地保存在 `ny-design` 中。`git log --oneline --all` 会显示所有分支：

```sh
git log --oneline --all
```

> **提示：** 旧的教程经常使用 `git checkout ny-design` 和 `git checkout -b new-branch`。`checkout` 和 `switch` 做的是同一件事，但它还能恢复文件。较新的命令 `switch` 和 `restore` 把这些工作分开了，更容易记住。

切换分支时，未提交的修改会被一起带过去——除非它们和另一个分支冲突。这时 git 会拒绝切换，并要求你先提交（或者用 `git stash` 把修改暂时放到一边，之后再用 `git stash pop` 取回来）。

## 合并分支：`git merge`

先站在要*接收*修改的分支上——这里是 `main`——然后合并：

```sh
git merge ny-design
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward*（快进）表示自从创建分支以来，`main` 没有发生变化。这时 git 只需要把 `main` 向前移动到和 `ny-design` 相同的提交即可。

如果两个分支都有新的提交，git 就会做**三方合并**（three-way merge）：它把两个分支和它们的共同祖先进行比较，并创建一个新的、有两个父提交的*合并提交*（merge commit）。`git log --oneline --graph --all` 会显示历史是如何分叉、又如何重新汇合的：

```text
*   e4b1d0a (HEAD -> main) Merge branch 'rubrik'
|\
| * 7c3f9e2 (rubrik) Vänligare rubrik
* | 52d8a71 Kortare text
|/
* c19e2f4 Lila rubriker
```

合并完的分支就不再需要了，可以删除。如果该分支中有尚未进入当前分支的提交，`-d` 会拒绝删除：

```sh
git branch -d ny-design
```

## 冲突

如果两个分支修改了*同样的行*，git 就无法知道哪个版本才是对的。这叫做**冲突**（conflict），这时由你来决定。我们故意制造一个冲突（*rubrik* 是瑞典语的“标题”）：

```sh
git switch -c rubrik
sed -i 's/Välkommen!/Hej och välkommen!/' index.html
git commit -am "Vänligare rubrik"
git switch main
sed -i 's/Välkommen!/Välkommen till min sida!/' index.html
git commit -am "Längre rubrik"
git merge rubrik
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

别紧张——什么都没坏。`git status` 会把这个文件列在 *Unmerged paths*（未合并的路径）下，标记为 `both modified`。看看文件里面：

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>Välkommen till min sida!</h1>
=======
  <h1>Hej och välkommen!</h1>
>>>>>>> rubrik
```

`<<<<<<< HEAD` 和 `=======` 之间是你的版本（你当前所在的分支）；`=======` 和 `>>>>>>> rubrik` 之间是另一个分支的版本。解决冲突的方法如下：

1. 在编辑器中打开文件，把它改成你想要的样子——选其中一行，或者把两行结合起来——然后删掉那些标记行。
2. 用 `git add FILE` 告诉 git 冲突已经解决。
3. 用 `git commit` 完成合并。

模拟器中没有真正的编辑器，不过如果你只是想选用某一方的版本，git 可以替你完成：`--ours` 选用你的版本，`--theirs` 选用另一个分支的版本。

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Slå ihop grenen rubrik"
```

如果你在解决冲突的过程中改变了主意，`git merge --abort` 会让你回到合并之前的状态。

当多人在同一个项目上工作时，冲突是再正常不过的事。想减少冲突，一个好办法是多做小提交、经常合并。

## git 应该忽略的文件：`.gitignore`

有些文件永远不应该进入历史记录：密码和密钥、日志、临时文件，以及自动构建出来的东西。把它们的名字或匹配模式写进仓库根目录下的 `.gitignore` 文件：

```sh
echo 'password=secret' > hemligt.txt
echo 'error' > fel.log
printf 'hemligt.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`hemligt.txt`（瑞典语的“秘密.txt”）和 `fel.log`（“错误.log”）不再显示了——连 `git add .` 也不会把它们加进去。`*` 可以匹配任意内容，末尾的斜杠（`build/`）表示整个目录。而 `.gitignore` 本身则应该提交，这样参与项目的每个人都会忽略同样的东西：

```sh
git add .gitignore
git commit -m "Ignorera hemligheter och loggar"
```

注意，`.gitignore` 只对 git 还没有跟踪的文件起作用。如果某个文件已经被提交过了，可以用 `git rm --cached FILE` 把它从仓库中移除（但不会从磁盘上删除）。

## GitHub、GitLab 和远程仓库

到目前为止，一切都只存在于你自己的仓库里。为了协作，或者仅仅是为了有个备份，人们通常会在服务器上保存一份仓库的副本——这就是**远程仓库**（remote）。最知名的服务有 **GitHub**、**GitLab** 和 **Codeberg**。

| 命令 | 作用 |
|---|---|
| `git clone URL` | 把整个仓库连同全部历史下载到一个新目录中 |
| `git push` | 把你的新提交发送到远程仓库 |
| `git pull` | 从远程仓库获取新提交，并与你的提交合并 |
| `git fetch` | 获取新提交，但不进行任何合并 |
| `git remote -v` | 列出远程仓库 |

远程仓库通常叫 `origin`，典型的工作流程是这样的：开始工作时先 `git pull`，然后编辑、`git add` 和 `git commit`——最后 `git push`。GitHub 和 GitLab 用 SSH 密钥或访问令牌（access token）来登录，而不是密码。

这一切都需要网络，而模拟器没有网络。不过 `clone`、`push` 和 `pull` 在同一台计算机上的两个仓库之间同样能用，所以你还是可以试一试。把你的项目克隆到一个新目录中：

```sh
cd ~
git clone ~/projekt-webb ~/kopia
cd ~/kopia
git log --oneline
git remote -v
```

像 GitHub 这样的服务器上只有历史，没有工作区。这样的*裸仓库*（bare repository）用 `git init --bare` 创建。假装它就是你的 GitHub 账户，把 `main` 推送过去：

```sh
git init --bare ~/server.git
cd ~/projekt-webb
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` 会把你的 `main` 和 `origin/main` 关联起来，这样 `git status` 就能告诉你，你是领先还是落后于服务器；而且从此以后，只需输入 `git push` 和 `git pull` 就够了。

## 小结

| 命令 | 作用 |
|---|---|
| `git init` | 把目录变成一个仓库 |
| `git status` | 显示当前状态——要经常运行！ |
| `git add FILE` / `git add .` | 把修改放进暂存区 |
| `git commit -m "…"` | 把暂存区保存为一个新提交 |
| `git diff` / `git diff --staged` | 显示尚未提交的修改 |
| `git log --oneline --graph --all` | 显示历史 |
| `git restore FILE` | 丢弃某个文件中的修改 |
| `git switch -c BRANCH` | 创建一个分支并切换过去 |
| `git merge BRANCH` | 把一个分支合并到当前分支 |
| `git clone`、`git pull`、`git push` | 通过远程仓库进行协作 |
