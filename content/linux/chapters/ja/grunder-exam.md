# テスト: 基本

次の問題に答えて、このパートで学んだことを確かめましょう。

```quiz
次のうち、**絶対** パスはどれですか？
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `{{documents}}`
---
絶対パスはルートの `/` から始まります。ほかは今いるディレクトリから始まります。
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
`..` 1 つで 1 階層上がります。`/var/log` から `/var` へ、そして `/` へ移ります。
```

```quiz
`cd -` は何をしますか？
- [ ] 1 階層上がる
- [ ] ホームディレクトリに移る
- [x] 直前にいたディレクトリに戻る
```

```quiz
ディレクトリ `{{pictures}}` を中身ごと `{{pictures}}-copy` にコピーしたいです。どのコマンドを使えばよいですか？
- [ ] `cp {{pictures}} {{pictures}}-copy`
- [x] `cp -r {{pictures}} {{pictures}}-copy`
- [ ] `mv {{pictures}} {{pictures}}-copy`
---
ディレクトリは `-r`（*recursive*、再帰的）を付けてコピーします。`mv` だと
コピーではなく移動になります。
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` は `a`、`a/b`、`a/b/c` を一度に作るので、`a/b` には `c` が入っています。
```

```quiz
引用符を付けずに `touch my file.txt` と入力しました。どうなりますか？
- [ ] `my file.txt` という名前のファイルが 1 つできる
- [x] `my` と `file.txt` の 2 つのファイルができる
- [ ] 名前にスペースが含まれているので、何も起こらない
---
シェルは行をスペースで区切るので、`touch` は 2 つの引数を受け取ります。
ファイルを 1 つにするには `touch "my file.txt"` と書きます。
```

```quiz
`grep -i error {{documents}}/server.log` はどの行を表示しますか？
- [ ] 小文字の `error` を含む行だけ
- [ ] 大文字の `ERROR` を含む行だけ
- [x] 大文字と小文字がどう混ざっていても、`error` を含む行
```

```quiz
ログファイルを見張って、新しい行が書き込まれるたびに表示したいです。どのコマンドが合っていますか？
- [ ] `head -n 10 {{documents}}/server.log`
- [x] `tail -f {{documents}}/server.log`
- [ ] `wc -l {{documents}}/server.log`
---
`tail -f` はファイルを *追いかけます*（follow）。**Ctrl+C** で止めます。
```

```quiz
オプションを付けずにファイルを渡すと、`wc` は何を表示しますか？
- [ ] 行数だけ
- [x] 行数、単語数、バイト数
- [ ] ファイルの先頭 10 行
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` で `b` を追記しましたが、最後の `>` がファイル全体を上書きしました。
```

```quiz
`a || b` で、`b` が実行されるのはいつですか？
- [ ] `a` のあと、必ず
- [ ] `a` が成功したときだけ
- [x] `a` が失敗したときだけ
```

```try
grep ERROR ~/{{documents}}/server.log | tee errors.txt | wc -l
---
`tee` はエラーの行を `errors.txt` に保存し、`wc -l` に渡しました。`wc -l` が
その行数を数えました。
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` でカンマを区切り文字にし、`-f2` でフィールド 2 を残します。
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` はその行のフィールドの数です。フィールドはスペースで区切られています。
```

```quiz
`'{print $3}'` のような awk のプログラムを **シングル** クォートで囲むべきなのはなぜですか？
- [ ] awk はダブルクォートを読めないから
- [x] そうしないと、シェルが `$3` をシェル変数だと思い、awk が起動する前に置き換えてしまうから
- [ ] シングルクォートにすると awk が速く動くから
```
