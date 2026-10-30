# Arch-familjen: pacman och AUR

Arch Linux och distributioner som bygger på den, till exempel Manjaro och
EndeavourOS, utgör **Arch-familjen**. De använder pakethanteraren **pacman**
och paket i formatet `.pkg.tar.zst`. Det här kapitlet körs alltid på en
distribution från Arch-familjen – just nu är det **{{distro}}**.

## pacman i korthet

| Vad | Kommando |
|---|---|
| Uppdatera paketlistan | `pacman -Sy` |
| Uppgradera allt | `pacman -Syu` |
| Installera | `pacman -S X` |
| Ta bort | `pacman -R X` |
| Sök | `pacman -Ss X` |
| Info om paket | `pacman -Si X` |
| Lista installerade | `pacman -Q` |

Kommandon som ändrar systemet kräver root, så de körs med `sudo`.

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

```quiz
Vad betyder det stora `Q` i `pacman -Q`?
- [ ] Quit – avsluta pacman
- [x] Query – fråga om installerade paket
- [ ] Quick – installera utan att fråga
---
`-Q` frågar om det som är installerat, `-S` installerar från förråden och
`-R` tar bort.
```

Att söka kräver inte root. Prova:

```try
pacman -Ss htop
```

## Uppdatera systemet

```sh
sudo pacman -Syu
```

`-Syu` betyder: synkronisera (`S`), uppdatera databasen (`y`) och uppgradera
allt (`u`). Arch är en *rolling release*, så det här kör du ofta.

> **Viktigt!** Kör aldrig bara `pacman -Sy` följt av `pacman -S paket`. Då kan
> det nya paketet kräva nyare bibliotek än de du har – en så kallad
> *partial upgrade* som kan göra systemet trasigt. Använd alltid `-Syu`.

```quiz
Varför ska du inte köra `pacman -Sy` och sedan `pacman -S paket`?
- [ ] För att `-Sy` raderar paketdatabasen
- [x] Det nya paketet kan kräva nyare bibliotek än du har, vilket kan göra systemet trasigt
- [ ] För att pacman bara kan installera ett paket per dag
---
Uppgradera alltid allt på en gång med `-Syu`.
```

## Installera och ta bort

```sh
sudo pacman -S htop
```

`pacman -R paket` tar bort ett paket och `pacman -Rs paket` tar även bort
beroenden som inget annat behöver.

## AUR

Distributionens förråd innehåller tiotusentals paket – men inte allt. Ett
nischat program kanske inte finns där alls, eller så finns bara en gammal
version. I Arch-familjen är svaret **AUR** (*Arch User Repository*).

AUR är annorlunda än vanliga förråd: där finns inga färdiga paket, bara
**byggrecept**. Ett recept heter `PKGBUILD` och är ett litet bash-skript som
talar om var källkoden finns och hur programmet byggs. Du hämtar receptet,
bygger paketet själv och installerar det med pacman. AUR är enormt – nästan
allt som finns för Linux finns där – men vem som helst kan ladda upp ett
recept.

```quiz
Vad hämtar du från AUR?
- [ ] Ett färdigt `.pkg.tar.zst`-paket, granskat av Arch
- [x] Ett byggrecept (`PKGBUILD`) som du själv bygger paketet från
- [ ] En Flatpak
```

### På eget ansvar

Paketen i distributionens egna förråd är testade tillsammans, signerade och
granskade av distributionens utvecklare. Paketen i AUR granskas inte av Arch.
Tänk på det här:

- **Paket installeras som root.** Ett paket kan alltså göra vad som helst med
  datorn. Du litar på den som skrivit receptet lika mycket som på
  distributionen.
- **Det kan krocka.** Ett paket kan ersätta systemets egna bibliotek eller
  kräva andra versioner än de som finns.
- **Det kan sluta uppdateras.** Om den som sköter receptet tröttnar får du
  inga fler säkerhetsuppdateringar för programmet.

En bra tumregel: leta först i distributionens förråd, sedan efter en Flatpak
(i kapitlet om universella paket) och först därefter i AUR.

I resten av kapitlet installerar du ett påhittat program, `moonphase` (det
visar månens fas i terminalen), från AUR.

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

```quiz
Du har installerat `moonphase` från AUR och kör `sudo pacman -Syu`.
Uppdateras `moonphase`?
- [ ] Ja – pacman uppdaterar alla installerade paket
- [x] Nej – pacman känner inte till AUR
---
Hämta det nya receptet med `git pull` och bygg om, eller använd en
AUR-hjälpare.
```

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

Det finns inget förråd att ta bort för AUR – varje paket är sitt eget recept.
Rensa bort det du inte längre använder.
