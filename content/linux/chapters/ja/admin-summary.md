# まとめ: システム管理

このパートでは、管理者としてコンピューターの面倒を見ました。バックグラウンドで
動くサービス、ファイルが保存されるディスク、そしてコンピューターを共有する
ユーザーです。ここで何かを **変更する** ことのほとんどには root 権限が必要
なので、`sudo` が何度も出てきました。

## systemd によるサービスとログ

**systemd** はプロセス番号 1 で、ほかのすべてを起動します。systemd が管理する
ものはすべて **ユニット** で、ユニットファイルで記述されています。パッケージに
付属するものは `/usr/lib/systemd/system` に、自分で作ったものは
`/etc/systemd/system` にあり、後者が優先されます。`systemctl` でサービスを
操作します。**`start`（今すぐ）と `enable`（起動時）は別のこと** です。
サービスが出力したものはすべて **ジャーナル** に入り、`journalctl` で読んだり
絞り込んだりできます。サービスが起動しないときは、`systemctl --failed`、
`systemctl status`、そして `journalctl -xeu` を使い、ログを一語一語読みましょう。
Ubuntu では SSH のサービスは `ssh` という名前です。ほかのファミリーでは、
サービスの名前が違うこともあります。

## ディスクとファイルシステム

**ディスク** は **パーティション** に分けられ、各パーティションにファイルを
置くには **ファイルシステム** が必要です。ディスクは `/dev` にあるファイル
です（`/dev/sda`、`/dev/sda1`、…）。Linux にはドライブ文字がありません。
どのファイルシステムも、`/` から始まる 1 本のディレクトリツリーのどこかに
**マウント** されます。`lsblk` はディスクを、`df` はファイルシステムの使用率を、
`du` はファイルが使っている容量を表示します。変更がまだ RAM で待っていることが
あるので、USB メモリは抜く前に必ず **アンマウント** しましょう。起動時に
マウントされるものは `/etc/fstab` に書かれていて、決して変わらない **UUID** で
指定するのがおすすめです。`fdisk` と `mkfs` は最も危険なコマンドの一つです。
二度確認しましょう。

## ユーザーとグループ

どのユーザーにも **UID** があります。root は 0、システムユーザーには小さい
番号が割り当てられ、人間のユーザーは 1000 から始まります。ユーザーは
`/etc/passwd` に、グループは `/etc/group` に、パスワードのハッシュは root しか
読めない `/etc/shadow` に書かれています。どのユーザーにも **プライマリグループ**
が 1 つと、任意の数の **補助グループ** があります。`useradd -m -s /bin/bash` で
ユーザーを作り、`passwd` でパスワードを設定し、`usermod -aG` でグループに追加
します。**`-a` を忘れずに**。Ubuntu では sudo の権限はグループ `sudo` から
与えられます（ほかのファミリーは `wheel` を使います）。`su -` はそのユーザーの
パスワードでユーザーを切り替え、`sudo -u` は自分のパスワードで、1 つのコマンドを
別のユーザーとして実行します。

## コマンド

| コマンド | 何をするか |
|---|---|
| `systemctl status NAME` | サービスの調子はどうか？ |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | 起動、停止、再起動、設定の再読み込み |
| `sudo systemctl enable --now NAME` | 起動時に開始する。そして今すぐ開始する |
| `systemctl is-active` / `is-enabled NAME` | 一語で答え、「はい」なら終了ステータス 0 |
| `systemctl --failed` | 失敗したサービス |
| `systemctl cat NAME` | ユニットファイルを表示する |
| `sudo systemctl daemon-reload` | 変更したユニットファイルを読み込み直す |
| `journalctl -u NAME` | 1 つのサービスのログ |
| `journalctl -p err -b` | 今回の起動以降のエラーとそれより深刻なもの |
| `journalctl -n 20`、`-f`、`--since today` | 最新の行、追いかける、午前 0 時以降 |
| `lsblk -f` | ディスク、パーティション、ファイルシステム |
| `blkid`、`findmnt -n -o UUID /` | 種類、ラベル、UUID |
| `df -h`、`du -sh DIR` | ディスクの使用率、ファイルが使っている容量 |
| `sudo mount /dev/sdb1 /mnt/usb` | ファイルシステムをマウントする |
| `sudo umount /mnt/usb` | アンマウントする |
| `cat /etc/fstab`、`sudo mount -a` | 起動時にマウントされるもの、そして変更のテスト |
| `swapon --show`、`free -h` | スワップとメモリ |
| `id`、`groups` | UID、GID、グループ |
| `sudo useradd -m -s /bin/bash NAME` | ユーザーを作る |
| `sudo passwd NAME` | パスワードを設定する |
| `sudo groupadd GROUP` | グループを作る |
| `sudo usermod -aG GROUP NAME` | グループに追加する |
| `sudo usermod -L` / `-U NAME` | アカウントをロックする / ロックを解除する |
| `sudo userdel -r NAME` | ユーザーとホームディレクトリを削除する |
| `su - NAME`、`sudo -u NAME COMMAND` | ユーザーを切り替える、別のユーザーとして実行する |
