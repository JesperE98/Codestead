# ほかのシェル: zsh と fish

ここまで、あなたはすべてのコマンドを **bash** で入力してきました。しかし bash は
いくつもあるシェルの 1 つにすぎず、ほかのシェルを好む人もたくさんいます。
この章では、人気のある 2 つの選択肢、**zsh** と **fish** をインストールして
試し、bash とどう違うのかを見ていきます。また、なぜスクリプトはいまでも
ほとんどの場合 bash 向けに書かれるのかも学びます。

## そもそもシェルとは？

**シェル** は、あなたが入力したものを読み取り、解釈し、ほかのプログラムを
起動するプログラムです。`|`、`>`、`$VARIABLES`、`*.txt` のようなワイルドカード、
そしてループを理解するのはシェルです。ターミナルは、シェルが動いている
ウィンドウにすぎません。

`ls`、`grep`、`cat` のようなプログラムは `/usr/bin` にある独立したプログラムで、
どのシェルを使っても同じように動きます。シェルによって違うのは、**それらを
取り巻く言語** です。変数の設定方法、ループや条件の書き方、プロンプトの見た目、
そしてどんな便利機能があるか、といったことです。

```quiz
bash から別のシェルに切り替えました。次のうち、まったく変わらないものはどれですか？
- [ ] 変数の設定方法
- [ ] ループの書き方
- [x] `grep` がオプションに応じてすること
- [ ] プロンプトの見た目
---
`grep` は `/usr/bin` にある独立したプログラムです。シェルはそれを起動するだけで、
シェルによって違うのはそれを取り巻く言語のほうです。
```

## 系統図: sh、bash、zsh、fish

| シェル | 登場 | 特徴 |
|---|---|---|
| `sh` | 1979 | Bourne シェル。今日の `sh` は **POSIX** 標準に従っていて、最小公倍数的な存在。 |
| `bash` | 1989 | *Bourne Again SHell*。ほぼすべての Linux ディストリビューションの既定。 |
| `zsh` | 1990 | おおむね bash 互換だが、機能がもっと多い。macOS の既定。 |
| `fish` | 2005 | *Friendly interactive shell*。使いやすいが、**独自の構文** を持つ。 |

**POSIX** は、`sh` シェルがどう振る舞うべきかを定めた標準です。POSIX の機能
だけを使ったスクリプトは、`sh` 互換のどのシェルでも動きます。bash、zsh、
`dash`（Debian と Ubuntu の `/bin/sh`）、そして `ash`（Alpine のような小さな
システム）です。fish はあえて POSIX 互換に **していません**。それが fish を
シンプルにしている理由ですが、同時にほかと違う点でもあります。

## どのシェルがインストールされている？

`/etc/shells` ファイルには、ログインシェルとして使ってよいシェルが
書かれています。

```sh
cat /etc/shells
```

ログインしたときにどのシェルになるかは、`/etc/passwd` にあるあなたの行の
最後のフィールドで決まり、変数 `$SHELL` にも入っています。

```sh
grep {{user}} /etc/passwd
echo $SHELL
```

## zsh – おまけ付きの bash

### zsh をインストールする

Ubuntu のターミナルでは、zsh は apt でインストールします。

```sh
sudo apt update
sudo apt install zsh
```

ほかのディストリビューションでは、ディストリビューションとパッケージのパートで
学んだように、それぞれのパッケージマネージャーを使います。パッケージ名は
そこでも `zsh` です。

もう一度 `/etc/shells` を見てみましょう。パッケージが `/usr/bin/zsh`（と
`/bin/zsh`）を追加しています。

```sh
cat /etc/shells
```

### zsh を起動する

シェルもほかと同じプログラムなので、名前を入力すれば zsh が起動します。

```sh
zsh
```

最初は **zsh-newuser-install** が出迎えてくれます。まだ zsh の設定ファイルが
ないからです。これは使い始めを手伝ってくれるメニューです。

| キー | 機能 |
|---|---|
| `q` | 何もせずに終了する（次回また尋ねられる） |
| `0` | ほぼ空の `~/.zshrc` を作成する |
| `1` | すべての設定があるメインメニュー（シミュレーターでは使えない） |
| `2` | おすすめの設定で `~/.zshrc` を作成する |

`2` と答えてください。プロンプトが `{{user}}@ubuntu ~ %` に変わります。
zsh では、`%` が一般ユーザーを表すふつうの記号です（root は bash と同じく
`#` になります）。

いま動いているのはどのシェルでしょうか？ 変数 `$0` にはシェルの名前が
入っています。

```sh
echo $0
ps
```

