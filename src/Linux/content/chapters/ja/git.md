# ターミナルで Git

`report-final.txt`、`report-final-2.txt`、`report-REALLY-final.txt` といった
名前でファイルを保存したことはありませんか？　それなら、あなたはすでに手作業で
*バージョン管理* をしたことがあります。バージョン管理システムは、同じことを
きちんと行ってくれます。プロジェクト全体のスナップショットを保存し、誰が何を
なぜ変更したのかを記録し、過去にさかのぼれるようにし、大勢の人が同じファイルで
同時に作業できるようにしてくれます。

**Git** は、群を抜いて最も広く使われているバージョン管理システムです。2005 年に
Linux カーネルの作者でもある Linus Torvalds が、カーネルのソースコードを管理
するために書きました。今日では git はほぼすべてのソフトウェアで使われていますが、
Web ページ、設定ファイル、メモ、本などにも同じようにうまく使えます。テキストで
あれば何でもぴったりです。

Git はターミナルのために作られています。グラフィカルなプログラムやエディターにも
git のボタンがありますが、内部ではここで学ぶのと同じコマンドを実行しています。

## git をインストールする

Git は最初からインストールされているとは限りません。Ubuntu のターミナルでは、
apt でインストールします。

```sh
sudo apt update
sudo apt install git
```

ほかのディストリビューションでは、ディストリビューションとパッケージのパートで
学んだように、それぞれのパッケージマネージャーでインストールします。パッケージ名は
そこでも `git` です。動作することを確認しましょう。

```sh
git --version
```

git のコマンドはすべて `git コマンド` という形をしています。たとえば
`git status` や `git log` です。マニュアルは `man git` で読めます。

## 自分が誰なのかを git に伝える

git に保存されるバージョンには、それを作った人の名前とメールアドレスが含まれて
います。そのため git は、何かを保存する前に、あなたが誰なのかを知りたがります。
これはコンピューターごとに 1 回だけ設定します。

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

自分の名前を使ってもかまいません。`--global` は、その設定がすべてのプロジェクト
に適用されるという意味です。設定は普通のテキストファイル `~/.gitconfig` に保存
されます。

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

この手順を忘れると、保存しようとしたときに git が
`*** Please tell me who you are.` と文句を言い、まさにこの 2 つのコマンドを
提案してくれます。

> **ヒント:** `git config --global init.defaultBranch main` も追加しておき
> ましょう。そうすれば、どのコンピューターでも、新しいプロジェクトのメイン
> ブランチは `main` という名前になります。古いバージョンの git では `master`
> と呼ばれているので、世の中では両方の名前を目にするはずです。

## 新しいリポジトリ

ホームディレクトリには、3 つのファイルからなる小さな Web プロジェクト
`~/{{webProject}}` があります。そこへ移動して、中を見てみましょう。

```sh
cd ~/{{webProject}}
ls
```

git にこのディレクトリを追跡させるには、ディレクトリを **リポジトリ**（略して
*リポ*）にします。

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

起きたのは、隠しディレクトリ `.git` が作られたことだけです。git はそこに履歴の
すべてを保管します。あなたのファイルには手を触れません。

```sh
ls -a
ls .git
```

履歴を失いたくなければ、`.git` は決して削除しないでください。また、
その中のファイルを手で編集してもいけません。あるプロジェクトで git を使うのを
やめたいときは、`.git` を削除するだけで十分です。普通のファイルはそのまま
残ります。

```quiz
あるプロジェクトで git を使うのはやめたいけれど、ファイルはすべて残したいとします。どうしますか？
- [ ] もう一度 `git init` を実行する
- [x] 隠しディレクトリ `.git` を削除する
- [ ] `.git` 以外のファイルをすべて削除する
---
履歴はすべて `.git` の中にあり、git は普通のファイルには手を触れません。
`.git` がなくなってもファイルは残り、なくなるのは履歴だけです。
```

## 3 つの場所: 作業ツリー、インデックス、履歴

git について理解すべき最も大切なことは、変更が 3 つの場所を通っていくという
ことです。

```text
 working tree  ──git add──▶  index  ──git commit──▶  history
 （目に見えるファイル）    （次のコミット）          （.git）
```

