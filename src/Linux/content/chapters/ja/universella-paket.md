# Flatpak、Snap、AppImage

通常のパッケージは、特定のディストリビューションの特定のリリース向けにビルド
されています。デスクトッププログラムを作る人にとって、これは問題です。同じ
プログラムを Debian、Ubuntu、Fedora、Arch と、そのすべてのリリース向けに
パッケージし直さなければならないからです。**ユニバーサルパッケージ形式** は、
プログラムが必要とするもののほとんどをパッケージの中にまとめることで、この問題を
解決します。そのため、ひとつの同じパッケージがどのディストリビューションでも
動きます。

主なものは **Flatpak**、**Snap**、**AppImage** の 3 つです。これらは
ディストリビューションのパッケージマネージャーを置き換えるものではなく、主に
デスクトッププログラムのためにそれを補うものです。

> シミュレーターにはターミナルしかありません。グラフィカルなプログラムを起動
> すると、代わりに「ウィンドウで開いていたはずです」という内容の行が表示されます。

## プログラムをインストールする 4 つの方法

| | ディストリビューションのパッケージ | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| 入手元 | ディストリビューションのリポジトリ | Flathub（または他の *リモート*） | Snap Store（Canonical） | 開発者の Web サイト |
| 動く環境 | 1 つのディストリビューションとリリース | すべて | `snapd` があるすべて | すべて（FUSE が必要） |
| サンドボックス | なし | あり | あり（*classic* を除く） | なし |
| サイズ | 小さい。ライブラリをシステムと共有する | 初回は大きい（ランタイム）が、その後は共有される | 大きい。snap ごとに、そのベースも必要 | 大きい。すべてが 1 つのファイルに入っている |
| 更新 | システムと一緒に（`apt upgrade` など） | `flatpak update` | バックグラウンドで自動的に | 自分で。新しいファイルをダウンロードする |
| 向いている用途 | システムプログラム、コマンドラインツール、サーバー | デスクトッププログラム | Ubuntu、デスクトップとサーバー | 単体のプログラム、新しいバージョンのお試し |

**サンドボックス** とは、プログラムがホームディレクトリ全体ではなく、たとえば
ネットワークやダウンロードフォルダーなど、許可されたものにしかアクセスできない
ことを意味します。

```quiz
バックグラウンドで自動的に更新されるのはどの形式ですか？
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
Flatpak のプログラムは `flatpak update` で更新し、AppImage は新しいファイルを
ダウンロードして置き換えます。
```

## Flatpak

Flatpak は、ほとんどのディストリビューションがデスクトッププログラム用として
合意している形式です。プログラムは **リモート**（ほぼ必ず **Flathub**）から
ダウンロードされ、共通の **ランタイム**（たとえば `org.gnome.Platform`）を共有
します。そのため、プログラムごとにすべてを持ち込む必要はありません。

:::debian
### Flatpak をインストールする

{{distro}} には Flatpak は最初から入っていません。

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Flatpak をインストールする

Flatpak は Arch のリポジトリにあります。

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### {{distro}} の Flatpak

Fedora Workstation には Flatpak が付属していて、Fedora 自身のリモート `fedora`
もすでに追加されています。

```sh
flatpak --version
flatpak remotes
```
:::

### Flathub を追加する

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` を付けると、Flathub がすでにある場合でもコマンドが失敗しなく
なります。スクリプトやインストール手順書で便利です。

### 検索、インストール、実行

プログラムにはそれぞれ、ドメイン名を逆順にした形の **ID** があります。たとえば
`org.gimp.GIMP` です。

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak は、プログラムが求める **権限** と、一緒にインストールされるランタイムを
表示します。サイズに注目してください。最初のプログラムは数百メガバイトの
ランタイムを取り込みますが、同じランタイムを使う次のプログラムは小さく済みます。

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### システム全体か、自分だけか

オプションを付けないと、Flatpak は **システム全体** に（`/var/lib/flatpak` に）
インストールします。デスクトップでは Flatpak がウィンドウでパスワードを聞いて
くるので、sudo は必要ありません。`--user` を付けると、プログラムは代わりに
ホームディレクトリ（`~/.local/share/flatpak`）に入り、他のユーザーからは見え
ません。ユーザー用のインストールには **独自のリモート** があるので、Flathub も
`--user` を付けて追加する必要があります。

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
`--user` を付けて Flatpak をインストールすると、どうなりますか？
- [ ] システム全体に、`/var/lib/flatpak` にインストールされる
- [x] あなたのホームディレクトリに入り、ほかのユーザーからは見えない
- [ ] サンドボックスなしで動く
---
ユーザー用のインストールには独自のリモートがあることを忘れないでください。
Flathub も `--user` を付けて追加する必要があります。
```

