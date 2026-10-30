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

Feel free to switch distribution in the menu at the top and do the tasks
again – you'll see the differences right away.

## What's the same everywhere?

- **The Linux kernel** – though in different versions.
- **The bash shell** and the basic tools (`ls`, `cp`, `grep` ...) from GNU.
- **The directory layout** – `/etc`, `/home`, `/usr/bin` and so on.
- **systemd**, which starts the system and manages services, on almost every
  major distribution.

## What's different?

| | Debian family | Arch family | Red Hat family |
|---|---|---|---|
| Package manager | `apt` | `pacman` | `dnf` |
| Package format | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-level tool | `dpkg` | (pacman) | `rpm` |
| Sudo group | `sudo` | `wheel` | `wheel` |
| Releases | Stable versions | Rolling | A new version every 6 months (Fedora) |

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
