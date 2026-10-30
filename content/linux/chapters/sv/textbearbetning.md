# Textbearbetning med sed, tr och awk

Med `grep` kan du *hitta* rader. Men ofta vill du göra mer än så: byta ut ett
ord, ta bort vissa rader, plocka ut en kolumn eller räkna ihop siffror. Då
använder du tre klassiska verktyg:

| Verktyg | Arbetar med | Typiskt jobb |
|---|---|---|
| `tr` | enskilda **tecken** | gör om till versaler, byt `:` mot ny rad |
| `sed` | **rader** | byt ut ett ord, ta bort rader |
| `awk` | **kolumner** (fält) | plocka ut kolumner, summera, räkna |

Alla tre är *filter*: de läser text, gör något med den och skriver resultatet
till stdout. Därför passar de perfekt i pipes. Och originalfilen ändras **inte**
(med ett undantag, `sed -i`, som vi kommer till).

I `dokument` finns en tredje övningsfil, en CSV-fil med elevernas poäng:

```sh
cat ~/dokument/betyg.csv
```

CSV betyder *comma-separated values* – kolumnerna skiljs åt av kommatecken,
och första raden är en rubrikrad.

## Byta tecken – `tr`

`tr` (*translate*) byter varje tecken i den första mängden mot tecknet på samma
plats i den andra. `a-z` betyder alla bokstäver från a till z:

```sh
echo "hej från terminalen" | tr a-z A-Z
```

```text
HEJ FRåN TERMINALEN
```

Ser du å:et? `tr` arbetar med enskilda *byte*, och å, ä och ö ingår inte i
`a-z`. Det är bra att känna till – GNU `awk` (längre ner) klarar det bättre.

`tr` läser **bara** från stdin, aldrig från filer. Vill du använda en fil
skickar du in den med `<` eller en pipe:

```sh
tr a-z A-Z < ~/dokument/frukter.txt
```

Ett klassiskt knep är att byta kolon mot radbrytning (`\n`), så att varje
katalog i `PATH` hamnar på en egen rad:

```sh
echo $PATH | tr ':' '\n'
```

Med `-d` (*delete*) tar du bort tecken och med `-s` (*squeeze*) pressar du
ihop flera likadana tecken i rad till ett:

```sh
echo "070-123 45 67" | tr -d ' -'
echo "för     många      mellanslag" | tr -s ' '
```

```predict
$ echo "hello world" | tr -d o
hell wrld
---
`-d` tar bort varje `o`, var det än står.
```

I stället för intervall kan du skriva *klasser*, t.ex. `[:upper:]` (versaler),
`[:lower:]` (gemener), `[:digit:]` (siffror) och `[:space:]` (blanktecken):

```sh
echo "Rum 101, våning 3" | tr -d '[:digit:]'
```

## Strömeditorn – `sed`

`sed` (*stream editor*) läser text rad för rad och kör ett litet *skript* på
varje rad. Det vanligaste kommandot är `s` – *substitute*, byt ut.

### Byta ut text – `s`

```sh
sed 's/ERROR/FEL/' ~/dokument/server.log
```

Skriptet `s/ERROR/FEL/` betyder: byt `ERROR` mot `FEL`. Det har formen

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
sed 's/warn/VARNING/i' ~/dokument/server.log
```

Mönstret är ett *reguljärt uttryck*, precis som i `grep`. Här tar vi bort
datumet i början av varje rad (`^` = radens början, `[0-9-]*` = siffror och
bindestreck):

```sh
sed 's/^[0-9-]* //' ~/dokument/server.log
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
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/dokument/server.log
```

### Välja rader – adresser

Framför ett kommando kan du skriva en *adress* som väljer vilka rader det
gäller. Kommandot `d` (*delete*) tar bort rader och `p` (*print*) skriver ut
dem:

```sh
sed '/INFO/d' ~/dokument/server.log
sed '1d' ~/dokument/betyg.csv
```

Det första tar bort alla rader som innehåller `INFO`, det andra tar bort rad 1
– rubrikraden.

`sed` skriver normalt ut *varje* rad. Med `-n` slutar den med det, och då
skrivs bara det ut som `p` ber om. Så här visar du rad 5 till 8:

```sh
sed -n '5,8p' ~/dokument/server.log
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
sed '/ERROR/s/^/>>> /' ~/dokument/server.log
```

Kommandot `q` (*quit*) avslutar efter en viss rad – `sed 3q` gör alltså samma
sak som `head -n 3`. Flera kommandon skiljer du åt med `;` eller med flera
`-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/FEL/' ~/dokument/server.log
```

### Ändra filen på plats – `sed -i`

Allt hittills har bara *skrivits ut*. Filen är oförändrad – kontrollera gärna
med `cat`. Med `-i` (*in-place*) skriver `sed` i stället tillbaka resultatet
till filen. Prova på en kopia:

```sh
cp ~/dokument/frukter.txt ~/frukter-kopia.txt
sed -i 's/kiwi/kiwifrukt/' ~/frukter-kopia.txt
cat ~/frukter-kopia.txt
```

`sed -i` ångrar man inte. Ett bra arbetssätt är att först köra kommandot
**utan** `-i` och titta på resultatet, och lägga till `-i` när det ser rätt
ut. Skriver du `-i.bak` sparas dessutom originalet som `fil.bak`.

```quiz
Du kör `sed 's/kiwi/KIWI/' ~/dokument/frukter.txt`. Vad händer med filen?
- [ ] Varje `kiwi` i filen blir `KIWI`
- [ ] Bara det första `kiwi` i filen blir `KIWI`
- [x] Ingenting – resultatet skrivs bara ut, filen är oförändrad
---
Utan `-i` skriver `sed` bara till stdout. Filen är som den var.
```

Konfigurationsfiler i `/etc` ägs av root, så där behövs `sudo sed -i ...`.
Det är ett vanligt sätt att ändra en inställning i ett skript, utan att öppna
en texteditor.

## Klippa ut fält – `cut`

När en fil består av fält med en avgränsare emellan kan `cut` plocka ut ett
fält. `-d` väljer avgränsaren (*delimiter*) och `-f` vilket fält som ska
behållas. Här är ämnena – fält 2 – i CSV-filen:

```sh
cut -d, -f2 ~/dokument/betyg.csv
```

I `/etc/passwd` skiljs fälten åt av kolon och fält 1 är användarnamnet, så
`cut -d: -f1 /etc/passwd` listar alla användare. Precis som de andra filtren
passar `cut` i en pipe – till exempel framför `tr`.

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
awk '{print $3}' ~/dokument/server.log
```

