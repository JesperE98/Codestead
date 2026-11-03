# The Red Hat family: dnf and COPR

Fedora, Red Hat Enterprise Linux (RHEL) and RHEL clones such as Rocky Linux
make up the **Red Hat family**. They use the package manager
**dnf** and packages in the `.rpm` format. This chapter always runs on a
distribution from the Red Hat family – right now it's **{{distro}}**.

## dnf in short

| What | Command |
|---|---|
| Refresh the package list | `dnf check-update` |
| Upgrade everything | `dnf upgrade` |
| Install | `dnf install X` |
| Remove | `dnf remove X` |
| Search | `dnf search X` |
| Package info | `dnf info X` |
| List installed | `dnf list --installed` |

Commands that change the system require root, so they're run with `sudo`.

## Automatic metadata

dnf fetches new package information by itself when it needs to, so there's no
separate step like `apt update` in the Debian family. If you want to see which
updates are available, run:

```sh
dnf check-update
```

`dnf check-update` doesn't need root. The exit code is `100` if there are
updates – handy in scripts. There are updates waiting in the simulator. What
does this print?

```predict
$ dnf check-update > /dev/null; echo $?
100
---
`> /dev/null` hides the list, and `$?` is the exit code of the last command:
`100` means that there are updates.
```

## Installing and removing

```sh
sudo dnf install htop
```

Note the question `Is this ok [y/N]`. The capital `N` means that **No** is
the default – if you just press Enter, the installation is cancelled. Type
`y` and Enter, or use `-y`.

```quiz
dnf asks `Is this ok [y/N]` and you just press Enter. What happens?
- [ ] The package is installed
- [x] The installation is cancelled
- [ ] dnf asks again
---
The capital letter is the default. In the Debian family apt asks `[Y/n]`, so
there Enter means yes.
```

`dnf remove package` removes a package again.

## Upgrading the system

```sh
sudo dnf upgrade
```

## Under the hood: rpm

The packages are `.rpm` files and the low-level tool is called `rpm`. dnf
replaced the older `yum`, and Fedora 41 brought the new version **dnf5**,
which is considerably faster. On RHEL, Rocky and AlmaLinux the command is
also called `dnf`.

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

## COPR

**COPR** (*Cool Other Package Repo*) is Fedora's build service. Anyone with a
Fedora account can build `.rpm` packages there, and every project becomes a
repository of its own called `user/project`. COPR repositories are not
reviewed by the distribution.

In the rest of this chapter you install a made-up program, `moonphase` (it
shows the phase of the moon in the terminal), from COPR.

### The repositories you have now

```sh
dnf repolist
```

```try
dnf repolist
---
These are Fedora's own repositories.
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

```quiz
Anyone with a Fedora account can build packages in COPR. Who reviews them?
- [ ] Fedora's developers, before they are published
- [ ] Red Hat
- [x] No one – you have to trust whoever runs the repository
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

```quiz
What is the difference between `dnf copr disable` and `dnf copr remove`?
- [x] `disable` turns the repository off but leaves the file, `remove` deletes it
- [ ] `disable` also uninstalls the packages, `remove` doesn't
- [ ] There is no difference
```

### RPM Fusion

Another common extra repository for Fedora is **RPM Fusion**. It has things
Fedora can't or won't include, such as certain media codecs and drivers. It
is a large, shared project – not a single user's repository as in COPR.

Every repository you add is one more sender you trust. Keep the list short and
clean out what you no longer use.
