# Package management

On Windows and macOS you often download programs from a website. On Linux you
install almost everything with a **package manager** instead. This is the
biggest difference between the distribution families – and this chapter looks
different depending on which distribution you've chosen. Right now it's
**{{pm}}** on {{distro}}.

## Packages, repositories and dependencies

- A **package** is a program (or library) packed into a file, together with
  information about its version and what it needs.
- A **repository** is a server where the distribution publishes all of its
  packages. They're tested and signed, so you know they haven't been
  tampered with.
- A **dependency** is another package that is needed. The package manager
  installs dependencies automatically.

The package manager also keeps track of what is installed, and can update
*everything* on the computer with a single command.

## The same thing – three dialects

| What | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Refresh the package list | `apt update` | `pacman -Sy` | `dnf check-update` |
| Upgrade everything | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Install | `apt install X` | `pacman -S X` | `dnf install X` |
| Remove | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Search | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Package info | `apt show X` | `pacman -Si X` | `dnf info X` |
| List installed | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Commands that change the system require root, so they're run with `sudo`.

:::debian
## apt on {{distro}}

### update and upgrade are different things

This confuses almost everyone at first:

- `apt update` downloads the **list** of which packages and versions are
  available. It doesn't install anything.
- `apt upgrade` **installs** new versions of what you already have.

So always run `update` first. The most common way to update the system is:

```sh
sudo apt update && sudo apt upgrade
```

Before you've run `apt update` (on a freshly installed server, for example),
the package list is empty and apt can't find any packages at all.

### Installing and removing

```sh
sudo apt install htop
```

`apt remove` removes a program but leaves its settings files behind.
`apt purge` removes those too. When apt asks `Do you want to continue? [Y/n]`,
the capital `Y` means that just pressing Enter answers yes. With the `-y`
option, apt answers yes automatically.

### apt or apt-get?

`apt` is the modern, user-friendly variant with a progress bar and colors.
`apt-get` and `apt-cache` are older but have more stable output, so they're
still used in scripts.

### Under the hood: dpkg and .deb

The packages are `.deb` files, and it's actually the program `dpkg` that
unpacks them. apt takes care of everything around that: downloading,
dependencies and updates.
:::

:::arch
## pacman on {{distro}}

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

### Updating the system

```sh
sudo pacman -Syu
```

`-Syu` means: synchronize (`S`), refresh the database (`y`) and upgrade
everything (`u`). Arch is a *rolling release*, so you'll run this often.

> **Important!** Never run just `pacman -Sy` followed by `pacman -S package`.
> The new package might then need newer libraries than the ones you have – a
> so-called *partial upgrade* that can break your system. Always use `-Syu`.

### Installing and removing

```sh
sudo pacman -S htop
```

`pacman -R package` removes a package, and `pacman -Rs package` also removes
dependencies that nothing else needs.

### The AUR

Besides the official repositories there's the **AUR** (*Arch User
Repository*), where users share build recipes for thousands of programs.
People often use a helper such as `yay` or `paru` to install from it. The
packages in the AUR aren't reviewed by Arch – always read the build recipe
(the PKGBUILD) first.
:::

:::redhat
## dnf on {{distro}}

### Automatic metadata

dnf fetches new package information by itself when it needs to, so there's no
separate step like `apt update`. If you want to see which updates are
available, run:

```sh
dnf check-update
```

The exit code is `100` if there are updates – handy in scripts.

### Installing and removing

```sh
sudo dnf install htop
```

Note the question `Is this ok [y/N]`. The capital `N` means that **No** is
the default – if you just press Enter, the installation is cancelled. Type
`y` and Enter, or use `-y`.

### Upgrading the system

```sh
sudo dnf upgrade
```

### Under the hood: rpm

The packages are `.rpm` files and the low-level tool is called `rpm`. dnf
replaced the older `yum`, and Fedora 41 brought the new version **dnf5**,
which is considerably faster. On RHEL, Rocky and AlmaLinux the command is
also called `dnf`.
:::

## Same program, different names

Packages usually have the same name everywhere – but not always. A few
examples:

| Program | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH client | `openssh-client` | `openssh` | `openssh-clients` |

Always search with the package manager if you're unsure of the name.

## Universal package formats

There are also formats that work on every distribution: **Flatpak** (common
for desktop applications, via Flathub), **Snap** (from Canonical, the default
on Ubuntu) and **AppImage** (a single executable file). They have their own
commands and complement the distribution's package manager.
