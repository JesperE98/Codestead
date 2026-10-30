# ネットワーク

Linux コンピューターがすることのほとんどは、ほかのコンピューターとの通信を
ともないます。アップデートの取得、Web ページの表示、サーバーへのログインなどです。
何かがうまくいかないとき、原因を突き止めるのに最適な道具がそろっているのが
ターミナルです。この章では、自分のアドレスを調べる方法、接続をテストする方法、
名前を引く方法、どのサービスが動いているかを確認する方法、Web から何かを
取ってくる方法、そして SSH で別のコンピューターにログインする方法を学びます。

シミュレーション上のコンピューターは、小さな家庭内ネットワークの中にあります。

| コンピューター | アドレス | 説明 |
|---|---|---|
| あなたのコンピューター（{{hostname}}） | `192.168.1.42` | いまいる場所 |
| ルーター（ゲートウェイ） | `192.168.1.1` | インターネットへの出口 |
| サーバー | `192.168.1.10` | ログインできる別の Linux コンピューター |

ルーターの向こう側には「インターネット」があり、`example.com`、`linux.org`、
`archlinux.org` などがあります。

## IP アドレス

ネットワーク上のどのコンピューターにも **IP アドレス** があります。IPv4 アドレスは
0 から 255 までの 4 つの数字で、たとえば `192.168.1.42` のようになります。
`192.168.`、`10.`、または `172.16.`～`172.31.` で始まるアドレスは
**プライベート** アドレスです。ローカルネットワークの内側でだけ使われ、
インターネット上に出ていくことはありません。

コンピューターのアドレスを表示するコマンドは `ip`（*iproute2* パッケージに
含まれています）です。`ip addr` は `ip a` と短くできます。

```sh
ip a
```

**インターフェース**（ネットワークカード）が 2 つ表示されます。

- `lo` – *ループバック*。コンピューターが自分自身と話すための仮想のカードです。
- `enp0s3` – 本物のネットワークカード。以前は `eth0` のような名前でした。
  無線のカードは `wlan0` や `wlp2s0` のような名前であることがよくあります。

`inet 192.168.1.42/24` の行があなたの IPv4 アドレスです。`link/ether` は
ハードウェアに組み込まれたカードの **MAC アドレス** で、`state UP` はカードが
動作していることを表します。もっと簡潔に見たいときは `-br`（*brief*）があり、
`hostname -I` はアドレスだけを表示します。

```sh
ip -br a
hostname -I
```

多くの解説ではいまでも古いコマンド `ifconfig`（*net-tools* パッケージ）を
見かけますが、最近のディストリビューションでは既定ではインストールされて
いません。`ip` は `ifconfig` ができたことをすべて、さらにそれ以上のことができます。

## localhost – コンピューター自身

アドレス `127.0.0.1` には **localhost** という名前が付いていて、常に
「このコンピューター」を意味します。同じコンピューター上のプログラムどうしは、
よく localhost を通じて通信します。たとえば、開発中の Web サーバーと、
それをテストするブラウザーです。localhost への通信がコンピューターの外に
出ることはありません。

## ネットマスクとゲートウェイ

アドレスの後ろの `/24` は **ネットマスク** です。最初の 24 ビット（最初の
3 つの数字、`192.168.1`）がネットワークのアドレスであることを示しています。
アドレスが `192.168.1.` で始まるコンピューターはすべて同じローカルネットワーク上に
あり、直接届きます。それ以外はすべて **ゲートウェイ**、つまりルーターに送られ、
ルーターがそれをインターネットへ転送します。これはルーティングテーブルで
確認できます。

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

最初の行の **default** はデフォルトルートで、「ほかに書かれていないものは
すべて 192.168.1.1 へ」という意味です。2 行目は、`192.168.1.0/24` の
ネットワーク全体には `enp0s3` から直接届くことを示しています。`proto dhcp` は、
コンピューターが **DHCP** によってルーターから自動的に設定を受け取ったことを
意味します。

## ping – 届くかどうか