- **作業ツリー**（working tree）は、いまの状態のファイル、つまりあなたが編集
  するファイルです。
- **インデックス**（*ステージングエリア* とも呼ばれます）は、いわば荷造り用の
  テーブルです。次に保存するバージョンに入れるものをここに置きます。
- **履歴** は **コミット** の集まりです。コミットとは、メッセージ、作成者、
  日時の付いた、すべてのファイルの保存済みスナップショットです。

なぜ中間のステップがあるのでしょう？　選べるようにするためです。5 つのファイルを
変更したけれど、まとまりがあるのはそのうち 2 つだけ、という場合、その 2 つだけを
インデックスに入れてコミットし、残りは別のコミットに回せます。

```quiz
5 つのファイルを変更しましたが、まとまりがあるのはそのうち 2 つの変更だけです。
その 2 つだけをコミットに保存するにはどうしますか？
- [ ] 先に `git commit` を実行し、そのあと 2 つのファイルに `git add` を実行する
- [x] 2 つのファイルに `git add` を実行してから、`git commit` を実行する
- [ ] 5 つすべてをコミットする。コミットは変更されたファイルを必ずすべて含む
---
コミットはインデックスにあるものを保存します。残りの 3 つの変更は、追加するまで
作業ツリーに残ります。
```

## `git status` は羅針盤

いちばんよく実行することになるコマンドは `git status` です。変更がそれぞれどこに
あるのかを教えてくれますし、次に何をすればよいかを提案してくれることもよく
あります。少なすぎるより、多すぎるくらい実行しましょう！

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

*Untracked files*（追跡されていないファイル）は、git から見えてはいるものの、
まだ追跡していないファイルです。本物のターミナルでは赤で表示されます。
`git add` でインデックスに入れましょう。

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

今度は *Changes to be committed* の下に（緑で）表示されています。ファイルを
1 つずつ指定する代わりに、`git add .` と入力することもできます。これはカレント
ディレクトリにあるものをすべて追加します（ドットは「ここ」という意味です）。
`git add -A` はリポジトリ全体のすべての変更を追加します。

## 最初のコミット

`git commit` でスナップショットを保存します。`-m` オプションでメッセージを
指定します。

```sh
git commit -m "{{commitFirst}}"
```

```text
[main (root-commit) 3f2a9c1] {{commitFirst}}
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

メッセージは何語で書いてもかまいません。`3f2a9c1` はコミットの
**ID** の先頭部分です。ID は内容から計算される 40 文字の *ハッシュ* です。日時や
あなたの名前も計算に含まれるので、あなたの ID は違うものになります。コミットを
特定するには、たいてい最初の 7 文字で十分です。

もう一度 `git status` を実行してみましょう。

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* は、すべてが保存済みという意味です。いいですね！

## 何が変わったかを見る: `git diff`

`README.md` に 1 行追加して、何が起きたのかを git に聞いてみましょう。

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 8699aba..719c66c 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 gitでバージョン管理している小さなウェブサイトです。
+{{builtWith}}
```

`+` で始まる行は新しい行（緑）、`-` で始まる行は削除された行
（赤）で、残りは文脈として表示されています。`@@ -1,3 +1,4 @@` は、古い
バージョンの 1～3 行目が、新しいバージョンの 1～4 行目に対応するという意味です。

`git diff` は作業ツリーとインデックスを比較します。つまり、*まだ* 追加していない
ものを表示します。インデックスに入っていてコミットを待っているものを見るには、
`git diff --staged` と入力します。

変更を追加してコミットしましょう。`-a` オプションは、git がすでに追跡している
すべてのファイルに対して `git add` を実行するので、1 回の操作で済みます。

```sh
git commit -a -m "{{commitDescribe}}"
```

`-a` は、git がまだ追跡していない新しいファイルを含め *ない* ことに注意して
ください。新しいファイルは、必ず先に `git add` で追加する必要があります。

