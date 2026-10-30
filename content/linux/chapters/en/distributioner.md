# Distributions and families

You now know the basics, and they work the same on every distribution. So
what is it that sets them apart?

:::debian
You're currently running **{{distro}}** from the **Debian family**.
:::

:::arch
You're currently running **{{distro}}** from the **Arch family**.
:::

:::redhat
You're currently running **{{distro}}** from the **Red Hat family**.
:::

This chapter is an overview. Feel free to switch distribution in the menu at
the top and do the tasks again – you'll see the differences right away. After
this chapter comes one chapter for each family: the **Debian family** (apt),
the **Arch family** (pacman) and the **Red Hat family** (dnf). Each of them
always runs on a distribution from that family, so you can do all three.

## What's the same everywhere?

- **The Linux kernel** – though in different versions.
- **The bash shell** and the basic tools (`ls`, `cp`, `grep` ...) from GNU.
- **The directory layout** – `/etc`, `/home`, `/usr/bin` and so on.
- **systemd**, which starts the system and manages services, on almost every
  major distribution.

```predict
$ echo $SHELL
/bin/bash
---
The shell is bash on every distribution in the simulator – whichever one you
have chosen.
```

## What's different?

| | Debian family | Arch family | Red Hat family |
|---|---|---|---|
| Package manager | `apt` | `pacman` | `dnf` |
| Package format | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-level tool | `dpkg` | (pacman) | `rpm` |
| Sudo group | `sudo` | `wheel` | `wheel` |
| Releases | Stable versions | Rolling | A new version every 6 months (Fedora) |

```quiz
In which families is the group that may use sudo called `wheel`?
- [ ] The Debian family
- [x] The Arch family
- [x] The Red Hat family
---
The Debian family calls the group `sudo`; Arch and Red Hat call it `wheel`.
```

### Release models

- **Stable with fixed versions** – Debian puts out a new version roughly every
  other year, and Ubuntu LTS (*Long Term Support*) comes every other year with
  five years of support. Programs get security fixes but are rarely replaced
  with newer versions. Great for servers.
- **Rolling** – Arch has no versions at all. You update continuously and
  always get the latest. It asks a little more of you as a user.
- **Fast-moving** – Fedora releases a new version about every six months and
  serves as a kind of test bed for Red Hat Enterprise Linux (RHEL), which in
  turn has ten years of support and is used by businesses.

```quiz
Which distribution has no versions at all, but is updated continuously
(*rolling*)?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

## Which distribution am I running?

The file `/etc/os-release` exists on all modern distributions and tells you
the name and version:

```sh
cat /etc/os-release
```

The kernel version is shown with `uname -r`:

```sh
uname -r
```

```try
cat /etc/os-release
---
The lines `NAME` and `PRETTY_NAME` tell you which distribution it is.
```

## Packages, repositories and dependencies

On Windows and macOS you often download programs from a website. On Linux you
install almost everything with a **package manager** instead. This is the
biggest difference between the distribution families.

- A **package** is a program (or library) packed into a file, together with
  information about its version and what it needs.
- A **repository** is a server where the distribution publishes all of its
  packages. They're tested and signed, so you know they haven't been
  tampered with.
- A **dependency** is another package that is needed. The package manager
  installs dependencies automatically.

The package manager also keeps track of what is installed, and can update
*everything* on the computer with a single command. Commands that change the
system require root, so they're run with `sudo`.

```quiz
A package needs another package that you don't have. What happens when you
install it with the package manager?
- [ ] The installation stops, and you have to find the other package yourself
- [x] The package manager installs the dependency automatically
- [ ] The package is installed, but doesn't work until you download the other one
```

### Same program, different names

Packages usually have the same name everywhere – but not always. A few
examples:

| Program | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH client | `openssh-client` | `openssh` | `openssh-clients` |

Always search with the package manager if you're unsure of the name.

## The package manager's configuration

:::debian
In the Debian family, the files in `/etc/apt/sources.list.d/` specify which
*repositories* apt fetches packages from:

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
In the Arch family, pacman is configured by `/etc/pacman.conf`, and the list
of mirror servers lives in `/etc/pacman.d/mirrorlist`:

```sh
cat /etc/pacman.conf
```
:::

:::redhat
In the Red Hat family, dnf's settings are in `/etc/dnf/dnf.conf`, and the
*repositories* are described by files in `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
```
:::

## Which one should I choose?

There's no right answer, but here's a rule of thumb:

- **New to Linux?** Ubuntu, Linux Mint or Fedora.
- **A server?** Debian, Ubuntu LTS or a RHEL clone such as Rocky Linux.
- **Want to learn how everything fits together?** Arch – and its excellent
  wiki.