`ps` を見ると、zsh が bash の **中で** 動いていることがわかります。bash が
新しいプロセスとして zsh を起動したのです。また、`$SHELL` は相変わらず
`/bin/bash` のままであることにも注目してください。この変数が教えてくれるのは
あなたの *ログインシェル* で、いまたまたま動かしているシェルではありません。

```sh
echo $SHELL
```

### ほとんどのことは bash と同じ

zsh は bash の構文のほとんどを理解します。パイプ、リダイレクト、変数、`if`、
`for`、関数は、慣れているとおりに動きます。

```sh
for f in ~/{{documents}}/*.txt; do wc -l $f; done
```

### 機能 1: `**` ですべてのサブディレクトリを検索

zsh では、`**/` は「すべての階層のすべてのディレクトリ」を意味します。次の
コマンドは、ホームディレクトリとその下にあるすべての `.txt` ファイルを
一覧表示します。

```sh
ls ~/**/*.txt
```

bash では、先に `shopt -s globstar` で有効にしない限り、`**` はふつうの `*` と
同じように動きます。

### 機能 2: autocd

`autocd` オプション（おすすめの設定に含まれています）を使うと、ディレクトリの
名前を入力するだけでそこへ移動できます。`cd` は不要です。

```sh
{{documents}}
..
```

オプションは `setopt` と `unsetopt` でオン・オフします。

```sh
setopt
unsetopt autocd
setopt autocd
```

### 注意すべき違い: 変数が分割されない

bash では、引用符で囲まれていない変数は空白で分割されます。zsh では
分割されません。

```sh
files="a.txt b.txt"
for f in $files; do echo "[$f]"; done
```

bash は `[a.txt]` と `[b.txt]` を出力しますが、zsh は `[a.txt b.txt]` を
出力します。たいていは zsh のやり方のほうが望ましいのですが、bash の
スクリプトが zsh で同じ動きをするとは限らない、ということでもあります。
（`setopt shwordsplit` を使うと、zsh は bash と同じように振る舞います。）

1 つのコマンドを試すためだけに、わざわざシェルを起動する必要はありません。
`-c` を付けると、シェルはそのコマンドを実行してすぐに終了します。
`zsh -c 'echo $0'` は `zsh` と表示し、そのあとも bash にいたままです。

次の問題は新しいターミナルで始まるので、まず zsh をインストールします。
`> /dev/null 2>&1` はその行の出力を捨てます。最後のコマンドは何を表示しますか？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'files="x.txt y.txt z.txt"; for f in $files; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
zsh は変数をスペースで分割しないので、ループは値全体で 1 回だけ実行されます。
bash なら同じループが `<x.txt>`、`<y.txt>`、`<z.txt>` の 3 行を表示します。
```

### ~/.zshrc とプロンプト

bash は起動時に `~/.bashrc` を読みますが、zsh は `~/.zshrc` を読みます。
zsh-newuser-install が作ったファイルを見てみましょう。

```sh
cat ~/.zshrc
```

プロンプトは変数 `PROMPT` で設定し、`%` で始まるコードを使います。

| コード | 意味 |
|---|---|
| `%n` | ユーザー名 |
| `%m` | コンピューターの名前 |
| `%~` | ディレクトリ全体（ホームディレクトリは `~`） |
| `%1~` | ディレクトリの最後の部分だけ |
| `%#` | 一般ユーザーなら `%`、root なら `#` |
| `%F{green}` … `%f` | 色（red、green、blue、yellow など） |

試してみましょう。

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

この変更は zsh を抜けるまでしか続きません。毎回この設定にしたいなら、
この行を `~/.zshrc` に書いてください。

### Oh My Zsh

多くの zsh ユーザーは、テーマとプラグインのコレクションである **Oh My Zsh** を
インストールしています。たとえば、プロンプトに Git の情報を表示したり、
タブ補完を強化したり、入力中に候補を出したりできます。プロジェクトの
Web サイトにあるスクリプトでインストールし、`~/.zshrc` で設定します。
シミュレーターでは使えませんが、これで人が Oh My Zsh の話をしているときに
何のことかわかるようになりました。

### bash に戻る

zsh は bash の中で動いているプロセスです。`exit` で抜けると bash に戻ります。
zsh で設定した変数やエイリアス、ディレクトリの移動は消えています。

```sh
exit
echo $0
```

## fish – フレンドリーな対話型シェル

fish は、設定なしですぐに使いやすいことを目指しています。色、タブ補完、そして
**オートサジェスト** です。fish は履歴をもとに、コマンドの残りの部分を灰色の
文字で提案してくれます。右矢印キーで提案を受け入れられます。（シミュレーター
では提案は表示されませんが、構文は動きます。）

