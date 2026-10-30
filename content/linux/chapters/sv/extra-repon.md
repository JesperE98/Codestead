# AUR, PPA och COPR

Distributionens förråd innehåller tiotusentals paket – men inte allt. Ett
nischat program kanske inte finns där alls, eller så finns bara en gammal
version. Därför finns det **extra förråd** där utvecklare och användare delar
egna paket. Varje familj har sitt eget: **PPA** i Ubuntu, **AUR** i Arch och
**COPR** i Fedora.

I det här kapitlet installerar du samma påhittade program, `moonphase` (det
visar månens fas i terminalen), från det extra förrådet i {{distro}}. Byt
distribution i menyn om du vill jämföra hur det går till i de andra
familjerna.

## Bekvämt – men på eget ansvar

Paketen i distributionens egna förråd är testade tillsammans, signerade och
granskade av distributionens utvecklare. Ett extra förråd kan däremot vem som
helst skapa. Tänk på det här innan du lägger till ett:

- **Paket installeras som root.** Ett paket kan alltså göra vad som helst med
  datorn. Du litar på den som byggt det lika mycket som på distributionen.
- **Det kan krocka.** Ett paket från ett extra förråd kan ersätta systemets
  egna bibliotek eller kräva andra versioner än de som finns.
- **Det kan sluta uppdateras.** Om den som sköter förrådet tröttnar får du
  inga fler säkerhetsuppdateringar för programmet.

En bra tumregel: leta först i distributionens förråd, sedan efter en Flatpak
(nästa kapitel) och först därefter i ett extra förråd från någon du litar på.

## Tre familjer, tre lösningar

| | PPA | AUR | COPR |
|---|---|---|---|
| Familj | Ubuntu (och t.ex. Linux Mint) | Arch (och t.ex. Manjaro, EndeavourOS) | Fedora (och RHEL-familjen) |
| Webbplats | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| Vad du hämtar | Färdiga `.deb`-paket | Ett byggrecept (`PKGBUILD`) – du bygger själv | Färdiga `.rpm`-paket |
| Lägga till | `add-apt-repository ppa:…` | `git clone …` och `makepkg -si` | `dnf copr enable …` |
| Granskas av distributionen | Nej | Nej | Nej |

:::debian
## PPA i {{distro}}

Ett **PPA** (*Personal Package Archive*) är ett litet förråd på Launchpad,
Canonicals tjänst för Ubuntu. Utvecklaren laddar upp källkoden och Launchpad
bygger `.deb`-paket för olika Ubuntu-versioner. Ett PPA skrivs
`ppa:användare/namn`.

### Verktyget add-apt-repository

PPA:er läggs till med `add-apt-repository`, som finns i paketet
`software-properties-common`. I Ubuntu är det förinstallerat, men inte i
Debian:

```sh
sudo apt update
sudo apt install software-properties-common
```

### Lägg till PPA:t

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

Du får se vad som läggs till och en beskrivning av PPA:t. Tryck Enter för att
fortsätta (med `-y` slipper du frågan). Två saker händer:

1. En fil skapas i `/etc/apt/sources.list.d/`. Den talar om var förrådet finns
   och innehåller nyckeln som paketen är signerade med.
2. `add-apt-repository` kör `apt update` åt dig – annars skulle apt inte känna
   till de nya paketen. Lägger du till en källa för hand (genom att skapa en
   fil) måste du själv köra `sudo apt update` efteråt.

Titta på filen:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Lägg märke till `Suites: noble` – paketen är byggda för Ubuntu 24.04.

### Installera och kör

Nu installeras paketet precis som vilket annat paket som helst:

```sh
sudo apt install moonphase
moonphase
```

### Varifrån kommer paketet?

`apt policy` visar vilka förråd ett paket finns i och vilket som vinner:

```sh
apt policy moonphase
```

`***` markerar den installerade versionen. Talet `500` är förrådets
prioritet och `100` betyder "det som redan är installerat". Finns samma paket
i flera förråd tar apt den högsta versionen – så ett PPA kan alltså ersätta
ett av distributionens egna paket med sin egen version.

### PPA i Debian?

PPA:er byggs för Ubuntu, inte Debian. I Debian kan de fungera, men paketen kan
kräva andra versioner av bibliotek än de Debian har. En blandning av Debian-
och Ubuntu-paket kallas skämtsamt en *FrankenDebian* och är ett vanligt sätt
att göra systemet trasigt. I Debian är det bättre att använda *backports*, en
Flatpak eller utvecklarens eget förråd för Debian.

