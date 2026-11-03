# テスト: その他のツール

git とほかのシェルについての 14 問です。合格には 80 % の正解が必要です。
コマンドを使う問題は新しいターミナルで始まるので、まず必要なプログラムを
インストールします。`> /dev/null 2>&1` は、それらの行の出力を捨てています。

```quiz
`index.html` を変更し、新しいファイル `contact.html` を作りました。
`git commit -am "Contact page"` を実行すると、コミットには何が入りますか？
- [x] `index.html` の変更だけ
- [ ] `contact.html` だけ
- [ ] 両方のファイル
---
`-a` は、git がすでに追跡している変更済みのファイルをすべて追加しますが、
新しいファイルは決して追加しません。`contact.html` は先に `git add` で追加する
必要があります。
```

```quiz
`style.css` の変更に `git add` を実行しました。その変更を表示するコマンドは
どれですか？
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` は作業ツリーとインデックスを比べるので、変更がインデックスに入ると
何も表示しません。`--staged` はコミットを待っているものを表示します。
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
ブランチを作ってから `main` は変わっていなかったので、マージは
*fast-forward*（早送り）になりました。git は `main` を `{{newDesign}}` の
コミットまで進めただけです。マージコミットは作られませんでした。
```

```quiz
技術的に言うと、git のブランチとは何ですか？
- [ ] プロジェクトのすべてのファイルの完全なコピー
- [x] あるコミットを指し、新しいコミットをすると一緒に動いていくラベル
- [ ] 独自の `.git` ディレクトリを持つ別のリポジトリ
---
だから git のブランチは手軽なのです。どんどん使いましょう。
```

```quiz
`git merge` が `index.html` のコンフリクトで止まりました。ファイルを直して、
マーカーの行を消しました。次に何をしますか？
- [ ] もう一度 `git merge` を実行する
- [x] `git add index.html` を実行し、そのあと `git commit` を実行する
- [ ] `git restore index.html`
---
`git add` はコンフリクトが解決したことを git に伝え、`git commit` でマージが
完了します。`git restore` だと、せっかくの修正を捨ててしまいます。
```

```quiz
ファイル `error.log` を間違えてコミットしてしまいました。`.gitignore` に `*.log`
を追加しましたが、git はまだファイルを追跡しています。ディスクには残したまま、
リポジトリから取り除くにはどうしますか？
- [ ] `rm error.log`
- [x] `git rm --cached error.log`
- [ ] `git restore error.log`
---
`.gitignore` は、git がまだ追跡していないファイルにだけ効きます。`--cached` は
ファイルを git から取り除きますが、ディスクには残します。
```

```quiz
リモートから新しいコミットを、自分のものとマージ **せずに** 取得するコマンドは
どれですか？
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` は取得してマージし、`git fetch` は取得するだけです。
```

```quiz
次のうち、完全に失われてしまう変更はどれですか？当てはまるものをすべて選んでください。
- [x] 一度もコミットしていないファイルの変更を、`git restore` で捨てた
- [x] 一度もコミットしていない変更を、`git reset --hard` で捨てた
- [ ] `git reset --hard` を実行する前の、昨日作ったコミット
---
一度でもコミットしたものは、ほとんどの場合救い出せます。`git reflog` で、
これまでいた場所がわかります。
```

```quiz
bash から zsh を起動しました。今実行しているシェルを表示するコマンドはどれですか？
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` はログインシェルで、今も `/bin/bash` のままです。`/etc/shells` には、
ログインシェルとして使ってよいシェルが書かれています。
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` は小数を扱えます。
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
fish では、最後のコマンドの終了ステータスは `$status` という名前です。`false`
は必ず失敗します。
```

```quiz
fish で、`EDITOR` を値 `nano` の環境変数にするにはどうしますか？
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` は変数をエクスポートし、`-e` は変数を消去します。
```

```quiz
zsh は起動するときにどのファイルを読みますか？
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep {{user}} /etc/passwd
---
行の最後のフィールドがログインシェルです。`chsh -s` が変更するのはこれです。
```
