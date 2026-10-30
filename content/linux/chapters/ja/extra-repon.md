# AUR、PPA、COPR

ディストリビューションのリポジトリには何万ものパッケージがありますが、すべてが
あるわけではありません。マイナーなプログラムはまったく見つからないこともあれば、
古いバージョンしかないこともあります。そのために、開発者やユーザーが自分の
パッケージを共有する **追加リポジトリ** があります。ファミリーごとに独自のものが
あり、Ubuntu では **PPA**、Arch では **AUR**、Fedora では **COPR** です。

この章では、`moonphase` という架空のプログラム（ターミナルに月の満ち欠けを表示
します）を、{{distro}} の追加リポジトリからインストールします。他のファミリーでは
どうなるのかを比べたいときは、メニューでディストリビューションを切り替えて
ください。

## 便利だけれど、自己責任で

ディストリビューション自身のリポジトリにあるパッケージは、一緒にテストされ、
署名され、ディストリビューションの開発者によってレビューされています。一方、
追加リポジトリは誰でも作れます。追加する前に、次のことを覚えておきましょう。

- **パッケージは root としてインストールされます。** パッケージはコンピューターに
  対してどんなことでもできます。それを作った人を、ディストリビューションと同じ
  くらい信頼することになるのです。
- **衝突することがあります。** 追加リポジトリのパッケージが、システム自身の
  ライブラリを置き換えたり、手元にあるものとは別のバージョンを必要としたりする
  ことがあります。
- **更新されなくなることがあります。** リポジトリを運営している人が興味を
  なくすと、そのプログラムのセキュリティ更新はもう届きません。

よい目安: まずディストリビューションのリポジトリを探し、次に Flatpak（次の章）を
探し、それでもなければ、信頼できる人の追加リポジトリを探しましょう。

## 3 つのファミリー、3 つの解決策

| | PPA | AUR | COPR |
|---|---|---|---|
| ファミリー | Ubuntu（と Linux Mint など） | Arch（と Manjaro、EndeavourOS など） | Fedora（と RHEL ファミリー） |
| Web サイト | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| ダウンロードするもの | ビルド済みの `.deb` パッケージ | ビルドレシピ（`PKGBUILD`）。自分でビルドする | ビルド済みの `.rpm` パッケージ |
| 追加方法 | `add-apt-repository ppa:…` | `git clone …` と `makepkg -si` | `dnf copr enable …` |
| ディストリビューションによるレビュー | なし | なし | なし |

:::debian
## {{distro}} の PPA

**PPA**（*Personal Package Archive*）は、Canonical の Ubuntu 向けサービスである
Launchpad 上の小さなリポジトリです。開発者がソースコードをアップロードすると、
Launchpad がさまざまな Ubuntu リリース向けに `.deb` パッケージをビルドします。
PPA は `ppa:ユーザー/名前` と書きます。

### add-apt-repository ツール

PPA は `add-apt-repository` で追加します。このコマンドは
`software-properties-common` パッケージに含まれています。Ubuntu には最初から
入っていますが、Debian には入っていません。

```sh
sudo apt update
sudo apt install software-properties-common
```

### PPA を追加する

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

何が追加されるのかと、PPA の説明が表示されます。Enter を押すと続行します
（`-y` を付けると質問を省略できます）。このとき 2 つのことが起こります。

1. `/etc/apt/sources.list.d/` にファイルが作られます。そこにはリポジトリの
   場所と、パッケージの署名に使われている鍵が書かれています。
2. `add-apt-repository` が代わりに `apt update` を実行します。そうしないと、
   apt は新しいパッケージのことを知りません。ソースを手で（ファイルを作って）
   追加した場合は、そのあと自分で `sudo apt update` を実行する必要があります。

ファイルを見てみましょう。

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

`Suites: noble` に注目してください。パッケージは Ubuntu 24.04 向けにビルドされて
います。

### インストールして実行する

これで、パッケージは他のパッケージとまったく同じようにインストールできます。

```sh
sudo apt install moonphase
moonphase
```

### パッケージはどこから来たのか？

`apt policy` は、パッケージがどのリポジトリにあり、どれが優先されるのかを表示
します。

```sh
apt policy moonphase
```

`***` はインストールされているバージョンを示します。数字の `500` はリポジトリの
優先度で、`100` は「すでにインストールされているもの」を意味します。同じ
パッケージが複数のリポジトリにある場合、apt は最も新しいバージョンを選びます。
そのため、PPA はディストリビューション自身のパッケージを独自のバージョンで
置き換えることがあります。

### Debian で PPA？

PPA は Debian ではなく Ubuntu 向けにビルドされています。Debian でも動くことは
ありますが、パッケージが Debian にあるものとは別のライブラリのバージョンを
必要とすることがあります。Debian と Ubuntu のパッケージが混ざったものは、冗談で
*FrankenDebian* と呼ばれ、システムを壊すよくある原因です。Debian では、
*backports*、Flatpak、または開発者自身が用意した Debian 向けリポジトリを使う
ほうがよいでしょう。

### PPA を削除する

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

プログラムは残りますが、もう更新は届きません。完全に取り除くには、
`sudo apt remove moonphase` も実行します。
:::

:::arch
## {{distro}} の AUR

