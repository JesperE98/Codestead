# Distributioner och familjer

Nu kan du grunderna, och de fungerar likadant i alla distributioner. Men vad
är det då som skiljer dem åt? Du kör just nu **{{distro}}** från
**{{family}}**.

Det här kapitlet är en översikt. Prova gärna att byta distribution i menyn
högst upp och gör uppgifterna en gång till – du ser då skillnaderna direkt.
Efter det här kapitlet kommer ett kapitel för varje familj:
**Debian-familjen** (apt), **Arch-familjen** (pacman) och **Red Hat-familjen**
(dnf). Vart och ett körs alltid på en distribution från den familjen, så du
kan göra alla tre.

## Vad är samma överallt?

- **Linuxkärnan** – men i olika versioner.
- **Skalet bash** och grundverktygen (`ls`, `cp`, `grep` ...) från GNU.
- **Katalogstrukturen** – `/etc`, `/home`, `/usr/bin` och så vidare.
- **systemd**, som startar systemet och hanterar tjänster, i nästan alla stora
  distributioner.

```predict
$ echo $SHELL
/bin/bash
---
Skalet är bash i alla distributioner i simulatorn – vilken du än har valt.
```

## Vad skiljer?

| | Debian-familjen | Arch-familjen | Red Hat-familjen |
|---|---|---|---|
| Pakethanterare | `apt` | `pacman` | `dnf` |
| Paketformat | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Lågnivåverktyg | `dpkg` | (pacman) | `rpm` |
| Sudo-grupp | `sudo` | `wheel` | `wheel` |
| Utgivning | Stabila versioner | Rullande (*rolling*) | Ny version var 6:e månad (Fedora) |

```quiz
I vilka familjer heter gruppen som får använda sudo `wheel`?
- [ ] Debian-familjen
- [x] Arch-familjen
- [x] Red Hat-familjen
---
Debian-familjen kallar gruppen `sudo`; Arch och Red Hat kallar den `wheel`.
```

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

```quiz
Vilken distribution har inga versioner alls, utan uppdateras hela tiden
(*rolling*)?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

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

```try
cat /etc/os-release
---
Raderna `NAME` och `PRETTY_NAME` berättar vilken distribution det är.
```

## Paket, förråd och beroenden

På Windows och macOS laddar man ofta ner program från en webbsida. I Linux
installerar man i stället nästan allt med en **pakethanterare**. Det här är
den största skillnaden mellan distributionsfamiljerna.

- Ett **paket** är ett program (eller bibliotek) packat i en fil, tillsammans
  med information om version och vad det behöver.
- Ett **förråd** (*repository*) är en server där distributionen lägger ut alla
  sina paket. De är testade och signerade, så du vet att de inte har ändrats.
- Ett **beroende** är ett annat paket som behövs. Pakethanteraren installerar
  beroenden automatiskt.

Pakethanteraren håller också reda på vad som är installerat och kan uppdatera
*allt* på datorn med ett enda kommando. Kommandon som ändrar systemet kräver
root, så de körs med `sudo`.

```quiz
Ett paket behöver ett annat paket som du inte har. Vad händer när du
installerar det med pakethanteraren?
- [ ] Installationen avbryts, och du får leta upp det andra paketet själv
- [x] Pakethanteraren installerar beroendet automatiskt
- [ ] Paketet installeras, men fungerar inte förrän du laddat ner det andra
```

### Samma program, olika namn

Paket heter oftast likadant överallt – men inte alltid. Några exempel:

| Program | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH-klient | `openssh-client` | `openssh` | `openssh-clients` |

Sök alltid med pakethanteraren om du är osäker på namnet.

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