この章のコマンド付きの問題は新しいターミナルで始まるので、まず git をインストール
して最初のコミットを作ります。`> /dev/null 2>&1` は、リダイレクトとパイプの章で
学んだように、それらの行の出力を捨てます。最後のコマンドは何を表示しますか？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ echo 'もう1行。' >> README.md
$ git commit -m "もう1行" > /dev/null
$ git log --oneline | wc -l
1
---
2 つ目のコミットは作られませんでした。`README.md` の変更はインデックスに
入っていなかったので、コミットするものが何もなかったのです。先に
`git add README.md` を実行するか、`git commit -a` を使えば、コミットは 2 つになっていました。
```

## よいコミットメッセージ

半年後、何があったのかを（あなた自身にも他の人にも）語ってくれるのはコミット
メッセージです。いくつかの目安を挙げます。

- 変更を要約した短い 1 行目を書きましょう。できれば 50 文字以内にします。
- 変更が *何を* するのか、できれば *なぜ* なのかを書き、*どう* 書いたのかは
  書かないようにします。
- 1 つのコミットでは 1 つのことをします。大きなコミット 1 つより、小さな
  コミット 3 つのほうがよいのです。
- もっと説明が必要ですか？　空行を 1 行空けて、その下に長い文章を書きましょう。
  `-m` はそれぞれ別の段落になります: `git commit -m "Title" -m "Explanation."`

| 悪い例 | よりよい例 |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

英語では、メッセージはふつう命令形で書きます: *Add contact form*、
*Fix broken link*。「このコミットは …… する」と読めるようにするためです。
日本語で書くなら「お問い合わせフォームを追加」のように、体言止めで簡潔に書く
のが一般的です。

## 履歴を見る

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: {{gitName}} <{{user}}@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    {{commitDescribe}}

commit 3f2a9c1...
```

最新のコミットが最初に表示されます。`HEAD -> main` は、あなたがブランチ `main`
にいて、これがそのブランチの最新のコミットだという意味です。便利な使い方を
いくつか紹介します。

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` はコミットごとに 1 行で表示し、`-n 1` は最新のものだけを表示し、
`--stat` はどのファイルが変更されたかを表示し、`git show` は変更内容そのものを
含めてコミットを表示します。特定のコミットの時点でファイルがどうなっていたかを
見ることもできます: `git show HEAD~1:README.md`（`HEAD~1` は「最新の 1 つ前の
コミット」という意味です）。

## 元に戻す

git では元に戻すのが簡単です。それが git の存在意義の半分なのです。

| やりたいこと | コマンド |
|---|---|
| ファイルの（まだ追加していない）変更を捨てる | `git restore FILE` |
| ファイルをインデックスから外す（変更は残る） | `git restore --staged FILE` |
| 最新のコミットのメッセージを変える | `git commit --amend -m "New message"` |
| すべてを最新のコミットの状態に戻す | `git reset --hard` |

ファイルを壊してから、元に戻してみましょう。

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **注意！** `git restore FILE` と `git reset --hard` は、一度もコミットされて
> いない変更を捨てます。それは取り戻せません。一方、一度でもコミットしたもの
> は、ほぼ必ず救い出せます。これまでどこにいたのかを `git reflog` に聞いて
> みましょう。

## ブランチ

**ブランチ** とは、独立した開発の流れのことです。`main` にある動作中の
バージョンに触れずに、ブランチで新しいアイデアを試せます。うまくいけば
ブランチを `main` にマージし、だめなら捨ててしまいます。

技術的には、ブランチはコミットを指しているラベルにすぎず、新しいコミットを
作るとそれに合わせて移動します。だからこそ git のブランチは軽いのです。
どんどん使いましょう！

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` は、
ブランチを作成してそこへ切り替えます。`git branch` のアスタリスクは、いまどこに
いるのかを示しています。変更を加えて、そのブランチでコミットしましょう。

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

`main` に戻って、
`style.css` を見てみましょう。

```sh
git switch main
tail -3 style.css
```

紫色が消えています！　ブランチを切り替えると、git は作業ツリーをそのブランチの
最新のコミットの状態に書き換えます。変更は `{{newDesign}}` に安全に残っています。
`git log --oneline --all` ですべてのブランチを表示できます。

```sh
git log --oneline --all
```

