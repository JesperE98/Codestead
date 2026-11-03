# systemd によるサービスとログ

Linux コンピューターは、誰も手で起動していないことを絶えず行っています。
SSH 接続を受け付け、時計を同期させ、定期的なジョブを実行し、ログを書いています。
こうしたことを行うプログラムを **サービス** と呼び、ほとんどすべての現代的な
ディストリビューションでは **systemd** がそれらを管理しています。この章では、
サービスを起動・停止する方法、起動時に自動で立ち上がるようにする方法、
そして何よりも大切な、問題が起きたときにログを読む方法を学びます。

## init と systemd

Linux カーネルは起動を終えると、たった 1 つのプログラムを実行します。
プロセス番号 1 の **init** です。そして init がほかのすべてを起動します。
今日では init はほぼ常に **systemd** です。Debian でも Ubuntu でも Arch でも
Fedora でも同じです。見てみましょう。

```sh
ps -p 1
```

プロセスは `/sbin/init` という名前ですが、これは `systemd` プログラムへの
リンクにすぎません。

systemd はサービスを起動するだけではありません。サービスが生きているかを
見張り、（そう設定すれば）クラッシュしたときに再起動し、サービスが出力した
ものをすべて共通のログ、つまり **ジャーナル** に集めます。さらに、システムの
ほとんどの部分のためのツールも備えています。

| ツール | 機能 |
|---|---|
| `systemctl` | サービスを制御する: 状態確認、起動、停止、ブート時の設定 |
| `journalctl` | ジャーナル（ログ）を読む |
| `hostnamectl` | コンピューターの名前を表示・変更する |
| `systemd-analyze` | ブートにかかった時間を表示する |

## ユニットとサービス

systemd が管理するものはすべて **ユニット** と呼ばれます。ユニットには
いくつかの種類があり、種類は接尾辞でわかります。`.service`（サービス）、
`.timer`（定期的なジョブ）、`.socket`、`.mount`、`.target`（ユニットの
グループで、ブートの「段階」のようなもの）などです。この章で扱うのは
サービスです。

どのユニットも、**ユニットファイル** という小さなテキストファイルで記述されます。
ユニットファイルは 2 か所にあります。

| ディレクトリ | 内容 |
|---|---|
| `/usr/lib/systemd/system/` | パッケージと一緒に入るユニットファイル。ここは編集しないこと！ |
| `/etc/systemd/system/` | 管理者が自分で作るユニットファイル。こちらが優先される。 |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

古い Debian や Ubuntu では、代わりに `/lib/systemd/system` と書かれていることが
よくあります。同じディレクトリです。`/lib` は `/usr/lib` へのリンクです。

サービスの名前はファイル名で、たとえば `myserver.service` です。コマンドを
入力するときは `.service` を省略してもかまいません。`systemctl status
myserver` でも同じように動きます。

## サービスの調子は？ – `systemctl status`

いちばんよく使うコマンドは `systemctl status` です。

```sh
systemctl status ssh
```

Ubuntu では、SSH サーバーは `ssh` という名前です。出力はだいたい次のように
なります。

```text
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 UTC; 2h 13min ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/ssh.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 ubuntu systemd[1]: Starting ssh.service - OpenBSD Secure Shell server...
Oct 30 07:54:07 ubuntu sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 ubuntu systemd[1]: Started ssh.service - OpenBSD Secure Shell server.
```

1 行ずつ見ていきましょう。

| 行 | 意味 |
|---|---|
| `●` | 緑の点 = 実行中。赤い `×` = 失敗した。白い `○` = 停止している。 |
| `Loaded` | ユニットファイルの場所、サービスがブート時に起動するか（`enabled`/`disabled`/`static`）、そしてディストリビューションの既定値（`preset`） |
| `Active` | いちばん重要な行: `active (running)`、`inactive (dead)`、`failed` のどれか、そしていつからか |
| `Docs` | 詳しい情報の場所（`man sshd`） |
| `Main PID` | サービスのメインプロセス – `ps aux` で見えるのと同じ PID |
| `Memory`, `CGroup` | 使っているメモリの量と、属しているプロセス |
| 最後の数行 | ジャーナルにあるサービスのログの最新の行 |