### 更新と削除

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` は、インストール済みのどのプログラムにも使われなくなったランタイムを
削除します。

## Snap

Snap は **Canonical** の形式で、Ubuntu の標準です。Ubuntu では、たとえば Firefox
が snap になっています。snap は Canonical が運営する **Snap Store** から提供され、
`snapd` サービスによって管理されます。バックグラウンドで自動的に更新されます。

:::debian
### Ubuntu と Debian の Snap

Ubuntu にはすでに Snap があります。Debian では、まず `snapd` をインストールします。

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Arch の Snap

Snap は Arch のリポジトリにはなく、AUR にしかありません。Arch ファミリーの章と
同じようにビルドします。

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

本物のシステムでは、`sudo systemctl enable --now snapd.socket` でサービスを起動
する必要もあります。これは Snap が Arch になじんでいないことの表れで、Arch では
ほとんどの人が Flatpak を使っています。
:::

:::redhat
### Fedora の Snap

Fedora は Flatpak に力を入れていますが、Snap もリポジトリにあります。

```sh
sudo dnf install snapd
```
:::

### snap を使う

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

インストールした snap は、`/snap/bin` にプログラムとして現れます。インストールと
削除には root 権限が必要です。

### strict と classic

ほとんどの snap は、サンドボックスの中で **strict**（厳格）に動きます。コード
エディターのように、システム全体へのアクセスが必要なプログラムは、
**classic confinement** で公開されています。その場合は `--classic` を付けて、
自分で承認する必要があります。

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
ある snap が classic confinement で公開されています。インストールするには何を付ける必要がありますか？
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### チャンネルと更新

snap にはそれぞれ **チャンネル** があります。`stable`、`candidate`、`beta`、
`edge`（最新の、テストされていないバージョン）です。`snap info` でチャンネルを
確認でき、`--channel=beta` で別のチャンネルを選べます。更新は自動的に行われますが、
強制的に更新したり、snap を削除したりすることもできます。

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap には批判もあります。Snap Store は Canonical だけが運営していること、自動
更新を完全には止められないこと、そしてプログラムの初回起動が遅いことがある点です。

## AppImage

**AppImage** は、プログラム全体が **1 つのファイル** になったものです。プログラム
の Web サイトからダウンロードし、実行可能にして起動するだけです。インストールも
root も必要ありません。プログラムを取り除きたければ、ファイルを削除します。

ホームディレクトリの `~/{{downloads}}` には、ダウンロード済みの AppImage
`{{calculator}}`（{{calcName}}）がすでにあります。

```sh
cd ~/{{downloads}}
ls -l
```

```text
total 47184
-rw-r--r-- 1 {{user}} {{user}} 48312832 Oct 30 12:00 {{calculator}}
```

bash のエラーメッセージは `bash: パス: 理由` という形で、パスは bash から見た形で
表示されます。つまり `~` はすでに `/home/{{user}}` に置き換えられています。
このファイルをすぐに起動すると、どうなるでしょうか？

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
このファイルには `x` パーミッションがありません。
```

ダウンロードしたファイルは、最初は決して実行可能になっていません。実行可能にして
起動しましょう。

```sh
chmod +x {{calculator}}
./{{calculator}}
```

```try
chmod +x ~/{{downloads}}/{{calculator}}
---
これでファイルが実行可能になりました。`ls -l ~/{{downloads}}` で確認しましょう。
```

### FUSE

AppImage は **FUSE** を使って自分自身をファイルシステムとしてマウントするので、
そのライブラリの古いバージョン 2（`libfuse.so.2`）が必要です。それがないと、
*"AppImages require FUSE to run"* というエラーになります。

:::debian
Ubuntu 24.04 と Debian 13 では、パッケージ名は `libfuse2t64` です（*t64* は
64 ビット時刻への移行に由来します。古いリリースでは `libfuse2` という名前
でした）。

```sh
sudo apt update
sudo apt install libfuse2t64
./{{calculator}}
```

> Ubuntu では `fuse` パッケージをインストール **しないでください**。デスクトップ
> に必要な `fuse3` を置き換えてしまいます。
:::

:::arch
Arch では、パッケージ名は `fuse2` です。

```sh
sudo pacman -S fuse2
./{{calculator}}
```
:::

:::redhat
Fedora では、パッケージ名は `fuse-libs` です。

```sh
sudo dnf install fuse-libs
./{{calculator}}
```
:::

### 中をのぞく

AppImage は展開することもできます。これは FUSE がなくても動きます。

```sh
./{{calculator}} --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` は、一時的に展開してすぐに起動します。

### 覚えておくこと

- AppImage には **サンドボックスがありません**。プログラムはあなたとして実行され、
  あなたがアクセスできるものすべてにアクセスできます。ダウンロードは必ず
  プログラムの公式 Web サイトから行いましょう。
- **自動更新はありません**。新しいバージョンが出たら、新しいファイルをダウン
  ロードします（自分で更新できるプログラムもあります）。
- プログラムは、ひとりでにアプリケーションメニューに現れたりはしません。
  *Gear Lever* や *AppImageLauncher* といったツールで解決できます。

## どれを選べばいいの？

1. システムプログラムやコマンドラインプログラムには **ディストリビューションの
   パッケージ**。最も小さく、最も速く、システムの他の部分と一緒に更新されます。
2. 新しいバージョンが欲しいときや、リポジトリにないプログラムが欲しいときの
   デスクトッププログラムには **Flatpak**。
3. Ubuntu を使っている場合や、プログラムが snap としてしか存在しない場合は
   **Snap**。
4. プログラムを手早く試したいときや、開発者がその形式しか提供していないときは
   **AppImage**。
