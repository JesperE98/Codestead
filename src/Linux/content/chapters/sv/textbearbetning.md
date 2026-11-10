# Textbearbetning med sed och awk

Du känner redan till några verktyg för text: `grep` hittar rader, `cut`
plockar ut ett fält och `tr` byter enskilda tecken. Det här kapitlet handlar
om två kraftfullare verktyg, för när du vill byta ut ord, ta bort rader eller
räkna ihop siffror:

| Verktyg | Arbetar med | Typiskt jobb |
|---|---|---|
| `sed` | **rader** | byt ut ett ord, ta bort rader |
| `awk` | **kolumner** (fält) | plocka ut kolumner, summera, räkna |

Båda är *filter*: de läser text, gör något med den och skriver resultatet
till stdout. Därför passar de perfekt i pipes. Och originalfilen ändras **inte**
(med ett undantag, `sed -i`, som vi kommer till).

## Strömeditorn – `sed`

`sed` (*stream editor*) läser text rad för rad och kör ett litet *skript* på
varje rad. Det vanligaste kommandot är `s` – *substitute*, byt ut.

### Byta ut text – `s`

```sh
sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

Skriptet `s/ERROR/{{errorWord}}/` betyder: byt `ERROR` mot `{{errorWord}}`. Det har formen

```text
s/MÖNSTER/ERSÄTTNING/FLAGGOR
```

Utan flaggor byts bara den **första** träffen på varje rad. Med `g` (*global*)
byts alla:

```sh
echo "katt katt katt" | sed 's/katt/hund/'
echo "katt katt katt" | sed 's/katt/hund/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
Utan `g` byts bara det första `a`:et på raden.
```

Flaggan `i` gör sökningen skiftlägesokänslig, precis som `grep -i`:

```sh
sed 's/warn/VARNING/i' ~/{{documents}}/server.log
```

Mönstret är ett *reguljärt uttryck*, precis som i `grep`. Här tar vi bort
datumet i början av varje rad (`^` = radens början, `[0-9-]*` = siffror och
bindestreck):

```sh
sed 's/^[0-9-]* //' ~/{{documents}}/server.log
```

I ersättningen betyder `&` "det som matchade":

```sh
echo "Linux är kul" | sed 's/Linux/**&**/'
```

**Annan avgränsare.** Innehåller texten själv snedstreck blir det rörigt:
`s/\/usr\/local/\/opt/`. Men tecknet direkt efter `s` bestämmer avgränsaren,
så du kan lika gärna använda `|` eller `#`:

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Grupper.** Med `-E` (utökade reguljära uttryck) kan du fånga delar av
träffen med parenteser och använda dem i ersättningen som `\1`, `\2` …
Här vänder vi på datumet:

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/{{documents}}/server.log
```

### Välja rader – adresser

Framför ett kommando kan du skriva en *adress* som väljer vilka rader det
gäller. Kommandot `d` (*delete*) tar bort rader och `p` (*print*) skriver ut
dem:

```sh
sed '/INFO/d' ~/{{documents}}/server.log
sed '1d' ~/{{documents}}/{{grades}}
```

Det första tar bort alla rader som innehåller `INFO`, det andra tar bort rad 1
– rubrikraden.

`sed` skriver normalt ut *varje* rad. Med `-n` slutar den med det, och då
skrivs bara det ut som `p` ber om. Så här visar du rad 5 till 8:

```sh
sed -n '5,8p' ~/{{documents}}/server.log
```

| Adress | Betyder |
|---|---|
| `5` | rad 5 |
| `$` | sista raden |
| `/ERROR/` | rader som matchar mönstret |
| `2,4` | rad 2 till 4 |
| `/WARN/,/ERROR/` | från en rad med WARN till nästa rad med ERROR |
| `/INFO/!` | alla rader **utom** de som matchar |

Adresser fungerar med alla kommandon, även `s`. Här markeras bara felraderna:

```sh
sed '/ERROR/s/^/>>> /' ~/{{documents}}/server.log
```

Kommandot `q` (*quit*) avslutar efter en viss rad – `sed 3q` gör alltså samma
sak som `head -n 3`. Flera kommandon skiljer du åt med `;` eller med flera
`-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

### Ändra filen på plats – `sed -i`

Allt hittills har bara *skrivits ut*. Filen är oförändrad – kontrollera gärna
med `cat`. Med `-i` (*in-place*) skriver `sed` i stället tillbaka resultatet
till filen. Prova på en kopia:

```sh
cp ~/{{documents}}/{{fruits}} ~/frukter-kopia.txt
sed -i 's/kiwi/kiwifrukt/' ~/frukter-kopia.txt
cat ~/frukter-kopia.txt
```

`sed -i` ångrar man inte. Ett bra arbetssätt är att först köra kommandot
**utan** `-i` och titta på resultatet, och lägga till `-i` när det ser rätt
ut. Skriver du `-i.bak` sparas dessutom originalet som `fil.bak`.

```quiz
Du kör `sed 's/kiwi/KIWI/' ~/{{documents}}/{{fruits}}`. Vad händer med filen?
- [ ] Varje `kiwi` i filen blir `KIWI`
- [ ] Bara det första `kiwi` i filen blir `KIWI`
- [x] Ingenting – resultatet skrivs bara ut, filen är oförändrad
---
Utan `-i` skriver `sed` bara till stdout. Filen är som den var.
```

Konfigurationsfiler i `/etc` ägs av root, så där behövs `sudo sed -i ...`.
Det är ett vanligt sätt att ändra en inställning i ett skript, utan att öppna
en texteditor.

