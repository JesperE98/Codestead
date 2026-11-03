# テスト: スクリプトと自動化

シェルスクリプトについての問題に答えてください。合格には 80 % が必要です。

```quiz
スクリプトの 1 行目 `#!/bin/bash` は何をしますか？
- [ ] シェルが読み飛ばすコメントである
- [x] どのプログラムでファイルを実行するかをシステムに伝える
- [ ] ファイルを実行可能にする
---
これは *シバン*（shebang）と呼ばれます。ファイルを実行可能にするには、やはり
`chmod +x` が必要です。
```

```quiz
`{{nameVar}} = Kim` は `command not found` というエラーになります。なぜですか？
- [x] `=` の前後のスペースのせいで、シェルが `{{nameVar}}` をコマンドとして扱うから
- [ ] 変数名は大文字で書かなければならないから
- [ ] `${{nameVar}} = Kim` と書かなければならないから
```

`~/{{documents}}` には、練習用の 3 つのファイル `{{fruits}}`、`{{grades}}`、
`server.log` が入っています。

```predict
$ count=$(ls ~/{{documents}} | wc -l)
$ echo "$count files"
3 files
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
スクリプトの中で `"$@"` には何が入っていますか？
- [ ] 引数の数
- [ ] スクリプトの名前
- [x] すべての引数。1 つずつ別々に
```

```quiz
`n` に入っている数値が 10 より大きいときに真になるテストはどれですか？
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
数値は `-eq`、`-lt`、`-gt` などで比較します。`=` と `<` はテキストを比較します。
```

```predict
$ [ -d ~/{{missing}} ] && echo yes || echo no
no
```

```predict
$ file=report.txt
$ case $file in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` はすぐに次の周回へ進むので、`3` は表示されません。
```

```quiz
関数の中で `local` は何をしますか？
- [x] 関数の中だけに存在する変数を作る
- [ ] 関数を速く動かす
- [ ] 終了コードを付けて関数を終える
```

```quiz
何かがうまくいかなかったとき、スクリプトが `exit 1` で終わるのはなぜですか？
- [ ] スクリプトを再起動するため
- [x] スクリプトを呼び出した側が、終了コードから失敗したことを知れるようにするため
- [ ] 数字の 1 を表示するため
```

```quiz
`cat > {{helloScript}} << '{{heredocEnd}}'` でヒアドキュメントを始めました。いつ終わりますか？
- [ ] 空の行で Enter を押したとき
- [x] `{{heredocEnd}}` の行で
- [ ] 10 行のあと
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```

```quiz
毎週日曜日の 23:45 に `~/backup.sh` を実行する crontab の行はどれですか？
- [ ] `23 45 * * 0 ~/backup.sh`
- [x] `45 23 * * 0 ~/backup.sh`
- [ ] `45 23 0 * * ~/backup.sh`
---
分が先で、次に時です。つまり 45 23 です。日曜日は曜日の 0（または 7）で、
5 番目のフィールドに書きます。
```