**AUR**（*Arch User Repository*）は他とは違います。ビルド済みのパッケージはなく、
あるのは **ビルドレシピ** だけです。レシピは `PKGBUILD` と呼ばれる小さな bash
スクリプトで、ソースコードの場所と、プログラムのビルド方法が書かれています。
レシピをダウンロードし、自分でパッケージをビルドして、pacman でインストール
します。AUR は巨大で、Linux 向けに存在するほとんどすべてのものがそろっています。
ただし、レシピは誰でもアップロードできます。

### 準備

レシピをダウンロードしてパッケージをビルドするには、`git` と `base-devel`
（コンパイラー、`make`、`fakeroot` など）が必要です。

```sh
sudo pacman -S --needed git base-devel
```

`--needed` は、すでにインストールされているものを飛ばします。

### レシピを取得する

AUR のパッケージは、それぞれが独立した git リポジトリです。

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> パッケージ名を打ち間違えると、git は *"You appear to have cloned an empty
> repository"* と表示し、ディレクトリは空になります。AUR は何でもクローン
> させてくれるのです！

### PKGBUILD を読む（毎回！）

```sh
less PKGBUILD
```

`PKGBUILD` はあなたのコンピューター上で実行されるスクリプトです。少なくとも
次の点を確認しましょう。

- `source=` がプログラムの本物の Web サイトからダウンロードしていること。
- `build()` と `package()` がビルドとファイルのコピーだけをしていて、たとえば
  別のものをダウンロードして実行したり（`curl … | sh`）していないこと。
- パッケージがメンテナンスされているように見えること（日付や
  aur.archlinux.org のコメント）。

### ビルドしてインストールする

```sh
makepkg -si
```

`makepkg` は `PKGBUILD` を読み、ソースコードをダウンロードしてビルドし、
`.pkg.tar.zst` ファイルにまとめます。`-s` は足りない依存関係をインストールし、
`-i` は完成したパッケージを pacman でインストールします。makepkg を sudo で
実行しては **いけません**。makepkg は root として実行されるのを拒否し、必要な
ときには自分で sudo を使います。

```sh
ls
moonphase
```

### 「外部」パッケージ

pacman は AUR のことを何も知りません。リポジトリから来たのではないパッケージは
*foreign*（外部）パッケージと呼ばれ、次のコマンドで一覧表示できます。

```sh
pacman -Qm
```

これは、`sudo pacman -Syu` が AUR のパッケージを更新 **しない** ということでも
あります。新しいレシピを自分で取得し（`git pull`）、ビルドし直す必要があります。
あるいは、AUR ヘルパーに任せることもできます。

### AUR ヘルパー yay

AUR ヘルパーは、検索、ダウンロード、`PKGBUILD` の表示、ビルド、インストールを
すべて代わりにやってくれます。最もよく使われているのは **yay** です（ほかに
*paru* もあります）。yay 自体は AUR にしかないので、最初の 1 回だけは手で
インストールします。`yay-bin` パッケージはビルド済みで、いちばん手早く済みます。

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

そのあとは、yay を pacman とほとんど同じように使えます。ただし sudo は付けません。

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu`（または単に `yay`）は、リポジトリのパッケージと AUR のパッケージの
両方をアップグレードします。便利になったからといって、レシピを読むのをやめて
よいわけではありません！
:::

:::redhat
## {{distro}} の COPR

**COPR**（*Cool Other Package Repo*）は Fedora のビルドサービスです。Fedora
アカウントを持っている人なら誰でも、そこで `.rpm` パッケージをビルドできます。
各プロジェクトは `ユーザー/プロジェクト` という名前の独立したリポジトリになります。

### いま使っているリポジトリ

```sh
dnf repolist
```

### COPR リポジトリを有効にする

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf は、そのリポジトリが Fedora の一部ではなく、品質にばらつきがあるかもしれない
ことを念押しします。質問の既定値は **No** なので、`y` と答えてください。
`/etc/yum.repos.d/` に新しいファイルが作られます。

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### インストールして実行する

dnf は新しいリポジトリの情報を自分で取得するので、パッケージはすぐに
インストールできます。

```sh
sudo dnf install moonphase
moonphase
```

### パッケージはどこから来たのか？

```sh
dnf info moonphase
```

`From repository` の行を見ると、パッケージが COPR から来たことがわかります。
COPR のパッケージは、いつもどおり `sudo dnf upgrade` で更新されます。

### 無効にする、または削除する

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` はファイルを残したままリポジトリを無効にし、`remove` はファイルを完全に
削除します。プログラムは残りますが、もう更新は届きません。

### RPM Fusion

Fedora でよく使われる追加リポジトリには、ほかに **RPM Fusion** があります。
一部のメディアコーデックやドライバーなど、Fedora が含められない、あるいは含め
ようとしないものがそろっています。COPR のような個人のリポジトリではなく、大きな
共同プロジェクトです。
:::

## 更新とメンテナンス

| | 更新方法 | リポジトリの削除 |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu`（または自分でビルドし直す） | ―（削除するリポジトリはない） |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

追加リポジトリは強力な道具ですが、リポジトリを 1 つ追加するたびに、信頼する
相手が 1 人増えることになります。一覧は短く保ち、もう使っていないものは
片付けましょう。
