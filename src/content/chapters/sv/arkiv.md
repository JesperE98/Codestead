# Arkiv och komprimering

Förr eller senare vill du skicka en hel katalog till någon, göra en backup
eller ladda ner källkoden till ett program. Då behöver många filer bli **en**
fil – och gärna en mindre fil. I Linux görs det oftast av två olika program
som jobbar tillsammans.

## Arkivera och komprimera – två olika saker

- Att **arkivera** är att samla många filer och kataloger i en enda fil, ett
  *arkiv*. Rättigheter, ägare och tidsstämplar följer med. Programmet heter
  `tar` (från *tape archive* – det skrevs för bandspelare på 70-talet).
  Ett arkiv blir **inte** mindre än filerna i det, snarare tvärtom.
- Att **komprimera** är att göra en fil mindre genom att koda upprepningar
  smartare. Det vanligaste programmet är `gzip`. Det hanterar bara en fil i
  taget och vet ingenting om kataloger.

Därför använder man dem ihop: först `tar` för att få en fil, sedan `gzip`
för att göra den mindre. Resultatet heter `.tar.gz`, eller kortare `.tgz`.
Det är Unix-filosofin i ett nötskal – små program som gör en sak var och som
går att kombinera.

| Filändelse | Vad är det? | Packa upp med |
|---|---|---|
| `.tar` | Arkiv, okomprimerat | `tar -xf` |
| `.gz` | En enda komprimerad fil | `gunzip` |
| `.tar.gz`, `.tgz` | Komprimerat arkiv | `tar -xzf` |
| `.zip` | Arkiv och komprimering i ett (vanligt i Windows) | `unzip` |

Du kommer också att se `.tar.xz`, `.tar.bz2` och `.tar.zst`. Det är samma idé,
men med andra komprimeringsprogram (`xz`, `bzip2` och `zstd`).

## Packa ihop med `tar`

Ställ dig i hemkatalogen och packa ihop katalogen `dokument`:

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/frukter.txt
dokument/server.log
```

`-c` betyder *skapa ett arkiv*, `-v` att tar ska visa vad det gör och `-f`
att namnet på arkivfilen kommer härnäst. Allt som står efter arkivnamnet
packas ihop – det kan vara hur många filer och kataloger som helst.

> **Obs!** Ordningen är *arkivet först, sedan filerna*. Skriver du fel ordning,
> som `tar -cvf dokument dokument.tar`, försöker tar skriva över katalogen –
> eller värre, en fil du ville behålla.

## Flaggorna att komma ihåg

| Flagga | Står för | Betyder |
|---|---|---|
| `c` | **c**reate | Skapa ett nytt arkiv |
| `x` | e**x**tract | Packa upp |
| `t` | lis**t** (*table of contents*) | Lista innehållet |
| `v` | **v**erbose | Visa filerna som hanteras |
| `f` | **f**ile | Arkivfilens namn kommer härnäst |
| `z` | g**z**ip | Komprimera eller dekomprimera med gzip |

Exakt **en** av `c`, `x` och `t` måste vara med – den säger *vad* tar ska göra.
Resten är tillägg. En vanlig minnesregel:

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Lägg alltid `f` **sist** när du skriver ihop flaggorna, eftersom filnamnet ska
stå direkt efter den. Av historiska skäl går det också att skippa
bindestrecket: `tar czvf` betyder samma sak som `tar -czvf`.

## Komprimera med `-z`

Lägg till `z` så skickas arkivet genom gzip på vägen:

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   674 Oct 30 12:00 dokument.tar.gz
```

Arkivet utan komprimering är hela 10 240 byte, fast filerna bara är på knappt
900 byte tillsammans. Det beror på att tar lägger ett huvud på 512 byte före
varje fil och fyller ut arkivet till jämna block. Allt det tomma utrymmet
komprimeras bort av gzip.

