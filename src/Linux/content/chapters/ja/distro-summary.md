# まとめ: ディストリビューションとパッケージ

## ファミリー

基本はどのディストリビューションでも同じです。Linux カーネル、bash と GNU
ツール、ディレクトリ構成、そして（ほとんどどこでも）systemd です。ファミリーを
分けているのは、主にプログラムのインストール方法です。

| | Debian ファミリー | Arch ファミリー | Red Hat ファミリー |
|---|---|---|---|
| 例 | Debian、Ubuntu、Linux Mint | Arch、Manjaro、EndeavourOS | Fedora、RHEL、Rocky Linux |
| パッケージマネージャー | `apt` | `pacman` | `dnf` |
| パッケージ形式 | `.deb` | `.pkg.tar.zst` | `.rpm` |
| 低レベルツール | `dpkg` | （pacman） | `rpm` |
| sudo のグループ | `sudo` | `wheel` | `wheel` |
| リリース | 安定版 | ローリング | 6 か月ごとに新バージョン（Fedora） |

- `cat /etc/os-release` で、どのディストリビューションを使っているかがわかり、
  `uname -r` でカーネルのバージョンがわかります。
- **パッケージ** とはファイルにまとめられたプログラム、**リポジトリ** とは
  ディストリビューションのテスト済みで署名されたパッケージがあるサーバー、
  **依存関係** とは必要とされる別のパッケージのことです。依存関係は
  パッケージマネージャーが自動的にインストールします。
- システムを変更するコマンドには root 権限が必要なので、`sudo` を付けて実行します。

## 同じことを 3 つの方言で

| 操作 | apt（Debian） | pacman（Arch） | dnf（Red Hat） |
|---|---|---|---|
| パッケージ一覧を更新 | `apt update` | `pacman -Sy` | `dnf check-update` |
| すべてをアップグレード | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| インストール | `apt install X` | `pacman -S X` | `dnf install X` |
| 削除 | `apt remove X` | `pacman -R X` | `dnf remove X` |
| 検索 | `apt search X` | `pacman -Ss X` | `dnf search X` |
| パッケージ情報 | `apt show X` | `pacman -Si X` | `dnf info X` |
| インストール済みの一覧 | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

覚えておきたいこと:

- **apt**: `apt update` はパッケージの一覧をダウンロードするだけで、
  新しいバージョンをインストールするのは `apt upgrade` です。先に `update` を
  実行しましょう。`[Y/n]` は、Enter で yes と答えたことになるという意味です。
- **pacman**: 大文字が操作（`-S`、`-R`、`-Q`）で、小文字はそれを調整する
  ものです。アップグレードは必ず `-Syu` で行い、`-Sy` のあとに `-S パッケージ`
  を実行してはいけません（部分アップグレードはシステムを壊すおそれがあります）。
- **dnf**: パッケージ情報を自分で取得します。更新があると、`dnf check-update`
  は `100` で終了します。`[y/N]` は、Enter で **no** と答えたことになるという
  意味です。

パッケージ名はたいていどこでも同じですが、いつもそうとは限りません。Fedora
では Vim は `vim-enhanced` です。わからないときは検索しましょう。

## 追加リポジトリ

| | PPA | AUR | COPR |
|---|---|---|---|
| ファミリー | Ubuntu（と Linux Mint など） | Arch（と Manjaro、EndeavourOS など） | Fedora（と RHEL ファミリー） |
| ダウンロードするもの | ビルド済みの `.deb` パッケージ | ビルドレシピ（`PKGBUILD`）。自分でビルドする | ビルド済みの `.rpm` パッケージ |
| 追加方法 | `add-apt-repository ppa:…` | `git clone …` と `makepkg -si` | `dnf copr enable …` |
| 更新方法 | `sudo apt update && sudo apt upgrade` | `yay -Syu`、または自分でビルドし直す | `sudo dnf upgrade` |
| リポジトリの削除 | `sudo add-apt-repository --remove ppa:…` | ―（削除するリポジトリはない） | `sudo dnf copr remove …` |
| ディストリビューションによるレビュー | なし | なし | なし |

- 追加リポジトリのパッケージは root としてインストールされ、システム自身の
  パッケージと衝突することがあり、更新されなくなることもあります。まず
  ディストリビューションのリポジトリを探し、次に Flatpak を探し、それでも
  なければ、信頼できる人の追加リポジトリを探しましょう。
- `apt policy` はパッケージがどこから来たのかを表示します。apt は最も新しい
  バージョンを選びます。
- ビルドする前には必ず `PKGBUILD` を読みましょう。`makepkg` を sudo で実行しては
  いけません。`pacman -Qm` は *foreign*（外部）パッケージを一覧表示します。
  `pacman -Syu` はそれらを更新しませんが、`yay` のような AUR ヘルパーは更新します。

## ユニバーサルパッケージ

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| 入手元 | Flathub（または他の *リモート*） | Snap Store（Canonical） | 開発者の Web サイト |
| サンドボックス | あり | あり（*classic* を除く） | なし |
| 更新 | `flatpak update` | バックグラウンドで自動的に | 自分で。新しいファイルをダウンロードする |
| インストール | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` をして実行する |

- Flatpak のプログラムには、ドメイン名を逆にした形の ID（`org.gimp.GIMP`）が
  あり、`flatpak run` で起動します。`--user` を付けるとホームディレクトリに
  インストールされ、そこには独自のリモートがあります。
- Snap は Ubuntu の標準です。classic confinement の snap には `--classic` が
  必要で、どの snap にも `stable` や `edge` のようなチャンネルがあります。
- AppImage には FUSE 2 が必要で（Ubuntu 24.04 と Debian 13 では `libfuse2t64`、
  Arch では `fuse2`、Fedora では `fuse-libs`）、サンドボックスも自動更新も
  ありません。

**目安:** システムやコマンドラインのプログラムにはディストリビューションの
パッケージ、デスクトップのプログラムには Flatpak、Ubuntu を使っているときや
snap しかないプログラムには Snap、プログラムを手早く試すには AppImage を使い
ましょう。