## Kolumner – `awk`

`awk` är egentligen ett helt litet programspråk, men för det mesta används det
till en sak: att jobba med **kolumner**. awk delar upp varje rad i *fält*:

| Fält | Betyder |
|---|---|
| `$1`, `$2` … | första, andra … fältet |
| `$0` | hela raden |
| `NF` | antal fält på raden (*number of fields*) |
| `$NF` | sista fältet |
| `NR` | radnumret (*number of record*) |

Som standard skiljs fälten åt av mellanslag (hur många som helst). I
`server.log` är fält 3 loggnivån:

```sh
awk '{print $3}' ~/{{documents}}/server.log
```

Programmet står inom `{ }` och körs för varje rad. Skriv alltid
awk-programmet inom **enkla** citattecken – annars tror skalet att `$3` är en
skalvariabel och byter ut den innan awk ens startar.

awk passar perfekt i en pipe. Hur många rader finns det av varje nivå?

```sh
awk '{print $3}' ~/{{documents}}/server.log | sort | uniq -c
```

### Andra avgränsare – `-F`

Med `-F` väljer du fältavgränsare. I `/etc/passwd` är det kolon, och fält 1 är
användarnamnet och fält 7 skalet:

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

Kommatecknet i `print` blir ett mellanslag i utskriften. Utan komma klistras
fälten ihop, och då kan du blanda in egen text:

```sh
awk -F: '{print $1 " använder " $7}' /etc/passwd
```

Jämför med `cut -d: -f1` från kapitlet om att läsa och söka i text. Skillnaden är att awk kan byta
ordning på fälten, blanda in text och klarar flera mellanslag i rad.

```predict
$ echo "Alva,matte,87" | awk -F, '{print $3, $1}'
87 Alva
---
`-F,` delar raden vid kommatecknen. awk skriver ut fält 3 först och sedan
fält 1, med ett mellanslag emellan på grund av kommatecknet i `print`.
```

### Mönster – välj rader

Före `{ }` kan du skriva ett *mönster*. Då körs programmet bara för de rader
som matchar. Mönstret kan vara ett reguljärt uttryck, som i `grep`:

```sh
awk '/ERROR/ {print $2}' ~/{{documents}}/server.log
```

… eller ett villkor. Text står inom dubbla citattecken:

```sh
awk -F, '$2 == "matte" {print $1, $3}' ~/{{documents}}/{{grades}}
```

Jämförelser skrivs `==`, `!=`, `<`, `<=`, `>` och `>=`, och villkor kombineras
med `&&` (och), `||` (eller) och `!` (inte). Här är alla elever med minst 90
poäng (utan `{ }` skrivs hela raden ut):

```sh
awk -F, '$3 >= 90' ~/{{documents}}/{{grades}}
```

Fick du med rubrikraden också? I den är fält 3 ordet `poäng`, och när ett
värde inte är ett tal jämför awk som *text* – och `"poäng"` kommer efter
`"90"` i bokstavsordning. Rubrikraden hoppar du över med `NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/{{documents}}/{{grades}}
```

Prova ett eget mönster – namnen på alla som läser svenska:

```try
awk -F, '$2 == "svenska" {print $1}' ~/{{documents}}/{{grades}}
```

### Räkna – variabler och `END`

awk har variabler som du inte behöver deklarera – de börjar på 0. Blocket
`END { }` körs en gång, **efter** sista raden. Tillsammans blir det ett enkelt
sätt att summera en kolumn:

```sh
awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/{{documents}}/{{grades}}
```

`summa += $3` betyder "lägg till fält 3 till summa". Räknar du samtidigt
antalet rader (`antal++` ökar med 1) kan du räkna ut medelvärdet:

```sh
awk -F, 'NR > 1 {summa += $3; antal++} END {print "Medel:", summa / antal}' ~/{{documents}}/{{grades}}
```

Det finns också `BEGIN { }`, som körs **innan** första raden – bra för
rubriker. Och med `printf` bestämmer du exakt hur utskriften ska se ut:
`%-8s` är text vänsterjusterad på 8 tecken och `%3d` ett heltal på 3 tecken.

```sh
awk -F, 'BEGIN {print "Elev     Poäng"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/{{documents}}/{{grades}}
```

awk har också funktioner, till exempel `length()`, `toupper()` och
`tolower()`:

```sh
awk '{print toupper($0)}' ~/{{documents}}/{{fruits}}
```

Titta noga på `äpple` och `päron`. På Ubuntu, som terminalen här kör, är
`awk` som standard **mawk**, en liten och snabb variant. För enkla program som
de här märks ingen skillnad – men mawk gör inte om å, ä och ö med
`toupper()`. Det gör **GNU awk** (paketet `gawk`), till skillnad från `tr`.
Distributionerna skiljer sig i vilken awk de använder och i hur man
installerar program – det såg du i delen om distributioner.

Simulatorn kan bara en del av awk-språket – det som tas upp här och lite
till (`if`, loopar och arrayer). Se `man awk`.

## Vilket verktyg ska jag välja?

| Du vill … | Använd |
|---|---|
| hitta rader som innehåller något | `grep` |
| byta eller ta bort enskilda tecken | `tr` |
| byta ut ord eller mönster, ta bort rader | `sed` |
| plocka ut kolumner, jämföra tal, summera | `awk` |

Det riktigt kraftfulla är att kombinera dem. Vilka nivåer finns bland
raderna som *inte* är INFO – om vi struntar i stora och små bokstäver?

```sh
grep -v INFO ~/{{documents}}/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
