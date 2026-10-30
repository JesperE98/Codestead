# ファイルとディレクトリ

移動のしかたがわかったので、今度はファイルやディレクトリを作成・コピー・移動・
削除してみましょう。

## ディレクトリを作成する – `mkdir`

```sh
mkdir bilder2
```

複数の階層を一度に作りたい場合は `-p`（*parents*）が必要です。
これがないと、親ディレクトリが存在しないときに `mkdir` がエラーを出します。

```sh
mkdir -p resa/2026/juni
```

## 空のファイルを作成する – `touch`

`touch` は、ファイルが存在しなければ空のファイルを作成します（存在する場合は
タイムスタンプを更新するだけです）。

```sh
touch inkopslista.txt
```

```quiz
ファイルがすでに存在する場合、`touch anteckningar.txt` は何をしますか？
- [ ] ファイルを空にする
- [ ] ファイルがすでにあるとエラーを出す
- [x] ファイルのタイムスタンプを更新するだけで、内容はそのまま
```

## コピーする – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

コピー先がディレクトリの場合、コピーは同じ名前でそのディレクトリの中に
作られます。ディレクトリ全体をコピーするには `-r`（*recursive*）が必要です。

```sh
cp -r dokument dokument-backup
```

```predict
$ mkdir kopior
$ cp anteckningar.txt kopior
$ ls kopior
anteckningar.txt
---
`kopior` はディレクトリなので、コピーは同じ名前でその中に作られます。
```

## 移動と名前の変更 – `mv`

Linux では、*移動* と *名前の変更* は同じことです。`mv` はその両方を行います。

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

```quiz
`b.txt` というファイルはありません。`mv a.txt b.txt` は何をしますか？
- [ ] `a.txt` を `b.txt` にコピーする
- [x] `a.txt` の名前を `b.txt` に変える
- [ ] `b.txt` が存在しないので失敗する
---
移動と名前の変更は同じことです。実行後には `b.txt` だけが残ります。
```

## 削除する – `rm` と `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` は *空の* ディレクトリを削除します。中身ごとディレクトリを削除するには
`rm -r` を使います。

```sh
rm -r dokument-backup
```

> **注意！** ターミナルにはごみ箱がありません。`rm` で削除したものは
> 二度と戻りません。`rm -rf`（*recursive, force*）コマンドは何も確認せず、
> エラーも出しません。Enter を押す前に、必ずパスを再確認しましょう。

```quiz
ディレクトリ `gammalt` が空の場合 *だけ* 削除するコマンドはどれですか？
- [ ] `rm gammalt`
- [x] `rmdir gammalt`
- [ ] `rm -r gammalt`
---
`rmdir` は、中に何か残っているディレクトリの削除を拒否します。
`rm -r` はディレクトリを中身ごと削除します。
```

## ワイルドカード

シェルは、コマンドを実行する前にパターンを複数のファイル名に展開できます。

| パターン | 一致するもの |
|---|---|
| `*` | 何でも（0 文字以上） |
| `?` | ちょうど 1 文字 |
| `[abc]` | a、b、c のいずれか 1 文字 |

ホームディレクトリにある `dokument` ディレクトリには、`betyg.csv`、`frukter.txt`、
`server.log` の 3 つのファイルがあります。次のコマンドは `.txt` で終わるものだけを
一覧表示します。

```sh
ls dokument/*.txt
```

ここで `ls` がアスタリスクを目にすることはありません。シェルがすでに
`dokument/*.txt` を一致するすべてのファイル名に置き換えているからです。

```predict
$ ls dokument/?????.*
dokument/betyg.csv
---
`?` はそれぞれちょうど 1 文字なので、ドットの前の名前は 5 文字でなければなりません。
それに当てはまるのは `betyg` だけです。`frukter` と `server` はそれより長いからです。
```

## ファイル名の中のスペース

シェルはコマンドラインをスペースで区切ります。ファイル名にスペースが含まれる
場合は、引用符で囲む（またはスペースの前に `\` を付ける）必要があります。

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

そのため、ファイル名にはハイフンやアンダースコアを使う人が多いのです。
