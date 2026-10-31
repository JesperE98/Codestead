# Flatpak, Snap and AppImage

A normal package is built for one particular distribution and release. For
someone making a desktop program that is a problem: the same program has to be
repackaged for Debian, Ubuntu, Fedora, Arch and all their releases.
**Universal package formats** solve this by bundling most of what the program
needs inside the package – so one and the same package works on every
distribution.

The three big ones are **Flatpak**, **Snap** and **AppImage**. They don't
replace the distribution's package manager but complement it, mainly for
desktop programs.

> The simulator only has a terminal. When you start a graphical program you
> get a line saying it would have opened in a window instead.

## Four ways to install a program

| | Distribution package | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| Comes from | The distribution's repositories | Flathub (or other *remotes*) | Snap Store (Canonical) | The developer's website |
| Works on | One distribution and release | All | All that have `snapd` | All (needs FUSE) |
| Sandbox | No | Yes | Yes (except *classic*) | No |
| Size | Small – shares libraries with the system | Large the first time (runtimes), then shared | Large – every snap and its base | Large – everything in one file |
| Updates | With the system (`apt upgrade` …) | `flatpak update` | Automatically in the background | Yourself – download a new file |
| Good for | System programs, command-line tools, servers | Desktop programs | Ubuntu, desktops and servers | Single programs, trying new versions |

A **sandbox** means that the program can only reach what it has been allowed
to, for example the network or your downloads folder, instead of your whole
home directory.

```quiz
Which format is updated automatically in the background?
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
Flatpak programs are updated with `flatpak update`, and an AppImage is
replaced by downloading a new file.
```

## Flatpak

Flatpak is the format most distributions have agreed on for desktop programs.
Programs are downloaded from a **remote** – almost always **Flathub** – and
share common **runtimes** (for example `org.gnome.Platform`) so that not
every program has to bring everything along.

:::debian
### Install Flatpak

Flatpak is not preinstalled on {{distro}}:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Install Flatpak

Flatpak is in the Arch repositories:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak on {{distro}}

Fedora Workstation comes with Flatpak, with Fedora's own remote `fedora`
already added:

```sh
flatpak --version
flatpak remotes
```
:::

### Add Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` makes the command not fail if Flathub is already there –
useful in scripts and install guides.

### Search, install and run

Every program has an **ID** written as a reversed domain name, for example
`org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak shows which **permissions** the program wants and which runtimes come
along. Notice the size: the first program pulls in a runtime of several
hundred megabytes, but the next program that uses the same runtime is small.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### For the whole system or just for you

Without options Flatpak installs for the **whole system** (in
`/var/lib/flatpak`). On a desktop Flatpak asks for your password in a window,
so sudo is not needed. With `--user` the program ends up in your home
directory instead (`~/.local/share/flatpak`) and no other user sees it. The
user installation has **its own remotes**, so Flathub has to be added with
`--user` too:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
What happens when you install a Flatpak with `--user`?
- [ ] It is installed for the whole system, in `/var/lib/flatpak`
- [x] It ends up in your home directory, and no other user sees it
- [ ] It runs without a sandbox
---
Remember that the user installation has its own remotes – Flathub has to be
added with `--user` too.
```

### Update and remove

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` removes runtimes that no installed program uses any more.

## Snap

Snap is **Canonical's** format and the default on Ubuntu – there, for
example, Firefox is a snap. Snaps come from the **Snap Store**, which is run
by Canonical, and are managed by the `snapd` service. They are updated
automatically in the background.

:::debian
### Snap on Ubuntu and Debian

Ubuntu already has Snap. On Debian you install `snapd` first:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap on Arch

Snap is not in the Arch repositories – only in the AUR. Build it as in the
chapter about the Arch family:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

On a real system you also need to start the service with
`sudo systemctl enable --now snapd.socket`. That is a sign that Snap is not
at home on Arch: most people there use Flatpak.
:::

:::redhat
### Snap on Fedora

Fedora bets on Flatpak, but Snap is in the repositories:

```sh
sudo dnf install snapd
```
:::

### Using snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Installed snaps show up as programs in `/snap/bin`. Installing and removing
needs root.

### Strict or classic

Most snaps run **strictly** in a sandbox. Programs that need access to the
whole system, such as code editors, are published with **classic
confinement**. Then you have to approve it yourself with `--classic`:

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
A snap is published with classic confinement. What do you need to add to
install it?
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### Channels and updates

Every snap has **channels**: `stable`, `candidate`, `beta` and `edge` (the
latest, untested version). `snap info` shows them and `--channel=beta`
picks another one. Updates happen automatically, but you can force them and
remove snaps:

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap also has critics: the Snap Store is run only by Canonical, the automatic
updates can't be turned off completely and programs can be slow to start the
first time.

## AppImage

An **AppImage** is a whole program in **one single file**. You download it
from the program's website, make it executable and start it – no installation
and no root. To get rid of the program, you delete the file.

There is already a downloaded AppImage in your home directory, in
`~/{{downloads}}`:

```sh
cd ~/{{downloads}}
ls -l
```

What happens if you start it right away?

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
The file has no `x` permission.
```

Downloaded files are never executable to begin with. Make it executable and
start it:

```sh
chmod +x {{calculator}}
./{{calculator}}
```

```try
chmod +x ~/{{downloads}}/{{calculator}}
---
Now the file is executable. Check with `ls -l ~/{{downloads}}`.
```

### FUSE

An AppImage mounts itself as a file system using **FUSE**, and needs the
older version 2 of the library (`libfuse.so.2`). Without it you get the error
*"AppImages require FUSE to run"*.

:::debian
On Ubuntu 24.04 and Debian 13 the package is called `libfuse2t64` (*t64*
comes from the transition to 64-bit time; in older releases it was called
`libfuse2`):

```sh
sudo apt update
sudo apt install libfuse2t64
./{{calculator}}
```

> Do **not** install the package `fuse` on Ubuntu – it replaces `fuse3`,
> which the desktop needs.
:::

:::arch
On Arch the package is called `fuse2`:

```sh
sudo pacman -S fuse2
./{{calculator}}
```
:::

:::redhat
On Fedora the package is called `fuse-libs`:

```sh
sudo dnf install fuse-libs
./{{calculator}}
```
:::

### Look inside

An AppImage can also be unpacked. That works even without FUSE:

```sh
./{{calculator}} --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` unpacks temporarily and starts right away.

### Keep in mind

- AppImage has **no sandbox** – the program runs as you and can reach
  everything you can. Only download from the program's official website.
- There are **no automatic updates**. You download a new file when a new
  version comes out (some programs can update themselves).
- The program does not show up in the application menu by itself. Tools like
  *Gear Lever* or *AppImageLauncher* can fix that.

## Which one should I choose?

1. **The distribution's packages** for system and command-line programs –
   they are the smallest, fastest and are updated with the rest of the
   system.
2. **Flatpak** for desktop programs when you want a newer version or a
   program that is missing from the repositories.
3. **Snap** if you run Ubuntu, or when the program only exists as a snap.
4. **AppImage** to quickly try a program, or when the developer only offers
   that format.
