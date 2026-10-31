# Exam: distributions and packages

Answer the questions below. You need 80 % to pass.

```quiz
Which file tells you the name and version of the distribution on all modern
distributions?
- [ ] `/etc/hostname`
- [x] `/etc/os-release`
- [ ] `/etc/version`
```

```try
uname -r
---
`uname -r` shows the version of the Linux kernel.
```

```quiz
Which package manager and package format belong together?
- [x] `pacman` and `.pkg.tar.zst`
- [ ] `dnf` and `.deb`
- [ ] `apt` and `.rpm`
```

```quiz
Which distribution is a *rolling release* without versions?
- [ ] Ubuntu LTS
- [ ] Debian
- [x] Arch
- [ ] Fedora
```

```quiz
What is the difference between `apt update` and `apt upgrade`?
- [x] `update` downloads the list of available packages, `upgrade` installs new versions
- [ ] `update` installs new versions, `upgrade` downloads the list
- [ ] There is no difference
```

```quiz
Which command installs the package `htop` on Arch?
- [ ] `sudo pacman -R htop`
- [ ] `sudo pacman -Q htop`
- [x] `sudo pacman -S htop`
- [ ] `sudo pacman -Ss htop`
```

```quiz
Why is it a bad idea to run `pacman -Sy` and then `pacman -S package`?
- [ ] It installs the package twice
- [x] It is a partial upgrade that can break the system
- [ ] `-Sy` removes all installed packages
```

```quiz
dnf asks `Is this ok [y/N]` and you just press Enter. What happens?
- [ ] The package is installed
- [x] Nothing is installed – No is the default
```

```quiz
Which of these are true about the AUR?
- [x] It contains build recipes (`PKGBUILD`), not ready-made packages
- [x] Its packages aren't reviewed by Arch
- [ ] `sudo pacman -Syu` updates AUR packages
- [ ] `makepkg` should be run with sudo
```

```quiz
Which command adds a COPR repository on Fedora?
- [ ] `sudo add-apt-repository copr:user/project`
- [x] `sudo dnf copr enable user/project`
- [ ] `git clone` and `makepkg -si`
```

```quiz
How are Snap packages updated?
- [ ] With `flatpak update`
- [x] Automatically in the background
- [ ] By downloading a new file from the developer's website
```

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
A downloaded file is never executable to begin with. Run
`chmod +x ~/{{downloads}}/{{calculator}}` first.
```

```quiz
You want a newer version of a desktop program that is missing from the
distribution's repositories. What does the rule of thumb recommend first?
- [ ] An extra repository from someone you don't know
- [x] A Flatpak
- [ ] Building the program from source code as root
```