`static` は、そのサービスを単独では有効化できないことを意味します。
ほかのユニットが必要としたときに起動されます。

> **ヒント:** 本物のターミナルでは、長い出力はページャー（`less`）で表示されます。
> `q` を押すと戻れます。ページャーを使いたくなければ `--no-pager` を付けましょう。

## 起動、停止、再起動

```text
sudo systemctl start myserver      # いますぐ起動する
sudo systemctl stop myserver       # いますぐ停止する
sudo systemctl restart myserver    # 停止してからもう一度起動する
sudo systemctl reload myserver     # 設定を読み直すよう頼む
```

何かを **変更する** 操作にはすべて root 権限が必要なので、`sudo` を
忘れないでください。`sudo` がないと、systemctl は次のように答えます。

```text
Failed to start myserver.service: Interactive authentication required.
```

`reload` は、それに対応しているサービスでしか使えません。利点は、その間も
サービスが動き続けることです。接続が切れることはありません。サービスの
設定ファイルを変更したら、最後の手順は `reload` か `restart` です。

> **試してみよう！** プロセスの章では、練習用サーバーを `pkill` で止めました。
> `systemctl status myserver` を見てください。systemd はプロセスが消えた
> ことに気づいています。`systemctl` でもう一度起動し、PID を
> `pgrep -l myserver` と比べてみましょう。

## いますぐ？ それともブート時？ `start` と `enable`

systemd について最もよくある誤解がこれです。**`start` と `enable` は
別物です。**

| コマンド | 機能 |
|---|---|
| `systemctl start X` | サービスを **いますぐ** 起動する。再起動するとまた止まっている。 |
| `systemctl enable X` | サービスが **ブート時に** 自動的に起動するようにする – ただし、いますぐには起動しない。 |
| `systemctl enable --now X` | 両方を一度に行う。 |
| `systemctl disable X` | ブート時に起動しないようにする（`--now` を付けると停止もする）。 |

`enable` は、ユニットファイルの `[Install]` セクションに書かれたターゲットに
ちなんだ名前のディレクトリ、ふつうは `multi-user.target.wants` にリンクを
作ります。

```text
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

コンピューターがブートするとき、systemd はそのディレクトリを調べ、中にある
ものをすべて起動します。状態は次のように問い合わせられます。

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

`is-active` と `is-enabled` はスクリプトでとても便利です。1 つの単語を出力し、
答えが「はい」なら終了ステータス 0 で終わります。出力される単語は
`systemctl status` に表示されるのと同じ状態（`active`、`inactive`、`failed`、
そして `enabled`、`disabled`、`static`）です。`-q` を付けると完全に
何も表示しません。

```text
if systemctl is-active -q myserver; then echo "the server is running"; fi
```

シミュレーターで起動したばかりのコンピューターでは、`myserver` は動いていますが、
誰も有効化していません。次の 2 つのコマンドは何を表示しますか？

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
myserver は **いま** 動いていますが、誰も `enable` を実行していないので、
再起動すると起動されません。`start` と `enable` は本当に別のものなのです。
```