`ping` は小さなテストパケットを送り、応答が返ってくるまでの時間を測ります。
`-c`（*count*）でパケットの数を選べます。指定しないと、**Ctrl+C** を押すまで
ping は送り続けます。

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` は応答時間です。家庭内ネットワークの中なら 1 ミリ秒未満、
  インターネットまでなら 10～50 ms 程度のことがよくあります。
- `0% packet loss` – 失われたパケットはありません。パケットが失われる場合は、
  ネットワーク（または Wi-Fi 接続）の調子が悪いことを示しています。
- `Destination Host Unreachable` は、ローカルネットワーク上にそのアドレスを
  持つコンピューターがないという意味です。

コンピューター自身と、インターネット上のコンピューターにも ping してみましょう。

```sh
ping -c 2 localhost
ping -c 3 example.com
```

注意！ 多くのサーバーやファイアウォールは、わざと ping に応答しません。
ですから、応答がないからといって、必ずしもそのコンピューターが止まっている
とは限りません。

## 名前と DNS

人は名前を覚え、コンピューターはアドレスを使います。**DNS**（*Domain Name
System*）はインターネットの電話帳で、`example.com` を IP アドレスに変換します。
コンピューターがどの DNS サーバーに問い合わせるかは `/etc/resolv.conf` に
書かれています。

```sh
cat /etc/resolv.conf
```

Ubuntu と Fedora では `127.0.0.53` と書かれています。これは
**systemd-resolved** で、自分のコンピューター上にあるローカルな仲介役です。
そこからさらにルーターに問い合わせます。Debian と Arch では、ルーターの
`192.168.1.1` が直接書かれています。

自分で DNS に問い合わせるには `dig`、`host`、`nslookup` を使います。これらは
最初からはインストールされておらず、ディストリビューションごとに名前の違う
パッケージに入っています。

:::debian
```sh
sudo apt update
sudo apt install dnsutils
```
:::

:::arch
```sh
sudo pacman -S bind
```

パッケージ名の `bind` は、これらのツールの出どころである DNS サーバー BIND に
由来しています。
:::

:::redhat
```sh
sudo dnf install bind-utils
```
:::

`dig` は DNS サーバーからの応答をすべて表示します。重要なのは
`ANSWER SECTION` の部分です。`+short` を付けるとアドレスだけが表示されます。

```sh
dig example.com
dig +short example.com
```

`host` と `nslookup` も同じことをしますが、出力はもっと短くなります。
`nslookup` は Windows や macOS にもあります。`host` は **逆引き**、
つまりアドレスから名前を調べることもできます。

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

`@` を使うと、特定の DNS サーバーに問い合わせられます。たとえば Cloudflare の
`1.1.1.1` や Google の `8.8.8.8` です。

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – コンピューター独自の名前リスト

コンピューターは DNS に問い合わせる前に、`/etc/hosts` というファイルを
確認します。このファイルには、たとえば `localhost` が `127.0.0.1` である
ことが書かれています。

```sh
cat /etc/hosts
```

家庭内ネットワークのサーバーのアドレスは `192.168.1.10` ですが、
`server.lan` という名前はどの DNS にも登録されていません。

```sh
ping -c 1 server.lan
```

解決策は、`/etc/hosts` に 1 行追加することです。このファイルの所有者は root
なので、`sudo` が必要です。ただし注意してください。次のやり方は **うまく
いきません**。

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` が効くのは `echo` だけです。`>>` のためにファイルを開くのは、
（root ではなく、あなたとして動いている）あなた自身のシェルなのです。
うまくいく方法は `tee -a` です。`tee -a` はパイプから受け取ったものを
ファイルの末尾に追加します。そして `tee` なら sudo で実行できます。

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

これで、コンピューター上のどのプログラムでもこの名前が使えるようになりました。
しかし `dig` は DNS に直接問い合わせて `/etc/hosts` を無視するので、相変わらず
何も見つかりません。*システム* がどう名前解決するかを見るには `getent` を
使います。

```sh
dig +short server.lan
getent hosts server.lan
```

この順序（まずファイル、次に DNS）は、`/etc/nsswitch.conf` の `hosts:` の行で
決められています。

## ポートとサービス

IP アドレスはコンピューターを指し示します。**ポート**（1 から 65535 までの
数字）は、そのコンピューター上のプログラムを指し示します。住所と部屋番号の
ような関係です。接続を待っているプログラムは、ポートで **listen**（待ち受け）
している、と言います。よく知られたポートをいくつか挙げます。

