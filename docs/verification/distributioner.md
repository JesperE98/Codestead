# distributioner – Distributions and families

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Linuxkärnan, bash, GNU-verktygen (`ls`, `cp`, `grep`) och katalogstrukturen (`/etc`, `/home`, `/usr/bin`) är desamma i alla distributioner | | ogranskad | 2026-10-30 |
| systemd startar systemet och hanterar tjänster i nästan alla stora distributioner | | ogranskad | 2026-10-30 |
| Pakethanterare: Debian-familjen `apt`, Arch-familjen `pacman`, Red Hat-familjen `dnf` | | ogranskad | 2026-10-30 |
| Paketformat: `.deb`, `.pkg.tar.zst`, `.rpm` | | ogranskad | 2026-10-30 |
| Lågnivåverktyg: `dpkg` (Debian), `rpm` (Red Hat); Arch har bara pacman | | ogranskad | 2026-10-30 |
| Sudo-gruppen heter `sudo` i Debian-familjen och `wheel` i Arch- och Red Hat-familjen | | ogranskad | 2026-10-30 |
| Debian släpper en ny version ungefär vartannat år | | ogranskad | 2026-10-30 |
| Ubuntu LTS kommer vartannat år med fem års stöd | | ogranskad | 2026-10-30 |
| Arch är rullande och har inga versioner | | ogranskad | 2026-10-30 |
| Fedora släpper en ny version ungefär var sjätte månad och är en provbänk för RHEL | | ogranskad | 2026-10-30 |
| RHEL har tio års stöd och används av företag | | ogranskad | 2026-10-30 |
| `/etc/os-release` finns i alla moderna distributioner och visar namn och version | | ogranskad | 2026-10-30 |
| `uname -r` visar kärnans version | | ogranskad | 2026-10-30 |
| Kontrollfråga: `echo $SHELL` ger `/bin/bash` i simulatorns alla distributioner | | ogranskad | 2026-10-30 |
| Ett förråd (*repository*) har testade och signerade paket | | ogranskad | 2026-10-30 |
| Pakethanteraren installerar beroenden automatiskt och kan uppdatera allt med ett kommando | | ogranskad | 2026-10-30 |
| Kommandon som ändrar systemet kräver root (`sudo`) | | ogranskad | 2026-10-30 |
| Paketnamn: Vim `vim`/`vim`/`vim-enhanced`, Python 3 `python3`/`python`/`python3`, SSH-klient `openssh-client`/`openssh`/`openssh-clients` (Debian/Ubuntu, Arch, Fedora) | | ogranskad | 2026-10-30 |
| Debian-familjen: förråden anges i `/etc/apt/sources.list.d/` | | ogranskad | 2026-10-30 |
| Arch-familjen: pacman styrs av `/etc/pacman.conf`, spegelservrar i `/etc/pacman.d/mirrorlist` | | ogranskad | 2026-10-30 |
| Red Hat-familjen: dnf:s inställningar i `/etc/dnf/dnf.conf`, förråden i `/etc/yum.repos.d/` | | ogranskad | 2026-10-30 |
| Rocky Linux är en RHEL-klon | | ogranskad | 2026-10-30 |
| Arch har en utmärkt wiki (omdöme) | | ogranskad | 2026-10-30 |