Programmet står inom `{ }` och körs för varje rad. Skriv alltid
awk-programmet inom **enkla** citattecken – annars tror skalet att `$3` är en
skalvariabel och byter ut den innan awk ens startar.

awk passar perfekt i en pipe. Hur många rader finns det av varje nivå?

```sh
awk '{print $3}' ~/dokument/server.log | sort | uniq -c
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

Jämför med `cut -d: -f1` från förra avsnittet. Skillnaden är att awk kan byta
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
awk '/ERROR/ {print $2}' ~/dokument/server.log
```

… eller ett villkor. Text står inom dubbla citattecken:

```sh
awk -F, '$2 == "matte" {print $1, $3}' ~/dokument/betyg.csv
```

Jämförelser skrivs `==`, `!=`, `<`, `<=`, `>` och `>=`, och villkor kombineras
med `&&` (och), `||` (eller) och `!` (inte). Här är alla elever med minst 90
poäng (utan `{ }` skrivs hela raden ut):

```sh
awk -F, '$3 >= 90' ~/dokument/betyg.csv
```

Fick du med rubrikraden också? I den är fält 3 ordet `poäng`, och när ett
värde inte är ett tal jämför awk som *text* – och `"poäng"` kommer efter
`"90"` i bokstavsordning. Rubrikraden hoppar du över med `NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/dokument/betyg.csv
```

Prova ett eget mönster – namnen på alla som läser svenska:

```try
awk -F, '$2 == "svenska" {print $1}' ~/dokument/betyg.csv
```

### Räkna – variabler och `END`

awk har variabler som du inte behöver deklarera – de börjar på 0. Blocket
`END { }` körs en gång, **efter** sista raden. Tillsammans blir det ett enkelt
sätt att summera en kolumn:

```sh
awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv
```

`summa += $3` betyder "lägg till fält 3 till summa". Räknar du samtidigt
antalet rader (`antal++` ökar med 1) kan du räkna ut medelvärdet:

```sh
awk -F, 'NR > 1 {summa += $3; antal++} END {print "Medel:", summa / antal}' ~/dokument/betyg.csv
```

Det finns också `BEGIN { }`, som körs **innan** första raden – bra för
rubriker. Och med `printf` bestämmer du exakt hur utskriften ska se ut:
`%-8s` är text vänsterjusterad på 8 tecken och `%3d` ett heltal på 3 tecken.

```sh
awk -F, 'BEGIN {print "Elev     Poäng"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/dokument/betyg.csv
```

awk har också funktioner, till exempel `length()`, `toupper()` och
`tolower()`:

```sh
awk '{print toupper($0)}' ~/dokument/frukter.txt
```

Titta noga på `äpple` och `päron`. På Ubuntu, som terminalen här kör, är
`awk` som standard **mawk**, en liten och snabb variant. För enkla program som
de här märks ingen skillnad – men mawk gör inte om å, ä och ö med
`toupper()`. Det gör **GNU awk** (paketet `gawk`), till skillnad från `tr`.
Distributionerna skiljer sig i vilken awk de använder och i hur man
installerar program – det kommer i kapitlet om distributioner.

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
grep -v INFO ~/dokument/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