| ポート | サービス |
|---|---|
| 22 | SSH – ほかのコンピューターにログインする |
| 53 | DNS |
| 80 | HTTP – Web |
| 443 | HTTPS – 暗号化された Web |
| 8080 | 開発中の Web サーバーでよく使われる |

1024 未満のポートを開けるのは root だけです。`ss`（*socket statistics*）は、
どのポートが待ち受けているかを表示します。

```sh
ss -tulpn
```

このオプションは、**t**cp、**u**dp、**l**istening、**p**rocess、**n**umeric
と唱えるようにして覚えるのが一般的です。`0.0.0.0:22` は、`sshd` が
コンピューターのすべてのアドレスのポート 22 で待ち受けていることを意味し、
`[::]:22` は同じことの IPv6 版です。*Process* 列は、ほかのユーザーが所有する
プロセスについては空になります。`sudo` を付けるとすべて表示されます。

```sh
sudo ss -tulpn
```

プロセスの章で使った練習用サーバー `minserver` が動いていれば、ここで
ポート 8080 に表示されます。古いコマンド `netstat -tulpn`（*net-tools*）も
同じことをします。

## Web から取ってくる: curl と wget

`curl` は、あるアドレス（**URL**）にあるものを取ってきて、ターミナルに表示します。
自分のコンピューター上の minserver で試してみましょう。

:::debian
Debian と Ubuntu では `curl` はプリインストールされていません（`wget` は
入っています）。

```sh
sudo apt install curl
```
:::

```sh
curl http://localhost:8080
```

`Couldn't connect to server` と表示されましたか？ それなら、そのポートでは
何も待ち受けていません。プロセスの章で minserver を止めたのかもしれません。
もう一度起動しましょう。

```sh
minserver
```

`-I` を付けると、curl は応答の **ヘッダー** だけを表示します。その最初の行が
**ステータスコード** です。

```sh
curl -I https://example.com
```

| コード | 意味 |
|---|---|
| 200 | OK |
| 301, 302 | ページが移動した – `Location:` を見る |
| 403 | アクセス禁止 |
| 404 | 見つからない |
| 500 | サーバーエラー |

多くの Web サイトは `http://` から `https://` へリダイレクトします。その場合、
短い「301 Moved Permanently」しか返ってきません。`-L` を付けると curl は
リダイレクト先までたどります。

```sh
curl -I http://linux.org
curl -L http://linux.org
```

curl はターミナルに出力するので、パイプの中でとても便利に使えます。
`-s`（*silent*）で進捗表示を消せます。

```sh
curl -s https://example.com | grep title
```

ファイルに保存するには `-o FILE` を使います（または `-O` を使うと、
ファイル名がアドレスから取られます）。

```sh
cd ~
curl -o exempel.html https://example.com
```

`wget` はファイルのダウンロードのために作られています。常にファイルに保存し、
進捗を表示し、リダイレクトも自動的にたどります。

:::arch
Arch では `wget` はプリインストールされていません（`curl` は入っています）。

```sh
sudo pacman -S wget
```
:::

:::redhat
Fedora では `wget` はプリインストールされていません（`curl` は入っています）。

```sh
sudo dnf install wget
```
:::

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

ファイル名を自分で決めるには、大文字の `-O` を使います: `wget -O file.html URL`。

## SSH – 別のコンピューターにログインする

**SSH**（*Secure Shell*）は Linux コンピューターをリモートで操作するときの
定番の方法で、送られるものはすべて暗号化されます。サーバーではポート 22 で
`sshd` というサービスが動いていて、クライアントの `ssh` で接続します。

:::arch
Arch では ssh クライアントはプリインストールされていません。

```sh
sudo pacman -S openssh
```
:::

```sh
ssh elev@server.lan hostname
```

`elev@server.lan` は「コンピューター server.lan 上のユーザー elev」という意味です。
ホストの後ろのコマンド（`hostname`）はサーバー上で実行され、その結果が
ここに表示されます。表示されるのは {{hostname}} ではなく `server` です。

あるコンピューターに初めて接続するとき、ssh はそのコンピューターを信頼するか
どうかを尋ねます。

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