## サービスの一覧を表示する

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` は、動いている（または失敗した）サービスを表示します。
  `--all` を付けると、停止しているものも含まれます。
- `--failed` は、失敗したものだけを表示します。何かおかしいと感じたときに
  最初に打つコマンドとしておすすめです！
- `list-unit-files` は、インストールされているすべてのユニットファイルと、
  それが `enabled`、`disabled`、`static` のどれなのかを表示します。

## ジャーナル – `journalctl`

サービス、カーネル、そして systemd 自身が出力したものはすべてジャーナルに
入ります。オプションなしで実行すると、ジャーナル全体が古いものから順に
表示されます。

```sh
journalctl
```

これはすぐに膨大な量になるので、ほとんどの場合は絞り込みます。

| コマンド | 表示するもの |
|---|---|
| `journalctl -u ssh` | 1 つのサービスだけ（`-u` は *unit* の略） |
| `journalctl -n 20` | 最新の 20 行 |
| `journalctl -f` | 最新の行と、そのあと届く新しい行（Ctrl+C で終了） |
| `journalctl -b` | 今回のブートだけ（`-b -1` = 前回のブート） |
| `journalctl --since today` | 今日の 0 時以降。`yesterday`、`"10:00"`、`"1 hour ago"` も使える |
| `journalctl -p err` | エラーとそれより深刻なものだけ |
| `journalctl -xe` | 末尾にジャンプし、説明を追加する |
| `journalctl -k` | カーネルのメッセージだけ（`dmesg` と同様） |

オプションは組み合わせられます。定番をいくつか紹介します。

```sh
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
```

### 優先度

ジャーナルのどの行にも **優先度** があります。`-p` は、選んだ優先度
*とそれより深刻なものすべて* を表示します。

| 番号 | 名前 | 意味 |
|---|---|---|
| 0 | `emerg` | システムが使用不能 |
| 1 | `alert` | ただちに対処が必要 |
| 2 | `crit` | 致命的なエラー |
| 3 | `err` | エラー – 赤で表示される |
| 4 | `warning` | 警告 – 黄色で表示される |
| 5 | `notice` | 正常だが注目に値する |
| 6 | `info` | 情報 |
| 7 | `debug` | デバッグ情報 |

`journalctl -p err` で `ACPI BIOS Error` のようなカーネルのエラーがいくつか
表示されても、心配はいりません。これはほぼすべてのコンピューターで出るもので、
たいていは無害です。コンピューターのファームウェアのバグを、カーネルが
うまく回避しているのです。

ふつう、すべてを見るには root であるか、ジャーナルを読むことが許可された
グループ（Ubuntu では `adm` または `systemd-journal`。ほかのファミリーでは
別のグループを使います）のメンバーである必要があります。シミュレーターの
あなたのユーザーは、ジャーナル全体を読めます。

```quiz
`journalctl -p warning` が表示する優先度はどれですか？
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` は、選んだ優先度と *それより深刻なものすべて*、つまり番号が同じか
それより小さいものすべてを表示します（`warning` は 4 です）。
```

## 起動しないサービスのトラブルシューティング

誰かがこのコンピューターに **reportd** というサービスを設定しましたが、
何かがおかしいようです。ふつうは次の手順で進めます。

1. **何が失敗した？** 失敗したサービスの一覧を表示します。

   ```sh
   systemctl --failed
   ```

2. **状態を確認する。** 最後の数行だけでわかることもよくあります。

   ```sh
   systemctl status reportd
   ```

3. サービスの **ログ全体を読む。** ほとんどの場合、何が悪いのかが書かれています。
   1 語ずつ、注意深く読みましょう。

   ```sh
   journalctl -xeu reportd
   ```

   起動に失敗すると、`systemctl` 自身がまさにこのコマンドを勧めてきます:
   `See "systemctl status reportd.service" and "journalctl -xeu
   reportd.service" for details.`

4. **問題を修正する。** たとえば、設定ファイルが存在しない、またはタイプミスが
   ある、といった問題です。

5. **再起動して確認する:**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

`Main process exited, code=exited, status=1/FAILURE` という行は、プログラムが
自分でエラー終了したことを意味します。`status=203/EXEC` と書かれていたら、
systemd はプログラムをまったく見つけられなかったということです。`ExecStart=`
のパスを確認してください。

```quiz
サービスが起動せず、ジャーナルに `status=203/EXEC` と出ています。まずどこを
見ますか？
- [ ] `/etc/fstab` の中
- [x] ユニットファイルの `ExecStart=` にあるパス
- [ ] `journalctl -p err` で優先度を見る
- [ ] どこも見ない。プログラムが自分でエラー終了したという意味だから
---
203/EXEC は、systemd がプログラムをまったく見つけられなかったという意味です。
起動してからエラーで終了したプログラムなら、代わりに `status=1/FAILURE` になります。
```

