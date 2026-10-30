# AUR, PPA and COPR

The distribution's repositories hold tens of thousands of packages – but not
everything. A niche program may not be there at all, or only in an old
version. That is why there are **extra repositories** where developers and
users share their own packages. Each family has its own: **PPA** on Ubuntu,
the **AUR** on Arch and **COPR** on Fedora.

In this chapter you install the same made-up program, `moonphase` (it shows
the phase of the moon in the terminal), from the extra repository on
{{distro}}. Switch distribution in the menu if you want to compare how it
works in the other families.

## Convenient – but at your own risk

The packages in the distribution's own repositories are tested together,
signed and reviewed by the distribution's developers. An extra repository, on
the other hand, can be created by anyone. Keep this in mind before you add
one:

- **Packages are installed as root.** A package can do anything at all to the
  computer. You trust whoever built it as much as you trust the distribution.
- **It can clash.** A package from an extra repository can replace the
  system's own libraries or need other versions than the ones you have.
- **It can stop being updated.** If the person running the repository loses
  interest, you get no more security updates for the program.

A good rule of thumb: look in the distribution's repositories first, then for
a Flatpak (next chapter), and only after that in an extra repository from
someone you trust.

## Three families, three solutions

| | PPA | AUR | COPR |
|---|---|---|---|
| Family | Ubuntu (and e.g. Linux Mint) | Arch (and e.g. Manjaro, EndeavourOS) | Fedora (and the RHEL family) |
| Website | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| What you download | Ready-made `.deb` packages | A build recipe (`PKGBUILD`) – you build it yourself | Ready-made `.rpm` packages |
| Adding it | `add-apt-repository ppa:…` | `git clone …` and `makepkg -si` | `dnf copr enable …` |
| Reviewed by the distribution | No | No | No |

:::debian
## PPAs on {{distro}}

A **PPA** (*Personal Package Archive*) is a small repository on Launchpad,
Canonical's service for Ubuntu. The developer uploads the source code and
Launchpad builds `.deb` packages for different Ubuntu releases. A PPA is
written `ppa:user/name`.

### The add-apt-repository tool

PPAs are added with `add-apt-repository`, which lives in the package
`software-properties-common`. It is preinstalled on Ubuntu, but not on
Debian:

```sh
sudo apt update
sudo apt install software-properties-common
```

### Add the PPA

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

You see what is being added and a description of the PPA. Press Enter to
continue (with `-y` you skip the question). Two things happen:

1. A file is created in `/etc/apt/sources.list.d/`. It says where the
   repository is and contains the key the packages are signed with.
2. `add-apt-repository` runs `apt update` for you – otherwise apt would not
   know about the new packages. If you add a source by hand (by creating a
   file) you have to run `sudo apt update` yourself afterwards.

Look at the file:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Notice `Suites: noble` – the packages are built for Ubuntu 24.04.

### Install and run

Now the package is installed just like any other package:

```sh
sudo apt install moonphase
moonphase
```

### Where does the package come from?

`apt policy` shows which repositories a package is in and which one wins:

```sh
apt policy moonphase
```

`***` marks the installed version. The number `500` is the repository's
priority and `100` means "what is already installed". If the same package is
in several repositories, apt picks the highest version – so a PPA can replace
one of the distribution's own packages with its own version.

### PPAs on Debian?

PPAs are built for Ubuntu, not Debian. On Debian they may work, but the
packages can need other library versions than the ones Debian has. A mix of
Debian and Ubuntu packages is jokingly called a *FrankenDebian* and is a
common way to break the system. On Debian it is better to use *backports*, a
Flatpak or the developer's own repository for Debian.

### Remove a PPA

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

The program stays, but gets no more updates. To get rid of it completely,
also run `sudo apt remove moonphase`.
:::

:::arch
## The AUR on {{distro}}

The **AUR** (*Arch User Repository*) is different from the others: there are
no ready-made packages, only **build recipes**. A recipe is called `PKGBUILD`
and is a small bash script that says where the source code is and how the
program is built. You download the recipe, build the package yourself and
install it with pacman. The AUR is enormous – almost everything that exists
for Linux is there – but anyone can upload a recipe.

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
:::

:::redhat
## COPR on {{distro}}

**COPR** (*Cool Other Package Repo*) is Fedora's build service. Anyone with a
Fedora account can build `.rpm` packages there, and every project becomes a
repository of its own called `user/project`.

### The repositories you have now

```sh
dnf repolist
```

### Enable a COPR repository

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf reminds you that the repository is not part of Fedora and that the
quality may vary. The question defaults to **No**, so answer `y`. A new file
is created in `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Install and run

dnf fetches the new repository information by itself, so the package can be
installed right away:

```sh
sudo dnf install moonphase
moonphase
```

### Where does the package come from?

```sh
dnf info moonphase
```

The line `From repository` shows that the package came from COPR. Packages
from COPR are updated as usual with `sudo dnf upgrade`.

### Disable or remove

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` leaves the file in place but turns the repository off, `remove`
deletes it completely. The program stays, but gets no more updates.

### RPM Fusion

Another common extra repository for Fedora is **RPM Fusion**. It has things
Fedora can't or won't include, such as certain media codecs and drivers. It
is a large, shared project – not a single user's repository as in COPR.
:::

## Updates and maintenance

| | Updated with | Remove the repository |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu` – or rebuild yourself | – (there is no repository to remove) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Extra repositories are a powerful tool, but every repository you add is one
more sender you trust. Keep the list short and clean out what you no longer
use.
