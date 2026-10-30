# The Debian family: apt and PPAs

Debian, Ubuntu and distributions built on them, such as Linux Mint, make up
the **Debian family**. They all use the package manager **apt** and packages
in the `.deb` format. This chapter always runs on a distribution from the
Debian family – right now it's **{{distro}}**. You can switch between Ubuntu
and Debian in the menu at the top.

## apt in short

| What | Command |
|---|---|
| Refresh the package list | `apt update` |
| Upgrade everything | `apt upgrade` |
| Install | `apt install X` |
| Remove | `apt remove X` |
| Search | `apt search X` |
| Package info | `apt show X` |
| List installed | `apt list --installed` |

Commands that change the system require root, so they're run with `sudo`.

```quiz
Which of these commands change the system and therefore need `sudo`?
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
Searching and showing information only read the package lists. Installing and
removing change the system.
```

## update and upgrade are different things

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

```quiz
What does `sudo apt update` do?
- [x] Downloads the list of which packages and versions are available
- [ ] Installs new versions of the packages you already have
- [ ] Updates apt itself to the latest version
---
`apt update` only refreshes the list. `apt upgrade` is what installs the new
versions.
```

## Installing and removing

```sh
sudo apt install htop
```

`apt remove` removes a program but leaves its settings files behind.
`apt purge` removes those too. When apt asks `Do you want to continue? [Y/n]`,
the capital `Y` means that just pressing Enter answers yes. With the `-y`
option, apt answers yes automatically.

Searching doesn't need root. Try it:

```try
apt search htop
```

### apt or apt-get?

`apt` is the modern, user-friendly variant with a progress bar and colors.
`apt-get` and `apt-cache` are older but have more stable output, so they're
still used in scripts.

### Under the hood: dpkg and .deb

The packages are `.deb` files, and it's actually the program `dpkg` that
unpacks them. apt takes care of everything around that: downloading,
dependencies and updates.

## Extra repositories – convenient, but at your own risk

The distribution's repositories hold tens of thousands of packages – but not
everything. A niche program may not be there at all, or only in an old
version. That is why there are **extra repositories** where developers and
users share their own packages.

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
a Flatpak (in the chapter about universal packages), and only after that in an
extra repository from someone you trust.

## PPAs

A **PPA** (*Personal Package Archive*) is a small repository on Launchpad,
Canonical's service for Ubuntu. The developer uploads the source code and
Launchpad builds `.deb` packages for different Ubuntu releases. A PPA is
written `ppa:user/name`. PPAs are not reviewed by the distribution.

In the rest of this chapter you install a made-up program, `moonphase` (it
shows the phase of the moon in the terminal), from a PPA.

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

```quiz
You add a repository by hand, by creating a file in
`/etc/apt/sources.list.d/`. What do you need to do before apt can install
packages from it?
- [ ] Nothing – apt reads the file by itself the next time you install
- [x] Run `sudo apt update`
- [ ] Restart the computer
---
`add-apt-repository` runs `apt update` for you. When you create the file
yourself, you have to do it yourself.
```

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

```quiz
The same package is both in the distribution's repository and in a PPA you
have added. Which version does apt pick?
- [ ] Always the one from the distribution's repository
- [ ] The one from the repository that was added last
- [x] The highest version
---
That is why a PPA can replace one of the distribution's own packages.
```

### PPAs on Debian?

PPAs are built for Ubuntu, not Debian. On Debian they may work, but the
packages can need other library versions than the ones Debian has. A mix of
Debian and Ubuntu packages is jokingly called a *FrankenDebian* and is a
common way to break the system. On Debian it is better to use *backports*, a
Flatpak or the developer's own repository for Debian.

### Updates and removing a PPA

Packages from a PPA are updated together with everything else, with
`sudo apt update && sudo apt upgrade`. To remove the PPA:

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

The program stays, but gets no more updates. To get rid of it completely,
also run `sudo apt remove moonphase`.

Every repository you add is one more sender you trust. Keep the list short and
clean out what you no longer use.
