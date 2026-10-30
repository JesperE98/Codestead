# Summary: distributions and packages

## Families

The basics are the same on every distribution: the Linux kernel, bash and the
GNU tools, the directory layout and (almost everywhere) systemd. What sets the
families apart is mainly how programs are installed.

| | Debian family | Arch family | Red Hat family |
|---|---|---|---|
| Examples | Debian, Ubuntu, Linux Mint | Arch, Manjaro, EndeavourOS | Fedora, RHEL, Rocky Linux |
| Package manager | `apt` | `pacman` | `dnf` |
| Package format | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-level tool | `dpkg` | (pacman) | `rpm` |
| Sudo group | `sudo` | `wheel` | `wheel` |
| Releases | Stable versions | Rolling | A new version every 6 months (Fedora) |

- `cat /etc/os-release` shows which distribution you're running, and
  `uname -r` shows the kernel version.
- A **package** is a program packed into a file, a **repository** is a server
  with the distribution's tested and signed packages, and a **dependency** is
  another package that is needed – the package manager installs it
  automatically.
- Commands that change the system require root, so they're run with `sudo`.

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

Things to remember:

- **apt**: `apt update` only downloads the list of packages – `apt upgrade`
  installs the new versions. Run `update` first. `[Y/n]` means Enter answers
  yes.
- **pacman**: the capital letter is the operation (`-S`, `-R`, `-Q`) and the
  lowercase letters are modifiers. Always upgrade with `-Syu` – never
  `-Sy` followed by `-S package` (a partial upgrade can break the system).
- **dnf**: fetches package information by itself. `dnf check-update` exits
  with `100` when there are updates. `[y/N]` means Enter answers **no**.

Package names are usually the same everywhere, but not always – Vim is
`vim-enhanced` in Fedora. Search if you're unsure.

## Extra repositories

| | PPA | AUR | COPR |
|---|---|---|---|
| Family | Ubuntu (and e.g. Linux Mint) | Arch (and e.g. Manjaro, EndeavourOS) | Fedora (and the RHEL family) |
| What you download | Ready-made `.deb` packages | A build recipe (`PKGBUILD`) – you build it yourself | Ready-made `.rpm` packages |
| Adding it | `add-apt-repository ppa:…` | `git clone …` and `makepkg -si` | `dnf copr enable …` |
| Updated with | `sudo apt update && sudo apt upgrade` | `yay -Syu` – or rebuild yourself | `sudo dnf upgrade` |
| Remove the repository | `sudo add-apt-repository --remove ppa:…` | – (there is no repository to remove) | `sudo dnf copr remove …` |
| Reviewed by the distribution | No | No | No |

- Packages from an extra repository are installed as root, can clash with the
  system's own packages and can stop being updated. Look in the
  distribution's repositories first, then for a Flatpak, and only after that
  in an extra repository from someone you trust.
- `apt policy` shows where a package comes from; apt picks the highest
  version.
- Always read the `PKGBUILD` before you build. Don't run `makepkg` with sudo.
  `pacman -Qm` lists *foreign* packages, and `pacman -Syu` doesn't update
  them – an AUR helper such as `yay` does.

## Universal packages

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| Comes from | Flathub (or other *remotes*) | Snap Store (Canonical) | The developer's website |
| Sandbox | Yes | Yes (except *classic*) | No |
| Updates | `flatpak update` | Automatically in the background | Yourself – download a new file |
| Install | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` and run it |

- Flatpak programs have an ID written as a reversed domain name
  (`org.gimp.GIMP`) and are started with `flatpak run`. `--user` installs in
  your home directory, with its own remotes.
- Snap is the default on Ubuntu. Snaps with classic confinement need
  `--classic`, and every snap has channels such as `stable` and `edge`.
- An AppImage needs FUSE 2 (`libfuse2t64` on Ubuntu 24.04 and Debian 13,
  `fuse2` on Arch, `fuse-libs` on Fedora) and has no sandbox and no automatic
  updates.

**Rule of thumb:** the distribution's packages for system and command-line
programs, Flatpak for desktop programs, Snap on Ubuntu or when a program only
exists as a snap, and AppImage to quickly try a program.
