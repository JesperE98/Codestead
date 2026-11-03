# The Arch family: pacman and the AUR

Arch Linux and distributions built on it, such as Manjaro and EndeavourOS,
make up the **Arch family**. They use the package manager **pacman** and
packages in the `.pkg.tar.zst` format. This chapter always runs on a
distribution from the Arch family – right now it's **{{distro}}**.

## pacman in short

| What | Command |
|---|---|
| Refresh the package list | `pacman -Sy` |
| Upgrade everything | `pacman -Syu` |
| Install | `pacman -S X` |
| Remove | `pacman -R X` |
| Search | `pacman -Ss X` |
| Package info | `pacman -Si X` |
| List installed | `pacman -Q` |

Commands that change the system require root, so they're run with `sudo`.

pacman uses short options where the **capital letter** is the operation and
the lowercase letters are modifiers:

| Option | Means |
|---|---|
| `-S` | Sync – install from the repositories |
| `-R` | Remove |
| `-Q` | Query – ask about installed packages |
| `y` | Refresh the package database |
| `u` | Upgrade all packages |
| `s` | Search (with -S and -Q), or remove dependencies (with -R) |
| `i` | Info |

```quiz
What does the capital `Q` in `pacman -Q` mean?
- [ ] Quit – stop pacman
- [x] Query – ask about installed packages
- [ ] Quick – install without asking
---
`-Q` asks about what is installed, `-S` installs from the repositories and
`-R` removes.
```

Searching doesn't need root. Try it:

```try
pacman -Ss htop
```

## Updating the system

```sh
sudo pacman -Syu
```

`-Syu` means: synchronize (`S`), refresh the database (`y`) and upgrade
everything (`u`). Arch is a *rolling release*, so you'll run this often.

> **Important!** Never run just `pacman -Sy` followed by `pacman -S package`.
> The new package might then need newer libraries than the ones you have – a
> so-called *partial upgrade* that can break your system. Always use `-Syu`.

```quiz
Why should you not run `pacman -Sy` and then `pacman -S package`?
- [ ] Because `-Sy` deletes the package database
- [x] The new package may need newer libraries than you have, which can break the system
- [ ] Because pacman can only install one package per day
---
Always upgrade everything at once with `-Syu`.
```

## Installing and removing

```sh
sudo pacman -S htop
```

`pacman -R package` removes a package, and `pacman -Rs package` also removes
dependencies that nothing else needs.

## The AUR

The distribution's repositories hold tens of thousands of packages – but not
everything. A niche program may not be there at all, or only in an old
version. In the Arch family, the answer is the **AUR** (*Arch User
Repository*).

The AUR is different from ordinary repositories: there are no ready-made
packages, only **build recipes**. A recipe is called `PKGBUILD` and is a small
bash script that says where the source code is and how the program is built.
You download the recipe, build the package yourself and install it with
pacman. The AUR is enormous – almost everything that exists for Linux is
there – but anyone can upload a recipe.

```quiz
What do you download from the AUR?
- [ ] A ready-made `.pkg.tar.zst` package, reviewed by Arch
- [x] A build recipe (`PKGBUILD`) that you build the package from yourself
- [ ] A Flatpak
```

### At your own risk

The packages in the distribution's own repositories are tested together,
signed and reviewed by the distribution's developers. The packages in the AUR
aren't reviewed by Arch. Keep this in mind:

- **Packages are installed as root.** A package can do anything at all to the
  computer. You trust whoever wrote the recipe as much as you trust the
  distribution.
- **It can clash.** A package can replace the system's own libraries or need
  other versions than the ones you have.
- **It can stop being updated.** If the person maintaining the recipe loses
  interest, you get no more security updates for the program.

A good rule of thumb: look in the distribution's repositories first, then for
a Flatpak (in the chapter about universal packages), and only after that in
the AUR.

In the rest of this chapter you install a made-up program, `moonphase` (it
shows the phase of the moon in the terminal), from the AUR.

### Preparations

To download recipes and build packages you need `git` and `base-devel` (a
compiler, `make`, `fakeroot` and more):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` skips what is already installed.

### Get the recipe

Every AUR package is a git repository of its own:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> If you misspell the package name, git says *"You appear to have cloned an
> empty repository"* and the directory is empty. The AUR lets you clone
> anything!

### Read the PKGBUILD – every time

```sh
less PKGBUILD
```

`PKGBUILD` is a script that runs on your computer. At least check:

- that `source=` downloads from the program's real website,
- that `build()` and `package()` only build and copy files – and don't, for
  example, download and run something else (`curl … | sh`),
- that the package looks maintained (dates, comments on aur.archlinux.org).

### Build and install

```sh
makepkg -si
```

`makepkg` reads `PKGBUILD`, downloads the source code, builds it and packs a
`.pkg.tar.zst` file. `-s` installs missing dependencies and `-i` installs the
package with pacman when it is done. Do **not** run makepkg with sudo – it
refuses to run as root, and uses sudo by itself when needed.

```sh
ls
moonphase
```

### "Foreign" packages

pacman knows nothing about the AUR. Packages that don't come from the
repositories are called *foreign* and are listed with:

```sh
pacman -Qm
```

It also means that `sudo pacman -Syu` does **not** update AUR packages. You
have to fetch the new recipe yourself (`git pull`) and rebuild – or let an
AUR helper do it.

```quiz
You have installed `moonphase` from the AUR and run `sudo pacman -Syu`. Is
`moonphase` updated?
- [ ] Yes – pacman updates every installed package
- [x] No – pacman knows nothing about the AUR
---
Fetch the new recipe with `git pull` and rebuild, or use an AUR helper.
```

### The AUR helper yay

An AUR helper does all of this for you: it searches, downloads, shows the
`PKGBUILD`, builds and installs. The most common one is **yay** (another is
*paru*). yay itself only exists in the AUR, so it is installed by hand once.
The package `yay-bin` is precompiled and the quickest:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

After that yay is used much like pacman – but without sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (or just `yay`) upgrades both the packages from the repositories
and your AUR packages. Convenience doesn't mean you can stop reading the
recipes!

There is no repository to remove for the AUR – every package is its own
recipe. Clean out what you no longer use.