### fish をインストールして起動する

fish も同じように apt でインストールします。ほかのディストリビューションでは、
それぞれのパッケージマネージャーを使います。

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

fish があいさつしてくれて、プロンプトが `{{user}}@ubuntu ~>` になります。
いくつか下のディレクトリへ移動して、fish がプロンプトのパスをどう短縮するか
見てみましょう。

```sh
mkdir -p ~/{{documents}}/{{project}}
cd ~/{{documents}}/{{project}}
cd ~
```

ディレクトリ `~/{{documents}}/{{project}}` では、プロンプトに `~/d/{{project}}>` と表示されます。
最後以外のディレクトリは、すべて 1 文字に短縮されるのです。

### fish には独自の構文がある

fish が bash や zsh と最も違うのはここです。

| やりたいこと | bash と zsh | fish |
|---|---|---|
| 変数を設定する | `{{fruitVar}}={{fruitWord}}` | `set {{fruitVar}} {{fruitWord}}` |
| 環境変数 | `export EDITOR=nano` | `set -x EDITOR nano` |
| 変数を削除する | `unset {{fruitVar}}` | `set -e {{fruitVar}}` |
| コマンド置換 | `$(pwd)` | `(pwd)` |
| 直前の終了ステータス | `$?` | `$status` |
| スクリプトの引数 | `$@`, `$1` | `$argv`, `$argv[1]` |
| 条件 | `if …; then …; fi` | `if …; …; end` |
| ループ | `for …; do …; done` | `for …; …; end` |
| 関数 | `hello() { …; }` | `function hello; …; end` |
| 算術 | `$((17 * 23))` | `math 17 x 23` |

### set で変数を設定する

bash のやり方で変数を設定してみましょう。

```sh
{{fruitVar}}={{fruitWord}}
```

fish は拒否して、どう書けばよいかを教えてくれます。

```text
fish: Unsupported use of '='. In fish, please use 'set {{fruitVar}} {{fruitWord}}'.
```

fish では次のように書きます。

```sh
set {{fruitVar}} {{fruitWord}}
echo ${{fruitVar}}
set -x EDITOR nano
set -e {{fruitVar}}
```

`-x`（*export*）は変数を環境変数にし、起動したプログラムから見えるようにします。
`-e`（*erase*）は変数を削除します。

fish では、どの変数も **リスト** です。要素には 1 から番号が付きます。

```sh
set fruits りんご なし バナナ
echo $fruits[2]
count $fruits
```

