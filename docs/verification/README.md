# Faktagranskning

Allt innehåll i Codestead Linux granskas mot officiella källor. Varje sub-kapitel får en logg här,
`docs/verification/<kapitel-id>.md`, med en rad per sakpåstående:

| Påstående | Källa (URL + avsnitt) | Status | Datum |
|---|---|---|---|
| *(exempel)* `ls -a` visar även dolda filer | https://man7.org/linux/man-pages/man1/ls.1.html – `-a, --all` | bekräftat | ÅÅÅÅ-MM-DD |

Status är **bekräftat**, **rättat** (texten eller simulatorn är ändrad) eller **borttaget** (ingen
officiell källa hittades).

## Officiella webbplatser

Bara dessa får användas som källor, både i loggarna och i kapitlens källistor
(`src/Linux/content/references/*.json`). Listan kontrolleras av testet
`LearningContentTests.OfficialDomains`; ändra båda ställena samtidigt.

| Område | Webbplatser |
|---|---|
| Manualsidor och kärnan | man7.org, www.kernel.org, docs.kernel.org |
| GNU (bash, coreutils, grep, sed, tar …) | www.gnu.org |
| Program | git-scm.com, curl.se, www.openssh.com, man.openbsd.org |
| Arch Linux | wiki.archlinux.org, man.archlinux.org, archlinux.org, aur.archlinux.org |
| Fedora / Red Hat | docs.fedoraproject.org, fedoraproject.org, docs.pagure.org |
| Ubuntu | help.ubuntu.com, documentation.ubuntu.com, ubuntu.com, help.launchpad.net |
| Debian | www.debian.org, wiki.debian.org, manpages.debian.org |
| systemd och freedesktop | systemd.io, www.freedesktop.org |
| Skal | fishshell.com, zsh.sourceforge.io |
| Universella paket | docs.flatpak.org, flatpak.org, snapcraft.io, docs.appimage.org |
