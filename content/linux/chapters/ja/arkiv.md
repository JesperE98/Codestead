# アーカイブと圧縮

遅かれ早かれ、ディレクトリをまるごと誰かに送ったり、バックアップを取ったり、
プログラムのソースコードをダウンロードしたりしたくなるでしょう。そのときは、
たくさんのファイルを **1 つの** ファイルに、できればもっと小さなファイルに
まとめる必要があります。Linux では、ふつう 2 つの別々のプログラムが協力して
これを行います。

## アーカイブと圧縮は別のもの

- **アーカイブ** とは、たくさんのファイルやディレクトリを 1 つのファイル、
  つまり *アーカイブ* にまとめることです。パーミッション、所有者、タイムスタンプも
  一緒に保存されます。使うプログラムは `tar`（*tape archive* の略で、1970 年代に
  テープドライブ用に作られました）です。アーカイブは中のファイルより **小さく
  なりません**。むしろ大きくなるくらいです。
- **圧縮** とは、繰り返しをうまく符号化してファイルを小さくすることです。
  最もよく使われるプログラムは `gzip` です。一度に 1 つのファイルしか扱えず、
  ディレクトリのことは何も知りません。

そのため、この 2 つは組み合わせて使われます。まず `tar` で 1 つのファイルに
まとめ、次に `gzip` で小さくします。その結果は `.tar.gz`、または短く `.tgz`
と呼ばれます。これはまさに Unix 哲学そのものです。それぞれが 1 つのことをこなし、
組み合わせて使える小さなプログラムです。

```quiz
`tar` と `gzip` がふつう組み合わせて使われるのはなぜですか？
- [ ] `gzip` は `tar` が作っていないファイルを読めないから
- [x] `tar` がたくさんのファイルを 1 つにまとめ、`gzip` がその 1 つのファイルを小さくするから
- [ ] `tar` がファイルを小さくし、`gzip` が正しいパーミッションを付けるから
---
gzip は一度に 1 つのファイルしか扱えず、ディレクトリのことは何も知りません。
また、tar アーカイブそのものは中のファイルより小さくなりません。
```

| 拡張子 | 何のファイル？ | 展開方法 |
|---|---|---|
| `.tar` | 圧縮されていないアーカイブ | `tar -xf` |
| `.gz` | 圧縮された 1 つのファイル | `gunzip` |
| `.tar.gz`, `.tgz` | 圧縮されたアーカイブ | `tar -xzf` |
| `.zip` | アーカイブと圧縮を兼ねたもの（Windows でよく使われる） | `unzip` |

`.tar.xz`、`.tar.bz2`、`.tar.zst` もよく見かけます。考え方は同じですが、
別の圧縮プログラム（`xz`、`bzip2`、`zstd`）を使っています。

## `tar` でまとめる

ホームディレクトリに移動して、`dokument` ディレクトリをまとめてみましょう。

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/betyg.csv
dokument/frukter.txt
dokument/server.log
```

`-c` は *アーカイブを作成する*、`-v` は tar に処理内容を表示させる、`-f` は
次にアーカイブファイルの名前が来ることを意味します。アーカイブ名の後ろに
書いたものは、ファイルでもディレクトリでも、いくつでもまとめられます。

> **注意！** 順序は *アーカイブが先、ファイルが後* です。
> `tar -cvf dokument dokument.tar` のように順序を間違えると、tar はディレクトリ
> を上書きしようとします。さらに悪い場合は、残しておきたかったファイルを
> 上書きしてしまいます。

## 覚えておきたいオプション

| オプション | 由来 | 意味 |
|---|---|---|
| `c` | **c**reate | 新しいアーカイブを作成する |
| `x` | e**x**tract | 展開する |
| `t` | lis**t**（*table of contents*） | 内容を一覧表示する |
| `v` | **v**erbose | 処理中のファイルを表示する |
| `f` | **f**ile | 次にアーカイブファイルの名前が来る |
| `z` | g**z**ip | gzip で圧縮・展開する |

`c`、`x`、`t` のうち、ちょうど **1 つ** を必ず指定します。これが tar に *何を*
するかを伝えます。残りは動作を調整するものです。よく使われる覚え方は次の
とおりです。

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

オプションをまとめて書くときは、`f` を必ず **最後** に置きましょう。ファイル名は
`f` の直後に来なければならないからです。歴史的な理由から、ダッシュを省略する
こともできます。`tar czvf` は `tar -czvf` と同じ意味です。

```quiz
`tar -xzvf backup.tar.gz` は何をしますか？
- [ ] 圧縮されたアーカイブ `backup.tar.gz` を作成する
- [ ] `backup.tar.gz` を展開せずに内容を一覧表示する
- [x] gzip を使って `backup.tar.gz` を展開し、ファイルを 1 つずつ表示する
---
`x` が操作（展開）、`z` は gzip、`v` はファイルの表示を意味し、`f` の後には
アーカイブの名前が続きます。
```

## `-z` で圧縮する

`z` を加えると、アーカイブは作成途中で gzip を通ります。

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   837 Oct 30 12:00 dokument.tar.gz
```

ファイルの合計は 1,000 バイトを少し超える程度なのに、圧縮していないアーカイブは 10,240 バイトも
あります。これは、tar が各ファイルの前に 512 バイトのヘッダーを置き、
アーカイブをブロック単位まで埋めるからです。その空きスペースはすべて gzip が
圧縮して取り除いてくれます。