`-c` は fish でも使えます。最後のコマンドは何を表示しますか？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set fruits りんご なし バナナ; echo $fruits[3]'
バナナ
---
fish のリストの要素には 1 から番号が付くので、`[3]` は 3 番目、つまり最後の要素です。
```

### コマンド置換と $status

fish では、コマンド置換はただの丸かっこで書きます。

```sh
echo "I am in" (pwd)
```

引用符の中では、丸かっこはただの文字です。だから `(pwd)` は引用符の外に
あるのです。直前のコマンドの終了ステータスは `$status` という名前です。
`false` は失敗する以外に何もしない小さなコマンドで、終了ステータスは常に 1 です。

```sh
false
echo $status
```

### and、or、not

fish には、条件をつなげるための専用のコマンドがあります。

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

新しいバージョンの fish（3.0 以降）は `&&` と `||` も理解し、3.4 からは
`$(...)` も使えます。しかし `X=1`、`$?`、`$((...))` はいまでも使えません。
使うとエラーになり、fish ではどう書くかを教えてくれます。

### ブロックは end で終わる

fish では、すべてのブロック（`if`、`for`、`while`、`switch`、`function`）は
`end` で終わります。`then`、`do`、`done`、`fi` はありません。

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

ブロックを複数行に分けて書くこともできます。シェルは `end` を待ってから
ループを実行します。

```sh
for f in ~/{{documents}}/*.txt
echo (basename $f)
end
```

関数は、引数をリスト `$argv` で受け取ります。

```sh
function hello; echo "Hello $argv!"; end
hello Kim
```

### math で算術

fish には `$((...))` がありません。代わりに `math` コマンドがあり、小数も
扱えます。

```sh
math 17 x 23
math 10 / 4
```

掛け算には `x`（または引用符で囲んだ `"17 * 23"`）を書きます。単独の `*` は、
bash と同じく fish でもワイルドカードになるからです。

### fish の設定

fish は起動時に `~/.config/fish/config.fish` を読みます。あいさつの
メッセージを消したいなら、変数 `fish_greeting` を空にします。`-U` を付けると
変数は **ユニバーサル** になります。`~/.config/fish/fish_variables` に
保存され、再起動したあとも、すべての fish シェルで有効になります。

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

`exit` で fish を抜けます。

```sh
exit
```

## なぜスクリプトはいまでも bash で書かれるのか

ターミナルでどのシェルを使うかは好みの問題です。しかし **スクリプト** は、
ほとんどの場合 bash（または POSIX の `sh`）向けに書かれます。

- bash は事実上すべての Linux システムにインストールされていますが、zsh と
  fish はそうではありません。
- fish の構文は bash では動きませんし、その逆も同じです。
- スクリプトの先頭の `#!` 行が、どのシェルでスクリプトを実行するかを決めます。
  あなたがいまどのシェルを使っているかには **関係ありません**。

bash のスクリプトを書いて、fish から実行してみましょう。

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

`name=Kim` は fish では禁止されているのに、このスクリプトは fish から動きます。
実行しているのが bash だからです。だからこそ `#!/bin/bash`（または
`#!/usr/bin/env bash`）がとても重要なのです。bash がない場所も含めて、
どこでも動かなければならないスクリプトは、`#!/bin/sh` と POSIX の構文だけで
書きます。

```quiz
fish を使っているときに、`#!/bin/bash` で始まり `count=3` という行を含む
スクリプトを実行しました。どうなりますか？
- [ ] fish では `count=3` が許されないので、fish が拒否する
- [x] 動く。あなたがどのシェルを使っていても、スクリプトを実行するのは bash だから
- [ ] 先に `chsh` でログインシェルを bash に変えたときだけ動く
---
どのシェルでスクリプトを実行するかは `#!` 行で決まります。fish はそれを起動するだけです。
```

## chsh で既定のシェルを変更する

ターミナルを開くたびに `zsh` と入力するのは面倒になってきます。`chsh`
（*change shell*）を使うと、**ログインシェル**、つまり `/etc/passwd` に
書かれているシェルを変更できます。

```sh
chsh -s /usr/bin/zsh
grep {{user}} /etc/passwd
```

- シェルはフルパスで指定し、`/etc/shells` に書かれている必要があります。
- `chsh` はパスワードを尋ねます（シミュレーターでは省略されます）。
- 変更が有効になるのは **次にログインしたとき** です。開いているターミナルは
  古いシェルのままで、`$SHELL` もログインし直すまで変わりません。
- root はほかのユーザーのシェルも変更できます: `sudo chsh -s /usr/bin/fish kim`。

bash に戻すには、同じようにします。

```sh
chsh -s /bin/bash
```

fish についてよくあるアドバイスは、ログインシェルは bash のままにして、
代わりにターミナルのプログラムに fish を起動させる、というものです。そうすれば、
ログイン時に POSIX シェルを前提とするものもすべて動き続けます。

この問題は新しいターミナルで始まり、zsh をインストールしてログインシェルにします。
最後のコマンドは何を表示しますか？

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
`chsh` は `/etc/passwd` にあるあなたの行を変更しましたが、変更が有効になるのは
次にログインしたときです。開いているターミナルは bash のままで、`$SHELL` も同じです。
```

## どのシェルを選ぶべき？

- **bash** – どこでも既定のシェル。ここで学んだことは、これからログインする
  どのサーバーでも通用します。スクリプトは bash 向けに書きましょう。
- **zsh** – もっと快適さがほしいけれど、bash の構文はそのまま使いたい人に。
  Oh My Zsh でテーマやプラグインが手に入ります。
- **fish** – 箱から出してすぐの使い心地は最高ですが、構文が違います。
  Web からコピーしたコマンドが動かないこともあります。
- **sh/dash** – どこでも動かなければならないスクリプトや、小さなシステムに。

## まとめ

| コマンド | 機能 |
|---|---|
| `cat /etc/shells` | 使ってよいシェルを一覧表示する |
| `echo $0` / `ps` | いま動いているシェルを確認する |
| `echo $SHELL` | ログインシェルを確認する |
| `zsh` / `fish` / `exit` | 別のシェルを起動する / 戻る |
| `ls ~/**/*.txt` | すべてのサブディレクトリを検索する（zsh、fish） |
| `setopt autocd` | zsh のオプションを有効にする |
| `set {{fruitVar}} {{fruitWord}}` | fish で変数を設定する |
| `set -x NAME value` | fish で環境変数を設定する |
| `chsh -s /usr/bin/zsh` | ログインシェルを変更する |

設定ファイルは、`~/.bashrc`（bash）、`~/.zshrc`（zsh）、
`~/.config/fish/config.fish`（fish）です。