### Ta bort ett PPA

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Programmet blir kvar, men får inga fler uppdateringar. Vill du bli av med det
helt kör du också `sudo apt remove moonphase`.
:::

:::arch
## AUR i {{distro}}

**AUR** (*Arch User Repository*) är annorlunda än de andra: där finns inga
färdiga paket, bara **byggrecept**. Ett recept heter `PKGBUILD` och är ett
litet bash-skript som talar om var källkoden finns och hur programmet byggs.
Du hämtar receptet, bygger paketet själv och installerar det med pacman.
AUR är enormt – nästan allt som finns för Linux finns där – men vem som helst
kan ladda upp ett recept.

### Förberedelser

För att hämta recept och bygga paket behövs `git` och `base-devel` (kompilator,
`make`, `fakeroot` och annat):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` hoppar över det som redan är installerat.

### Hämta receptet

Varje AUR-paket är ett eget git-förråd:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Stavar du fel på paketnamnet säger git *"You appear to have cloned an empty
> repository"* och katalogen blir tom. AUR låter dig klona vad som helst!

### Läs PKGBUILD – varje gång

```sh
less PKGBUILD
```

`PKGBUILD` är ett skript som körs på din dator. Kontrollera åtminstone:

- att `source=` hämtar från programmets riktiga webbplats,
- att `build()` och `package()` bara bygger och kopierar filer – inte till
  exempel laddar ner och kör något annat (`curl … | sh`),
- att paketet ser underhållet ut (datum, kommentarer på aur.archlinux.org).

### Bygg och installera

```sh
makepkg -si
```

`makepkg` läser `PKGBUILD`, hämtar källkoden, bygger och packar ihop en
`.pkg.tar.zst`-fil. `-s` installerar beroenden som saknas och `-i`
installerar paketet med pacman när det är klart. Kör **inte** makepkg med
sudo – det vägrar köras som root, och använder själv sudo när det behövs.

```sh
ls
moonphase
```

### "Främmande" paket

pacman känner inte till AUR. Paket som inte kommer från förråden kallas
*foreign* och listas med:

```sh
pacman -Qm
```

Det betyder också att `sudo pacman -Syu` **inte** uppdaterar AUR-paket. Du
måste själv hämta det nya receptet (`git pull`) och bygga om – eller låta en
AUR-hjälpare göra det.

### AUR-hjälparen yay

En AUR-hjälpare gör allt det här åt dig: söker, hämtar, visar `PKGBUILD`,
bygger och installerar. Den vanligaste är **yay** (en annan är *paru*). yay
finns själv bara i AUR, så den installeras för hand en gång. Paketet
`yay-bin` är färdigkompilerat och går snabbast:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Sedan används yay ungefär som pacman – men utan sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (eller bara `yay`) uppgraderar både paketen från förråden och dina
AUR-paket. Att det är bekvämt betyder inte att du kan sluta läsa recepten!
:::

:::redhat
## COPR i {{distro}}

**COPR** (*Cool Other Package Repo*) är Fedoras byggtjänst. Vem som helst med
ett Fedora-konto kan bygga `.rpm`-paket där, och varje projekt blir ett eget
förråd som heter `användare/projekt`.

### Förråden du har nu

```sh
dnf repolist
```

### Aktivera ett COPR-förråd

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf påminner dig om att förrådet inte är en del av Fedora och att kvaliteten
kan variera. Frågan har **Nej** som standard, så svara `y`. En ny fil skapas i
`/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Installera och kör

dnf hämtar själv den nya förrådsinformationen, så paketet kan installeras
direkt:

```sh
sudo dnf install moonphase
moonphase
```

### Varifrån kommer paketet?

```sh
dnf info moonphase
```

Raden `From repository` visar att paketet kom från COPR. Paket från COPR
uppdateras som vanligt med `sudo dnf upgrade`.

### Stänga av eller ta bort

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` låter filen ligga kvar men stänger av förrådet, `remove` tar bort den
helt. Programmet blir kvar, men får inga fler uppdateringar.

### RPM Fusion

Ett annat vanligt extra förråd för Fedora är **RPM Fusion**. Där finns sådant
Fedora inte får eller vill ha med, till exempel vissa mediecodecs och
drivrutiner. Det är ett stort, gemensamt projekt – inte ett enskilt
användarförråd som i COPR.
:::

## Uppdateringar och underhåll

| | Uppdateras med | Ta bort förrådet |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu` – eller bygg om själv | – (det finns inget förråd att ta bort) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Extra förråd är ett kraftfullt verktyg, men varje förråd du lägger till är en
ny avsändare du litar på. Håll listan kort och rensa bort det du inte längre
använder.