Kommandot `du` (*disk usage*) visar hur mycket plats något tar på disken.
Med `-h` får du läsbara storlekar och med `-s` en summa för en hel katalog:

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
12K	dokument
```

Disken delas in i block om 4 KiB, så `du` visar aldrig mindre än `4.0K` för en
fil som inte är tom. Den exakta storleken ser du med `ls -l` (eller `ls -lh`).

## Titta i ett arkiv innan du packar upp

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

Med `v` visas innehållet som i `ls -l`, med rättigheter, ägare och storlek.
Det är en god vana att titta först: en del arkiv saknar en gemensam katalog
överst och sprider ut hundratals filer där du står när du packar upp dem.

## Packa upp

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C` (stort C) väljer katalogen som tar packar upp i. Utan den hamnar allt i
katalogen du står i. Moderna versioner av tar känner själva igen om arkivet är
komprimerat när de packar upp, så `tar -xf dokument.tar.gz` fungerar också.

> **Varning!** tar frågar inte innan det skriver över filer som redan finns.
> Lista innehållet först om du är osäker.

### Absoluta sökvägar

Om du packar ihop en absolut sökväg tas det inledande `/` bort, så att arkivet
går att packa upp var som helst:

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

Arkivet innehåller nu `home/elev/dokument/...`. Vill du bara ha `dokument/`
i arkivet kan du låta tar byta katalog först med `-C`:

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

## Komprimera enskilda filer med `gzip`

`gzip` komprimerar en fil och **ersätter** den med en `.gz`-fil. Rättigheterna
och tidsstämpeln följer med:

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` visar storleken före och efter, och `gunzip` packar upp filen igen:

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

Vill du behålla originalet använder du `gzip -k` (*keep*). Prova med en riktigt
liten fil – den blir faktiskt **större**, eftersom gzip lägger till ett huvud
med bland annat filnamnet:

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

### Läsa komprimerade filer direkt

Gamla loggfiler i `/var/log` sparas ofta som `.gz` för att spara plats.
Med `zcat` läser du dem utan att packa upp dem – och resultatet kan skickas
vidare i en pipe som vanligt:

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` är samma sak som `gzip -dc`: dekomprimera (`d`) till standard output
(`c`). På ett riktigt system finns också `zless` och `zgrep`.

## zip – för utbyte med Windows

Formatet `.zip` gör båda sakerna på en gång: det samlar filer *och*
komprimerar dem. Windows och macOS kan öppna zip-filer utan extra program, så
det är det självklara valet när du ska skicka filer till någon som inte kör
Linux. Inom Linuxvärlden är `.tar.gz` vanligare, eftersom det bevarar ägare
och rättigheter bättre.

Programmen `zip` och `unzip` är inte alltid förinstallerade. Då installerar du
dem med pakethanteraren – mer om den i kapitlet om pakethantering. I
{{distro}} gör du så här:

:::debian
```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` hämtar listan över vilka paket som finns. Utan den hittar apt
inga paket alls.
:::

:::arch
```sh
sudo pacman -S zip unzip
```

Svara ja (`Y` eller bara Enter) när pacman frågar om du vill fortsätta.
:::

:::redhat
```sh
sudo dnf install zip unzip
```

Svara `y` när dnf frågar `Is this ok [y/N]` – stort `N` betyder att Nej är
standard om du bara trycker Enter.
:::

Packa sedan ihop katalogen. Glöm inte `-r` (*recursive*) – utan den lägger zip
bara till den tomma katalogen, inte filerna i den:

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

Lägg märke till att ordningen är densamma som för tar: arkivet först, sedan
filerna. `unzip -l` listar innehållet och `-d` väljer var det packas upp
(katalogen skapas om den inte finns):

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

Finns filerna redan hoppar unzip över dem. Med `unzip -o` skrivs de över.

## Sammanfattning

| Vill du ... | Kommando |
|---|---|
| packa ihop och komprimera en katalog | `tar -czvf arkiv.tar.gz katalog` |
| se vad ett arkiv innehåller | `tar -tzvf arkiv.tar.gz` |
| packa upp ett arkiv | `tar -xzvf arkiv.tar.gz` (lägg till `-C katalog`) |
| komprimera en fil | `gzip fil` (eller `gzip -k fil`) |
| packa upp en `.gz`-fil | `gunzip fil.gz` |
| läsa en `.gz`-fil direkt | `zcat fil.gz` |
| skapa eller packa upp en zip-fil | `zip -r arkiv.zip katalog` · `unzip arkiv.zip` |
| se hur stort något är | `du -sh katalog` · `ls -lh` |