`du` コマンド（*disk usage*）は、何かがディスク上でどれだけの容量を使っているか
を表示します。`-h` で人間が読みやすいサイズに、`-s` でディレクトリ全体の
合計になります。

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
16K	dokument
```

ディスクは 4 KiB 単位のブロックに分かれているので、空でないファイルについて
`du` が `4.0K` 未満を表示することはありません。正確なサイズを見るには、
`ls -l`（または `ls -lh`）を使いましょう。

## 展開する前にアーカイブの中を見る

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev       146 2026-10-30 12:00 dokument/betyg.csv
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

`v` を付けると、`ls -l` と同じようにパーミッション、所有者、サイズ付きで内容が
表示されます。先に中を見るのはよい習慣です。アーカイブの中には共通の
最上位ディレクトリがなく、展開したときにいる場所に何百ものファイルを
まき散らしてしまうものもあるからです。

## 展開する

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C`（大文字の C）で tar が展開する先のディレクトリを選びます（*uppackat* は
スウェーデン語で「展開済み」という意味です）。これがないと、すべて今いる
ディレクトリに展開されます。最近の tar は、展開するときにアーカイブが
圧縮されているかどうかを自動で判別するので、`tar -xf dokument.tar.gz` でも
展開できます。

> **注意！** tar は、すでに存在するファイルを上書きする前に確認しません。
> 不安なときは、先に内容を一覧表示しましょう。

### 絶対パス

絶対パスをまとめると、どこにでも展開できるように先頭の `/` が取り除かれます。

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

このアーカイブには `home/elev/dokument/...` が入っています。アーカイブに
`dokument/` だけを入れたい場合は、`-C` を使って先に tar にディレクトリを
移動させます。

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

```quiz
`tar -czf backup.tar.gz -C ~ dokument` を実行しました。アーカイブには何が入っていますか？
- [x] `dokument/` とその中のファイル
- [ ] `home/elev/dokument/` とその中のファイル
- [ ] `/home/elev/dokument/` とその中のファイル
---
`-C ~` によって tar はまずホームディレクトリに移動するので、アーカイブ内の
名前は `dokument/` から始まります。
```

## `gzip` で 1 つのファイルを圧縮する

`gzip` はファイルを圧縮し、元のファイルを `.gz` ファイルに **置き換えます**。
パーミッションとタイムスタンプは保持されます。

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` は圧縮前後のサイズを表示し、`gunzip` はファイルを元に戻します。

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

元のファイルを残しておきたい場合は `gzip -k`（*keep*）を使います。とても小さな
ファイルで試してみましょう。実は **大きく** なってしまいます。gzip はファイル名
などを含むヘッダーを追加するからです。

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

```predict
$ cp dokument/frukter.txt .
$ cp dokument/server.log .
$ gzip frukter.txt
$ gzip -k server.log
$ ls frukter* server*
frukter.txt.gz  server.log  server.log.gz
---
ただの `gzip` はファイルを `.gz` ファイルに置き換えます。`-k` を付けると元のファイルが残ります。
```

### 圧縮されたファイルを直接読む

`/var/log` にある古いログファイルは、容量を節約するために `.gz` で保存されて
いることがよくあります。`zcat` を使えば展開せずに読めます。その結果は、
いつもどおりパイプで次へ渡せます。

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` は `gzip -dc` と同じで、展開（`d`）して標準出力（`c`）に出します。
本物のシステムには `zless` や `zgrep` もあります。

## zip – Windows とのやり取りに

`.zip` 形式は、ファイルをまとめることと圧縮することの両方を一度に行います。
Windows と macOS は追加のソフトウェアなしで zip ファイルを開けるので、Linux を
使っていない人にファイルを送るときにはこれが定番です。Linux の世界では、
所有者やパーミッションをよりよく保持できる `.tar.gz` のほうが一般的です。

`zip` と `unzip` のプログラムは、最初からインストールされているとは限らず、
このターミナルでは先にインストールする必要があります。それにはパッケージ
マネージャーを使います。詳しくはディストリビューションとパッケージのパートで
学びます。Ubuntu では次のようにします。

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` は、利用できるパッケージの一覧をダウンロードします。これをしないと、
apt はパッケージを 1 つも見つけられません。

次にディレクトリをまとめます。`-r`（*recursive*）を忘れないでください。
これがないと、zip は空のディレクトリだけを追加し、中のファイルは追加しません。

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/betyg.csv (deflated 17%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

順序は tar と同じで、アーカイブが先、ファイルが後です。`unzip -l` で内容を
一覧表示し、`-d` で展開先を選びます（ディレクトリが存在しなければ作成されます）。

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

ファイルがすでに存在する場合、unzip はそれをスキップします。`unzip -o` を使うと
上書きします。

```quiz
`-r` を付けずに `zip dokument.zip dokument` を実行しました。zip ファイルには何が入りますか？
- [ ] `dokument` の中のすべてのファイル
- [x] 空のディレクトリ `dokument/` だけ
- [ ] 何も入らない。zip は実行を拒否する
---
`-r`（*recursive*）がないと、zip はディレクトリの中に入っていきません。
```

## まとめ

| やりたいこと | コマンド |
|---|---|
| ディレクトリをまとめて圧縮する | `tar -czvf archive.tar.gz directory` |
| アーカイブの中身を確認する | `tar -tzvf archive.tar.gz` |
| アーカイブを展開する | `tar -xzvf archive.tar.gz`（`-C directory` を追加） |
| ファイルを圧縮する | `gzip file`（または `gzip -k file`） |
| `.gz` ファイルを展開する | `gunzip file.gz` |
| `.gz` ファイルを直接読む | `zcat file.gz` |
| zip ファイルを作成・展開する | `zip -r archive.zip directory` · `unzip archive.zip` |
| 何かの大きさを調べる | `du -sh directory` · `ls -lh` |
