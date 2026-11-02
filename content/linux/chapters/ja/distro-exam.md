# テスト: ディストリビューションとパッケージ

次の問題に答えてください。合格には 80 % が必要です。

```quiz
最近のどのディストリビューションでも、ディストリビューションの名前とバージョンが
わかるファイルはどれですか？
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` は Linux カーネルのバージョンを表示します。
```

```quiz
パッケージマネージャーとパッケージ形式の正しい組み合わせはどれですか？
- [x] `pacman` と `.pkg.tar.zst`
- [ ] `dnf` と `.deb`
- [ ] `apt` と `.rpm`
```

```quiz
バージョンのない *ローリングリリース* のディストリビューションはどれですか？
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
`apt update` と `apt upgrade` の違いは何ですか？
- [x] `update` は利用できるパッケージの一覧をダウンロードし、`upgrade` は新しいバージョンをインストールする
- [ ] `update` は新しいバージョンをインストールし、`upgrade` は一覧をダウンロードする
- [ ] 違いはない
```

```quiz
Arch でパッケージ `htop` をインストールするコマンドはどれですか？
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
`pacman -Sy` を実行してから `pacman -S パッケージ` を実行するのがよくないのはなぜですか？
- [ ] パッケージが 2 回インストールされるから
- [x] 部分アップグレードになり、システムを壊すおそれがあるから
- [ ] `-Sy` はインストール済みのパッケージをすべて削除するから
```

```quiz
dnf が `Is this ok [y/N]` と聞いてきて、Enter だけを押しました。どうなりますか？
- [ ] パッケージがインストールされる
- [x] 何もインストールされない。既定値は No である
```

```quiz
AUR について正しいものはどれですか？
- [x] ビルド済みのパッケージではなく、ビルドレシピ（`PKGBUILD`）がある
- [x] パッケージは Arch によるレビューを受けていない
- [ ] `sudo pacman -Syu` で AUR のパッケージも更新される
- [ ] `makepkg` は sudo を付けて実行するべきである
```

```quiz
Fedora で COPR リポジトリを追加するコマンドはどれですか？
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` と `makepkg -si`
```

```quiz
Snap パッケージはどのように更新されますか？
- [ ] `flatpak update` で
- [x] バックグラウンドで自動的に
- [ ] 開発者の Web サイトから新しいファイルをダウンロードして
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
ダウンロードしたファイルは、最初は決して実行可能になっていません。先に
`chmod +x ~/{{downloads}}/{{calculator}}` を実行しましょう。
```

```quiz
ディストリビューションのリポジトリにない、デスクトッププログラムの新しい
バージョンが欲しいです。目安によれば、最初に何を勧めますか？
- [ ] 知らない人の追加リポジトリ
- [x] Flatpak
- [ ] root としてソースコードからプログラムをビルドする
```