> **ヒント:** 古い解説では、よく `git checkout {{newDesign}}` や
> `git checkout -b new-branch` が使われています。`checkout` は `switch` と
> 同じことをしますが、ファイルを復元することもできます。新しいコマンドの
> `switch` と `restore` は役割を分けているので、覚えやすくなっています。

コミットしていない変更は、ブランチを切り替えるときに一緒に付いてきます。
ただし、もう一方のブランチと衝突する場合は別です。その場合 git は切り替えを拒否し、
先にコミットするよう求めます（または、`git stash` で変更を一時的に退避し、
`git stash pop` で戻すこともできます）。

元の `style.css` には `purple` はありません。見出しは navy（紺色）です。
最後に、`style.css` には `purple` を含む行がいくつありますか？

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
$ grep purple style.css | wc -l
0
---
purple の行は `{{newDesign}}` でコミットされました。`main` に切り替えると、git は
作業ツリーを `main` の最新のコミットと同じ状態にします。そこにはまだその行が
ありません。
```

## ブランチをマージする: `git merge`

変更を *受け取る* ほうのブランチ（ここでは `main`）にいる状態で、マージします。

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward*（早送り）は、ブランチを作ってから `main` が変わっていないという
意味です。その場合 git は、`main` を `{{newDesign}}` と同じコミットまで進めるだけで
済みます。

両方のブランチに新しいコミットがある場合、git は **3-way マージ** を行います。
両方のブランチを共通の祖先と比較し、親を 2 つ持つ新しい *マージコミット* を
作ります。`git log --oneline --graph --all` を使うと、履歴が分かれて再び合流する
様子がわかります。

```text
*   e4b1d0a (HEAD -> main) Merge branch 'heading'
|\
| * 7c3f9e2 (heading) 見出しをもっと親しみやすく
* | 52d8a71 テキストを短く
|/
* c19e2f4 {{commitPurple}}
```

マージしたブランチはもう必要ないので、削除できます。`-d` は、いまいるブランチに
含まれていないコミットがそのブランチにある場合、削除を拒否します。

```sh
git branch -d {{newDesign}}
```

## コンフリクト

両方のブランチが *同じ行* を変更した場合、git にはどちらのバージョンが正しいのか
わかりません。これを **コンフリクト**（衝突）と呼び、その場合はあなたが決めます。
わざと 1 つ起こしてみましょう。

```sh
git switch -c heading
sed -i 's/ようこそ!/こんにちは、ようこそ!/' index.html
git commit -am "見出しをもっと親しみやすく"
git switch main
sed -i 's/ようこそ!/私のサイトへようこそ!/' index.html
git commit -am "見出しを長く"
git merge heading
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

落ち着いてください。何も壊れていません。`git status` は、このファイルを
*Unmerged paths* の下に `both modified` として表示します。中を見てみましょう。

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>私のサイトへようこそ!</h1>
=======
  <h1>こんにちは、ようこそ!</h1>
>>>>>>> heading
```

`<<<<<<< HEAD` と `=======` のあいだがあなたのバージョン（いまいるブランチ）、
`=======` と `>>>>>>> heading` のあいだがもう一方のブランチのバージョンです。
コンフリクトは次のようにして解決します。

1. エディターでファイルを開いて、望む形に直します。どちらかの行を選んでも、
   組み合わせてもかまいません。そして目印の行を削除します。
2. `git add FILE` で、コンフリクトを解決したことを git に伝えます。
3. `git commit` でマージを完了します。

シミュレーターには本物のエディターはありませんが、どちらか一方のバージョンを
選ぶだけなら、git が代わりにやってくれます。`--ours` はあなたのバージョンを、
`--theirs` はもう一方のブランチのバージョンを採用します。

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "ブランチ heading をマージ"
```

コンフリクトの途中で気が変わったら、`git merge --abort` でマージ前の状態に
戻れます。

複数の人が同じプロジェクトで作業していれば、コンフリクトはまったく普通のこと
です。コンフリクトを減らすよい方法は、小さなコミットを作って、こまめにマージする
ことです。

