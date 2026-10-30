# Pakethantering

På Windows och macOS laddar man ofta ner program från en webbsida. I Linux
installerar man i stället nästan allt med en **pakethanterare**. Det här är
den största skillnaden mellan distributionsfamiljerna – och det här kapitlet
ser olika ut beroende på vilken distribution du har valt. Just nu är det
**{{pm}}** i {{distro}}.

## Paket, förråd och beroenden

- Ett **paket** är ett program (eller bibliotek) packat i en fil, tillsammans
  med information om version och vad det behöver.
- Ett **förråd** (*repository*) är en server där distributionen lägger ut alla
  sina paket. De är testade och signerade, så du vet att de inte har ändrats.
- Ett **beroende** är ett annat paket som behövs. Pakethanteraren installerar
  beroenden automatiskt.

Pakethanteraren håller också reda på vad som är installerat och kan uppdatera
*allt* på datorn med ett enda kommando.

## Samma sak – tre dialekter

| Vad | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Uppdatera paketlistan | `apt update` | `pacman -Sy` | `dnf check-update` |
| Uppgradera allt | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Installera | `apt install X` | `pacman -S X` | `dnf install X` |
| Ta bort | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Sök | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Info om paket | `apt show X` | `pacman -Si X` | `dnf info X` |
| Lista installerade | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Kommandon som ändrar systemet kräver root, så de körs med `sudo`.

:::debian
## apt i {{distro}}

### update och upgrade är olika saker

Det här förvirrar nästan alla i början:

- `apt update` hämtar **listan** över vilka paket och versioner som finns.
  Den installerar ingenting.
- `apt upgrade` **installerar** nya versioner av det du redan har.

Kör därför alltid `update` först. Det vanligaste sättet att uppdatera
systemet är:

```sh
sudo apt update && sudo apt upgrade
```

Innan du kört `apt update` (till exempel på en nyinstallerad server) är
paketlistan tom och apt hittar inga paket alls.

### Installera och ta bort

```sh
sudo apt install htop
```

`apt remove` tar bort ett program men låter inställningsfilerna ligga kvar.
`apt purge` tar bort dem också. När apt frågar `Do you want to continue? [Y/n]`
betyder stort `Y` att Enter räcker för att svara ja. Med flaggan `-y` svarar
apt ja automatiskt.

### apt eller apt-get?

`apt` är den moderna, användarvänliga varianten med förloppsindikator och
färger. `apt-get` och `apt-cache` är äldre men har en stabilare utdata, så de
används fortfarande i skript.

### Under huven: dpkg och .deb

Paketen är `.deb`-filer, och det är egentligen programmet `dpkg` som packar
upp dem. apt sköter allt runtomkring: hämtning, beroenden och uppdateringar.
:::

:::arch
## pacman i {{distro}}

pacman använder korta flaggor där **stor bokstav** är åtgärden och små
bokstäver är tillägg:

| Flagga | Betyder |
|---|---|
| `-S` | Sync – installera från förråden |
| `-R` | Remove – ta bort |
| `-Q` | Query – fråga om installerade paket |
| `y` | Uppdatera paketdatabasen |
| `u` | Uppgradera alla paket |
| `s` | Search (med -S och -Q), eller ta bort beroenden (med -R) |
| `i` | Info |

### Uppdatera systemet

```sh
sudo pacman -Syu
```

`-Syu` betyder: synkronisera (`S`), uppdatera databasen (`y`) och uppgradera
allt (`u`). Arch är en *rolling release*, så det här kör du ofta.

> **Viktigt!** Kör aldrig bara `pacman -Sy` följt av `pacman -S paket`. Då kan
> det nya paketet kräva nyare bibliotek än de du har – en så kallad
> *partial upgrade* som kan göra systemet trasigt. Använd alltid `-Syu`.

### Installera och ta bort

```sh
sudo pacman -S htop
```

`pacman -R paket` tar bort ett paket och `pacman -Rs paket` tar även bort
beroenden som inget annat behöver.

### AUR

Utöver de officiella förråden finns **AUR** (*Arch User Repository*), där
användare delar byggrecept för tusentals program. Man använder ofta en
hjälpare som `yay` eller `paru` för att installera därifrån. Paketen i AUR är
inte granskade av Arch – läs alltid byggreceptet (PKGBUILD) först.
:::

:::redhat
## dnf i {{distro}}

### Automatisk metadata

dnf hämtar själv ny paketinformation när den behövs, så det finns inget
separat steg motsvarande `apt update`. Vill du se vilka uppdateringar som
finns kör du:

```sh
dnf check-update
```

Slutkoden blir `100` om det finns uppdateringar – praktiskt i skript.

### Installera och ta bort

```sh
sudo dnf install htop
```

Lägg märke till frågan `Is this ok [y/N]`. Stort `N` betyder att **Nej** är
standard – trycker du bara Enter avbryts installationen. Skriv `y` och Enter,
eller använd `-y`.

### Uppgradera systemet

```sh
sudo dnf upgrade
```

### Under huven: rpm

Paketen är `.rpm`-filer och lågnivåverktyget heter `rpm`. dnf ersatte det
äldre `yum`, och i Fedora 41 kom den nya versionen **dnf5** som är betydligt
snabbare. I RHEL, Rocky och AlmaLinux heter kommandot också `dnf`.
:::

## Samma program, olika namn

Paket heter oftast likadant överallt – men inte alltid. Några exempel:

| Program | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH-klient | `openssh-client` | `openssh` | `openssh-clients` |

Sök alltid med pakethanteraren om du är osäker på namnet.

## Universella paketformat

Det finns också format som fungerar i alla distributioner: **Flatpak** (vanligt
för skrivbordsprogram, via Flathub), **Snap** (från Canonical, standard i
Ubuntu) och **AppImage** (en enda körbar fil). De har sina egna kommandon och
kompletterar distributionens pakethanterare.
