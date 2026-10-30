# テスト: システム管理

サービス、ディスク、ユーザーについて学んだことを確かめましょう。問題は
このパート全体から出題され、合格には 80 % の正解が必要です。

```quiz
`minserver` をコンピューターが起動するたびに自動的に開始させたいですが、今すぐ
開始しては **いけません**。ちょうどそのとおりにするコマンドはどれですか？
- [ ] `sudo systemctl start minserver`
- [x] `sudo systemctl enable minserver`
- [ ] `sudo systemctl enable --now minserver`
- [ ] `sudo systemctl restart minserver`
---
`enable` は起動時に、`start` は今すぐ効き、`--now` はその両方を行います。
```

このコンピューターでは、サービス `rapportd` の起動が失敗しています。次の
コマンドは何を表示しますか？

```predict
$ systemctl is-active rapportd
failed
---
`is-active` は一語だけを表示します。ここでは `systemctl --failed` が一覧表示する
のと同じ状態です。終了ステータスが 0 になるのは、答えが `active` のときだけです。
```

```quiz
`minserver` をテストしながらそのログを見張り、新しい行が届くたびに表示させたい
です。どのコマンドを使いますか？
- [ ] `journalctl -n 20`
- [x] `journalctl -u minserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status minserver --all`
---
`-u` は 1 つのユニットを選び、`-f` は Ctrl+C を押すまで新しい行を表示し続けます。
```

```try
systemctl cat minserver
---
`ExecStart=` はサービスを起動するコマンドで、`WantedBy=` は `enable` が使う
ものです。
```

```quiz
`sudo` を付けずに `systemctl stop minserver` を実行したところ、
*Interactive authentication required* と表示されました。なぜですか？
- [ ] minserver が動いていないから
- [x] サービスを変更することにはすべて root 権限が必要だから
- [ ] 先に `daemon-reload` を実行する必要があるから
- [ ] `stop` は有効化されたサービスにしか使えないから
```

```quiz
`/etc/fstab` に `/dev/sda2` ではなく、たいてい `UUID=…` と書かれているのは
なぜですか？
- [ ] UUID のほうが短くて入力しやすいから
- [x] デバイス名はディスクを追加すると変わることがあるが、UUID は決して変わらないから
- [ ] `mount` はデバイス名を理解できないから
- [ ] UUID はファイルシステムの使用率を示すから
---
UUID はファイルシステムと一緒に作られます。`lsblk -f`、`blkid`、`findmnt` で
調べられます。
```

```quiz
`df -h` を見ると、`/` が 98 % 埋まっています。**どのディレクトリ** が容量を
使っているのかを探すのに役立つコマンドはどれですか？
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` はファイルシステムにどれだけ埋まっているかを尋ね、`du` はファイルを
たどって合計します。
```

このコンピューターでは、ホームディレクトリは独立したファイルシステムに
ありません。次のコマンドは何を表示しますか？

```predict
$ df -h ~ | awk 'NR > 1 {print $6}'
/
---
パスを渡すと、`df` はそのパスがあるファイルシステムだけを表示します。6 番目の
列は `Mounted on` で、ここではルートファイルシステムです。
```

```quiz
`/etc/fstab` に 1 行追加しました。再起動する **前に** 何をするべきですか？
- [ ] 何もしない。このファイルは起動時にしか読まれない
- [x] `sudo mount -a` でテストする
- [ ] `sudo systemctl daemon-reload` を実行する
- [ ] `mkfs` でパーティションをフォーマットする
---
`/etc/fstab` に誤りがあると、コンピューターが正しく起動しなくなることが
あります。`mount -a` はファイルに書かれていて、まだマウントされていないものを
すべてマウントするので、今のうちにエラーがわかります。
```

```quiz
実際のコンピューターで、`mkfs` を使ってパーティションをフォーマットしようと
しています。まず何を確認するべきですか？（当てはまるものをすべて選んでください。）
- [x] `lsblk -f` で、サイズ、`RM` 列、ラベルが合っていること
- [x] パーティションがマウントされていないこと
- [x] 大切なものすべてのバックアップがあること
- [ ] パーティションが `/etc/fstab` に書かれていること
```

```quiz
パスワードのハッシュが `/etc/passwd` ではなく `/etc/shadow` にあるのはなぜですか？
- [ ] `/etc/passwd` が小さすぎるから
- [x] `/etc/passwd` は誰でも読めなければならないが、`/etc/shadow` は root だけが読めればよいから
- [ ] ハッシュは元に戻せるので、隠す必要があるから
- [ ] `/etc/passwd` は起動時にしか読まれないから
---
そうでなければ、誰でもハッシュをコピーして、時間をかけて解読を試みることが
できてしまいます。`ls -l` が所有者の名前を表示するには `/etc/passwd` が必要です。
```

`/etc/group` のフィールドは、グループ名、`x`、GID、メンバーです。グループ
`sudo` には誰がいますか？

```predict
$ grep ^sudo /etc/group | cut -d: -f4
elev
```

```quiz
`-r` を付けずに `sudo userdel kim` を実行すると、どうなりますか？
- [x] ユーザーは削除されるが、ホームディレクトリ `/home/kim` は残る
- [ ] 何も起こらない。`userdel` には常に `-r` が必要である
- [ ] ユーザーとホームディレクトリが削除される
- [ ] アカウントがロックされるだけである
```

```quiz
あるユーザーの UID は 33 で、シェルは `/usr/sbin/nologin` です。これは何で
ある可能性が最も高いですか？
- [ ] root
- [ ] 一般ユーザー、つまり人間
- [x] サービスの実行に使われるシステムユーザー
- [ ] 削除されたユーザー
---
UID 1～999 はシステムユーザー用で、`nologin` は誰もそのユーザーとして
ログインできないという意味です。
```

```try
getent group sudo
---
`getent` は、システムと同じ方法でグループを調べます。
```
