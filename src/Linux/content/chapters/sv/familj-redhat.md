# Red Hat-familjen: dnf och COPR

Fedora, Red Hat Enterprise Linux (RHEL) och RHEL-kloner som Rocky Linux
utgör **Red Hat-familjen**. De använder pakethanteraren **dnf** och paket i
formatet `.rpm`. Det här kapitlet körs alltid på en distribution från
Red Hat-familjen – just nu är det **{{distro}}**.

## dnf i korthet

| Vad | Kommando |
|---|---|
| Uppdatera paketlistan | `dnf check-update` |
| Uppgradera allt | `dnf upgrade` |
| Installera | `dnf install X` |
| Ta bort | `dnf remove X` |
| Sök | `dnf search X` |
| Info om paket | `dnf info X` |
| Lista installerade | `dnf list --installed` |

Kommandon som ändrar systemet kräver root, så de körs med `sudo`.

## Automatisk metadata

dnf hämtar själv ny paketinformation när den behövs, så det finns inget
separat steg motsvarande `apt update` i Debian-familjen. Vill du se vilka
uppdateringar som finns kör du:

```sh
dnf check-update
```

`dnf check-update` kräver inte root. Slutkoden blir `100` om det finns
uppdateringar – praktiskt i skript. I simulatorn väntar det uppdateringar. Vad
skriver det här ut?

```predict
$ dnf check-update > /dev/null; echo $?
100
---
`> /dev/null` döljer listan, och `$?` är slutkoden från det senaste
kommandot: `100` betyder att det finns uppdateringar.
```

## Installera och ta bort

```sh
sudo dnf install htop
```

Lägg märke till frågan `Is this ok [y/N]`. Stort `N` betyder att **Nej** är
standard – trycker du bara Enter avbryts installationen. Skriv `y` och Enter,
eller använd `-y`.

```quiz
dnf frågar `Is this ok [y/N]` och du trycker bara Enter. Vad händer?
- [ ] Paketet installeras
- [x] Installationen avbryts
- [ ] dnf frågar igen
---
Den stora bokstaven är standardvalet. I Debian-familjen frågar apt `[Y/n]`, så
där betyder Enter ja.
```

`dnf remove paket` tar bort ett paket igen.

## Uppgradera systemet

```sh
sudo dnf upgrade
```

## Under huven: rpm

Paketen är `.rpm`-filer och lågnivåverktyget heter `rpm`. dnf ersatte det
äldre `yum`, och i Fedora 41 kom den nya versionen **dnf5** som är betydligt
snabbare. I RHEL, Rocky och AlmaLinux heter kommandot också `dnf`.

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

## COPR

**COPR** (*Cool Other Package Repo*) är Fedoras byggtjänst. Vem som helst med
ett Fedora-konto kan bygga `.rpm`-paket där, och varje projekt blir ett eget
förråd som heter `användare/projekt`. COPR-förråd granskas inte av
distributionen.

I resten av kapitlet installerar du ett påhittat program, `moonphase` (det
visar månens fas i terminalen), från COPR.

### Förråden du har nu

```sh
dnf repolist
```

```try
dnf repolist
---
Det här är Fedoras egna förråd.
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

```quiz
Vem som helst med ett Fedora-konto kan bygga paket i COPR. Vem granskar dem?
- [ ] Fedoras utvecklare, innan de publiceras
- [ ] Red Hat
- [x] Ingen – du får lita på den som sköter förrådet
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

```quiz
Vad är skillnaden mellan `dnf copr disable` och `dnf copr remove`?
- [x] `disable` stänger av förrådet men låter filen ligga kvar, `remove` tar bort den
- [ ] `disable` avinstallerar också paketen, det gör inte `remove`
- [ ] Det är ingen skillnad
```

### RPM Fusion

Ett annat vanligt extra förråd för Fedora är **RPM Fusion**. Där finns sådant
Fedora inte får eller vill ha med, till exempel vissa mediecodecs och
drivrutiner. Det är ett stort, gemensamt projekt – inte ett enskilt
användarförråd som i COPR.

Varje förråd du lägger till är en ny avsändare du litar på. Håll listan kort
och rensa bort det du inte längre använder.
