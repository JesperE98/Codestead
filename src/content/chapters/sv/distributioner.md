# Distributioner och familjer

Nu kan du grunderna, och de fungerar likadant i alla distributioner. Men vad
är det då som skiljer dem åt? Du kör just nu **{{distro}}** från
**{{family}}**. Prova gärna att byta distribution i menyn högst upp och gör
uppgifterna en gång till – du ser då skillnaderna direkt.

## Vad är samma överallt?

- **Linuxkärnan** – men i olika versioner.
- **Skalet bash** och grundverktygen (`ls`, `cp`, `grep` ...) från GNU.
- **Katalogstrukturen** – `/etc`, `/home`, `/usr/bin` och så vidare.
- **systemd**, som startar systemet och hanterar tjänster, i nästan alla stora
  distributioner.

## Vad skiljer?

| | Debian-familjen | Arch-familjen | Red Hat-familjen |
|---|---|---|---|
| Pakethanterare | `apt` | `pacman` | `dnf` |
| Paketformat | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Lågnivåverktyg | `dpkg` | (pacman) | `rpm` |
| Sudo-grupp | `sudo` | `wheel` | `wheel` |
| Utgivning | Stabila versioner | Rullande (*rolling*) | Ny version var 6:e månad (Fedora) |

### Utgivningsmodeller

- **Stabil med fasta versioner** – Debian släpper en ny version ungefär vartannat
  år och Ubuntu LTS (*Long Term Support*) vartannat år med fem års stöd.
  Programmen uppdateras med säkerhetsfixar men byts sällan ut mot nya versioner.
  Bra för servrar.
- **Rullande** – Arch har inga versioner alls. Du uppdaterar hela tiden och får
  alltid det senaste. Kräver lite mer av dig som användare.
- **Snabbrörlig** – Fedora kommer i en ny version ungefär var sjätte månad och
  är ett slags provbänk för Red Hat Enterprise Linux (RHEL), som i sin tur har
  tio års stöd och används i företag.

## Vilken distribution kör jag?

Filen `/etc/os-release` finns i alla moderna distributioner och berättar namn
och version:

```sh
cat /etc/os-release
```

Kärnans version visas med `uname -r`:

```sh
uname -r
```

## Konfigurationen för pakethanteraren

:::debian
I Debian-familjen anger filer i `/etc/apt/sources.list.d/` vilka förråd
(*repositories*) som apt hämtar paket från:

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
I Arch-familjen styrs pacman av `/etc/pacman.conf`, och listan över
spegelservrar finns i `/etc/pacman.d/mirrorlist`:

```sh
cat /etc/pacman.conf
```
:::

:::redhat
I Red Hat-familjen finns dnf:s inställningar i `/etc/dnf/dnf.conf` och
förråden (*repositories*) beskrivs av filer i `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
```
:::

## Vilken ska jag välja?

Det finns inget rätt svar, men en tumregel:

- **Ny på Linux?** Ubuntu, Linux Mint eller Fedora.
- **Server?** Debian, Ubuntu LTS eller en RHEL-klon som Rocky Linux.
- **Vill lära dig hur allt hänger ihop?** Arch – och dess utmärkta wiki.