```quiz
`main` にいるときに `git merge heading` を実行しました。ファイルにコンフリクトが起きています。

    <<<<<<< HEAD
      <h1>Hello!</h1>
    =======
      <h1>Welcome!</h1>
    >>>>>>> heading

`main` から来ている行はどれですか？
- [x] `<h1>Hello!</h1>`
- [ ] `<h1>Welcome!</h1>`
---
`HEAD` はいまいるブランチ、ここでは `main` です。そのバージョンは
`<<<<<<< HEAD` と `=======` のあいだにあり、もう一方のブランチのバージョンは
`=======` の後ろに来ます。
```

## git に無視させるファイル: `.gitignore`

履歴に決して入れてはいけないファイルもあります。パスワードや鍵、ログ、一時
ファイル、自動的に生成されるものなどです。それらの名前やパターンを、リポジトリの
ルートにある `.gitignore` というファイルに書きます。

```sh
echo 'password=secret' > secret.txt
echo 'error' > error.log
printf 'secret.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`secret.txt` と `error.log` はもう表示されません。
`git add .` でさえ拾いません。`*` は何にでもマッチし、末尾のスラッシュ
（`build/`）はディレクトリ全体を意味します。一方、`.gitignore` 自体はコミット
すべきです。そうすれば、プロジェクトで作業する全員が同じものを無視できます。

```sh
git add .gitignore
git commit -m "秘密のファイルとログを無視する"
```

`.gitignore` が効くのは、git がまだ追跡していないファイルだけであることに注意
してください。すでにコミットされたファイルは、`git rm --cached FILE` で
リポジトリから（ディスクからではなく）削除します。

## GitHub、GitLab とリモートリポジトリ

ここまでは、すべてが自分のリポジトリの中だけで行われていました。共同作業をする
ため、あるいは単にバックアップのために、たいていはリポジトリのコピーをサーバーに
置きます。これを **リモート** と呼びます。最も有名なサービスは **GitHub**、
**GitLab**、**Codeberg** です。

| コマンド | 働き |
|---|---|
| `git clone URL` | リポジトリ全体を、すべての履歴とともに新しいディレクトリにダウンロードする |
| `git push` | 新しいコミットをリモートに送る |
| `git pull` | リモートから新しいコミットを取得し、自分のコミットとマージする |
| `git fetch` | 何もマージせずに新しいコミットを取得する |
| `git remote -v` | リモートを一覧表示する |

リモートはふつう `origin` という名前で、典型的な作業の流れは次のようになります。
作業を始めるときに `git pull`、それから編集して `git add` と `git commit`、
最後に `git push` です。GitHub や GitLab へのログインには、パスワードではなく
SSH 鍵かアクセストークンを使います。

これにはすべてネットワークが必要ですが、シミュレーターにはネットワークがありま
せん。それでも、`clone`、`push`、`pull` は同じコンピューター上の 2 つの
リポジトリのあいだでも同じように動くので、試してみることはできます。プロジェクト
を新しいディレクトリにクローンしましょう。

```sh
cd ~
git clone ~/{{webProject}} ~/copy
cd ~/copy
git log --oneline
git remote -v
```

GitHub のようなサーバーには履歴だけがあり、作業ツリーはありません。このような
*ベア*（bare）リポジトリは `git init --bare` で作ります。これを自分の GitHub
アカウントだと思って、`main` をそこへプッシュしましょう。

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` はあなたの `main` を `origin/main` と結び付けます。これにより、
`git status` はあなたがサーバーより進んでいるか遅れているかを教えてくれるように
なり、以後は単に `git push` や `git pull` と入力するだけで済むようになります。

## まとめ

| コマンド | 働き |
|---|---|
| `git init` | ディレクトリをリポジトリにする |
| `git status` | 状態を表示する（こまめに実行しよう！） |
| `git add FILE` / `git add .` | 変更をインデックスに入れる |
| `git commit -m "…"` | インデックスを新しいコミットとして保存する |
| `git diff` / `git diff --staged` | コミットしていない変更を表示する |
| `git log --oneline --graph --all` | 履歴を表示する |
| `git restore FILE` | ファイルの変更を捨てる |
| `git switch -c BRANCH` | ブランチを作成して切り替える |
| `git merge BRANCH` | ブランチを、いまいるブランチにマージする |
| `git clone`、`git pull`、`git push` | リモートを通じて共同作業する |