## ユニットファイル – `systemctl cat`

サービスがどのように起動されるのかを正確に知るには、そのユニットファイルを
読みます。

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
# The practice server from the chapter about processes.
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| セクション | 内容 |
|---|---|
| `[Unit]` | 説明と順序: `After=network.target` = ネットワークのあとに起動する |
| `[Service]` | プログラムの実行方法: `ExecStart=`（コマンド）、`User=`、`Restart=on-failure` など |
| `[Install]` | `enable` が何をするか: `WantedBy=multi-user.target` |

ユニットファイルを変更したら、変更を反映させる前に systemd にもう一度
読み込ませる必要があります。そうしないと `systemctl status` に警告が出ます。

```text
sudo systemctl daemon-reload
```

`/usr/lib/systemd/system` にあるファイルは決して編集しないでください。
次にパッケージが更新されたときに上書きされてしまいます。代わりに、自分の
バージョンを `/etc/systemd/system` に置きましょう。

```quiz
パッケージと一緒に入ったサービスの起動方法を変えたいとします。正しいやり方はどれですか？
- [ ] `/usr/lib/systemd/system` にあるそのファイルを編集して、サービスを再起動する
- [x] 自分のバージョンを `/etc/systemd/system` に置き、`sudo systemctl daemon-reload` を実行してから、サービスを再起動する
- [ ] 自分のバージョンを `/etc/systemd/system` に置く。systemd は変更に自分で気づく
- [ ] `/usr/lib/systemd/system` にあるファイルを編集し、それに対して `sudo systemctl enable` を実行する
---
`/etc/systemd/system` にあるファイルが優先され、パッケージが更新されても
上書きされません。`daemon-reload` で、systemd は変更されたユニットファイルを
もう一度読み込みます。
```

## サービスの名前は？

systemd はどこでも同じように動きますが、**サービスの名前がいつも同じとは
限りません**。パッケージの名前や、ディストリビューションがどのプログラムを
選んだかによって変わります。Ubuntu では次のとおりです。

| サービス | Ubuntu での名前 |
|---|---|
| SSH サーバー | `ssh`（エイリアス `sshd`） |
| 定期的なジョブ（cron） | `cron` |
| ネットワーク | `NetworkManager` |
| ファイアウォール | `ufw`（インストールされていれば） |
| 時計 | `systemd-timesyncd` |

SSH サービスの本当の名前は `ssh.service` です。`sshd.service` という
エイリアスがあるので `systemctl status sshd` でも動きますが、出力には本当の
名前が表示されます。ほかのファミリーでは、同じサービスに別の名前を付けている
ことがあります（Arch と Fedora では SSH サービスは `sshd` という名前です）。
そのような違いは、ディストリビューションとパッケージのパートで扱います。

名前がわからない？ 一覧を検索しましょう。

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` が本当のユニットファイルで、`sshd.service` はそのエイリアス
（`alias`）として表示されます。
```

## コンピューターを再起動する

`enable` の効果がわかるのは、コンピューターを再起動したときだけです。
シミュレーターで試してみましょう。一瞬で再起動します。

```text
sudo systemctl reboot
```

再起動のあとは、有効化されたサービスだけが動いています。`journalctl -b
-1` で前回のブートのログ（そしてすべてがどのように終了したか）を確認でき、
`journalctl --list-boots` はジャーナルにあるすべてのブートを表示します。

## systemd のその他の機能

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` は、コンピューターの名前、オペレーティングシステム、カーネルを
表示します（`sudo hostnamectl set-hostname NEWNAME` で名前を変更することも
できます）。`systemd-analyze` はブートにかかった時間を、`blame` はどの
サービスにいちばん時間がかかったかを表示します。コンピューターの起動が
遅いときにぴったりです。
