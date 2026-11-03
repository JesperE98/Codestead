# SSH でファイルをコピーする

ネットワークの章では、`ssh` を使ってサーバー `192.168.1.10` でコマンドを
実行しました。この章では、サーバーに短い名前を付け、`scp` でサーバーとの間で
ファイルをコピーし、`rsync` でディレクトリ全体を同期させます。

## 短い名前 – `~/.ssh/config`

毎回 `ssh {{user}}@192.168.1.10` と入力するのは面倒です。`~/.ssh/config`
ファイルで、サーバーに短い名前を付けられます。

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` は短い名前、`HostName` は本当のアドレス（または名前）、`User` は
サーバー上のユーザー名です。サーバーが 22 以外のポートで待ち受けている場合は、
`Port 2222` のような行を追加します。あとはこれだけで十分です。

```sh
ssh srv hostname
```

シミュレーターにはまだテキストエディターがないので、`echo` でファイルを
書きます。字下げは読みやすくするためだけのものです。

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh はこのファイルに厳しいです。ほかの人が書き込めるようになっていると、ssh は
*Bad owner or permissions* と言って拒否しますし、単語を 1 つ書き間違えただけで
すぐに止まります。

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh は接続する前にファイル全体を読むので、単語を 1 つ間違えるだけで、すべての
接続が止まります。エラーメッセージには、それが何行目かが書かれています。
```

この名前は `scp` と `rsync` でも使えます。

```quiz
`~/.ssh/config` で、ssh が本当に接続する先を指定するのはどの行ですか？
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` は自分で入力する短い名前、`HostName` は本当のアドレス、`User` は
誰としてログインするかです。
```

## コピーする – `scp`

`scp`（*secure copy*）は `cp` のように動きますが、片方を別のコンピューターに
することができます。それは `HOST:PATH` と書きます。

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- `cp` と同じように、コピー元が先で、コピー先が最後です。
- コロンの後ろのパスはサーバー上のホームディレクトリから数えられ、`srv:` だけなら
  ホームディレクトリを意味します。
- ディレクトリには `-r` が必要です。
- ポートは大文字の `-P` で指定します（`ssh` では小文字の `-p` です）。

`scp` はファイルごとに、名前、`100%`、サイズ、速度を書いた行を表示します。

```quiz
コロンを付けずに `scp report.txt srv` と入力しました。何が起きますか？
- [ ] ファイルがサーバー上のホームディレクトリにコピーされる
- [x] `srv` という名前のローカルのコピーができる
- [ ] scp がどのコンピューターのことかを尋ねてくる
---
コロンがないと、`srv` はただのファイル名なので、`scp` は `cp` のように
ローカルでコピーします。コロンは忘れやすいので気をつけましょう！
```

## 同期を保つ – `rsync`

ファイルがたくさんあるときや、何度も繰り返しコピーするもの（バックアップ！）
には、`rsync` のほうが向いています。足りないものや変更されたものだけを
コピーするからです。

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a`（*archive*）はディレクトリを再帰的にコピーし、パーミッションと時刻を
保ちます。`-v` はコピーしたものを一覧表示します。同じコマンドをもう一度
実行すると、一覧は空になります。何も変わっていないからです。rsync は
それぞれのファイルのサイズと更新時刻を比べます。`-a` がないとコピーには
新しい時刻が付くので、毎回すべてが送られます。

### 最後のスラッシュ

コピー元の最後にスラッシュがあるかどうかは重要です。

| コマンド | 結果 |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – ディレクトリそのもの |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – 中にあるものだけ |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
スラッシュがないので、ディレクトリそのものが `/tmp/x` の中にコピーされました。
```

### SSH 経由と `--delete`

コピー先がサーバーなら、rsync は ssh を通して動きます。

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` は、コピー元にもう存在しないファイルをコピー先からも削除するので、
コピー先は完全なコピーになります。そのため、パスを間違えると多くのものが
消えかねません。まず `-n`（*dry run*）で試しましょう。実際には何も起こらず、
rsync は何をするかを表示するだけで、最後の行は `(DRY RUN)` で終わります。

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
`rsync -avn --delete a/ b/` の `-n` は何をしますか？
- [ ] 新しいファイルだけをコピーする
- [x] 何も実行せずに、何が起きるかを表示する
- [ ] 削除されるはずのファイルを飛ばす
---
`-n` は試し実行です。まず一覧を確認し、それから `-n` を付けずに
同じコマンドを実行します。
```

## scp と rsync のどちらを使う？

| | `scp` | `rsync` |
|---|---|---|
| 向いている用途 | 少しのファイルを 1 回だけ | バックアップや繰り返しのコピー |
| 送るもの | 毎回すべて | 変更されたものだけ |
| ローカルでも | 使えるが、`cp` のほうが簡単 | 使える |
| `--delete` でミラー | できない | できる |

`scp` は ssh クライアントに付いてきます。`rsync` は両方のコンピューターに
インストールされている必要があります。Ubuntu、Debian、Fedora には最初から
入っていますが、Arch ではパッケージ `rsync` をインストールします。

シミュレーターでは、アプリを閉じるとサーバーは自分のファイルを忘れてしまいます。
