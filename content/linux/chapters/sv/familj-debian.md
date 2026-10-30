# Debian-familjen: apt och PPA

Debian, Ubuntu och distributioner som bygger på dem, till exempel Linux Mint,
utgör **Debian-familjen**. Alla använder pakethanteraren **apt** och paket i
formatet `.deb`. Det här kapitlet körs alltid på en distribution från
Debian-familjen – just nu är det **{{distro}}**. Du kan byta mellan Ubuntu och
Debian i menyn högst upp.

## apt i korthet

| Vad | Kommando |
|---|---|
| Uppdatera paketlistan | `apt update` |
| Uppgradera allt | `apt upgrade` |
| Installera | `apt install X` |
| Ta bort | `apt remove X` |
| Sök | `apt search X` |
| Info om paket | `apt show X` |
| Lista installerade | `apt list --installed` |

Kommandon som ändrar systemet kräver root, så de körs med `sudo`.

```quiz
Vilka av de här kommandona ändrar systemet och behöver därför `sudo`?
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
Att söka och visa information läser bara paketlistorna. Att installera och ta
bort ändrar systemet.
```

## update och upgrade är olika saker

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

```quiz
Vad gör `sudo apt update`?
- [x] Hämtar listan över vilka paket och versioner som finns
- [ ] Installerar nya versioner av paketen du redan har
- [ ] Uppdaterar apt självt till den senaste versionen
---
`apt update` uppdaterar bara listan. Det är `apt upgrade` som installerar de
nya versionerna.
```

## Installera och ta bort

```sh
sudo apt install htop
```

`apt remove` tar bort ett program men låter inställningsfilerna ligga kvar.
`apt purge` tar bort dem också. När apt frågar `Do you want to continue? [Y/n]`
betyder stort `Y` att Enter räcker för att svara ja. Med flaggan `-y` svarar
apt ja automatiskt.

Att söka kräver inte root. Prova:

```try
apt search htop
```

### apt eller apt-get?

`apt` är den moderna, användarvänliga varianten med förloppsindikator och
färger. `apt-get` och `apt-cache` är äldre men har en stabilare utdata, så de
används fortfarande i skript.

### Under huven: dpkg och .deb

Paketen är `.deb`-filer, och det är egentligen programmet `dpkg` som packar
upp dem. apt sköter allt runtomkring: hämtning, beroenden och uppdateringar.

## Extra förråd – bekvämt, men på eget ansvar

Distributionens förråd innehåller tiotusentals paket – men inte allt. Ett
nischat program kanske inte finns där alls, eller så finns bara en gammal
version. Därför finns det **extra förråd** där utvecklare och användare delar
egna paket.

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
(i kapitlet om universella paket) och först därefter i ett extra förråd från
någon du litar på.

## PPA

Ett **PPA** (*Personal Package Archive*) är ett litet förråd på Launchpad,
Canonicals tjänst för Ubuntu. Utvecklaren laddar upp källkoden och Launchpad
bygger `.deb`-paket för olika Ubuntu-versioner. Ett PPA skrivs
`ppa:användare/namn`. PPA:er granskas inte av distributionen.

I resten av kapitlet installerar du ett påhittat program, `moonphase` (det
visar månens fas i terminalen), från ett PPA.

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

```quiz
Du lägger till ett förråd för hand, genom att skapa en fil i
`/etc/apt/sources.list.d/`. Vad måste du göra innan apt kan installera paket
därifrån?
- [ ] Ingenting – apt läser filen av sig själv nästa gång du installerar
- [x] Köra `sudo apt update`
- [ ] Starta om datorn
---
`add-apt-repository` kör `apt update` åt dig. När du skapar filen själv måste
du göra det själv.
```

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

```quiz
Samma paket finns både i distributionens förråd och i ett PPA som du har lagt
till. Vilken version väljer apt?
- [ ] Alltid den från distributionens förråd
- [ ] Den från förrådet som lades till senast
- [x] Den högsta versionen
---
Därför kan ett PPA ersätta ett av distributionens egna paket.
```

### PPA i Debian?

PPA:er byggs för Ubuntu, inte Debian. I Debian kan de fungera, men paketen kan
kräva andra versioner av bibliotek än de Debian har. En blandning av Debian-
och Ubuntu-paket kallas skämtsamt en *FrankenDebian* och är ett vanligt sätt
att göra systemet trasigt. I Debian är det bättre att använda *backports*, en
Flatpak eller utvecklarens eget förråd för Debian.

### Uppdateringar och att ta bort ett PPA

Paket från ett PPA uppdateras tillsammans med allt annat, med
`sudo apt update && sudo apt upgrade`. Så tar du bort PPA:t:

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Programmet blir kvar, men får inga fler uppdateringar. Vill du bli av med det
helt kör du också `sudo apt remove moonphase`.

Varje förråd du lägger till är en ny avsändare du litar på. Håll listan kort
och rensa bort det du inte längre använder.