`yes` と（単語全体を）入力します。するとサーバーの **ホスト鍵** が
`~/.ssh/known_hosts` に保存されます。あとで鍵が変わると、ssh は大きな警告を
出します。誰かがサーバーになりすましている可能性があるからです。

コマンドは、引用符で囲んで複数のコマンドにすることもできます。

```sh
ssh elev@server.lan 'whoami; uptime; ls'
ssh elev@server.lan cat välkommen.txt
```

コマンドを付けないと、ssh はログインして、相手のコンピューター上のシェルが
使えるようになります。そこからは `exit` で抜けます。ただし、これは
シミュレーターではサポートされていません。シミュレーターでは、常にホストの
すぐ後ろにコマンドを書いてください。

### パスワードの代わりに鍵を使う

パスワードの代わりに **鍵ペア** でログインすることもできます。秘密鍵は
手元に置いたままにし、公開鍵をサーバーに置きます。

```sh
ssh-keygen
ssh-copy-id elev@server.lan
```

`ssh-keygen` の質問には Enter を押して、パスフレーズなしで既定のファイル
`~/.ssh/id_ed25519` を使います。`ssh-copy-id` は公開鍵（`id_ed25519.pub`）を
サーバーの `~/.ssh/authorized_keys` に追加します。そのあとは、ssh はもう
パスワードを尋ねなくなります。秘密鍵は決して誰にも見せないでください！

`scp` や `rsync` を使えば SSH 経由でファイルをコピーでき、`~/.ssh/config`
ファイルではサーバーに短い名前を付けられます。でも、それはまた後の章で
扱います。

## ネットワークがつながらないとき

「インターネットがつながらない」には、さまざまな原因が考えられます。内側から
外側へ、順番に手順を確認していきましょう。最初に失敗した手順が、問題のある
場所を示しています。

| 手順 | コマンド | 失敗した場合 |
|---|---|---|
| 1. アドレスはある？ | `ip a` | カードが停止している（`state DOWN`）か、アドレスを取得できていない |
| 2. 外への道はある？ | `ip route` | `default` の行がない – ゲートウェイがない |
| 3. ルーターに届く？ | `ping -c 3 192.168.1.1` | ローカルネットワークの問題（ケーブル、Wi-Fi） |
| 4. インターネットに届く？ | `ping -c 3 1.1.1.1` | ルーターかプロバイダーの問題 |
| 5. DNS は動いている？ | `ping -c 3 example.com` | 名前解決に失敗している – `/etc/resolv.conf` を確認する |

手順 4 では、名前を使わずにアドレスに直接 ping しています。手順 4 はうまく
いくのに手順 5 が失敗するなら、壊れているのはほぼ間違いなく DNS です。
これは最もよくある問題の 1 つです。

自分で試してみましょう！ ネットワークカードを停止し、手順を順に確認してから、
もう一度有効にします。

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## パッケージ

ネットワークツールはいくつかのパッケージに分かれています。そして例によって、
ファミリーごとに名前が違います。

| ツール | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| `ip`, `ss` | `iproute2` | `iproute2` | `iproute` |
| `ping` | `iputils-ping` | `iputils` | `iputils` |
| `dig`, `host`, `nslookup` | `dnsutils` | `bind` | `bind-utils` |
| `traceroute` | `traceroute` | `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` | `openssh` | `openssh-clients` |

`traceroute` は、パケットが途中で通過するルーターをすべて表示します。
インストールして `traceroute example.com` を試してみましょう！

## まとめ

| コマンド | 機能 |
|---|---|
| `ip a` | IP アドレスを表示する |
| `ip route` | ルーティングテーブルとゲートウェイを表示する |
| `ping -c 3 HOST` | コンピューターに届くかテストする |
| `dig +short NAME` | DNS で名前を引く |
| `getent hosts NAME` | システムと同じ方法で（`/etc/hosts` も含めて）名前を引く |
| `ss -tulpn` | 待ち受けているポートを表示する |
| `curl URL` | 取ってきて表示する |
| `curl -o FILE URL`, `wget URL` | ファイルにダウンロードする |
| `ssh USER@HOST COMMAND` | 別のコンピューターでコマンドを実行する |
