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

```quiz
Varför används `tar` och `gzip` oftast tillsammans?
- [ ] `gzip` kan inte läsa filer som `tar` inte har skapat
- [x] `tar` samlar många filer i en, och `gzip` gör den filen mindre
- [ ] `tar` gör filerna mindre, och `gzip` ger dem rätt rättigheter
---
gzip hanterar bara en fil i taget och vet ingenting om kataloger, och ett
tar-arkiv är i sig inte mindre än filerna i det.
```

| Filändelse | Vad är det? | Packa upp med |
|---|---|---|
| `.tar` | Arkiv, okomprimerat | `tar -xf` |
| `.gz` | En enda komprimerad fil | `gunzip` |
| `.tar.gz`, `.tgz` | Komprimerat arkiv | `tar -xzf` |
| `.zip` | Arkiv och komprimering i ett (vanligt i Windows) | `unzip` |

Du kommer också att se `.tar.xz`, `.tar.bz2` och `.tar.zst`. Det är samma idé,
men med andra komprimeringsprogram (`xz`, `bzip2` och `zstd`).

## Packa ihop med `tar`

Ställ dig i hemkatalogen och packa ihop katalogen `{{documents}}`:

```sh
cd ~
tar -cvf {{documents}}.tar {{documents}}
```

```text
{{documents}}/
{{documents}}/{{grades}}
{{documents}}/{{fruits}}
{{documents}}/server.log
```

`-c` betyder *skapa ett arkiv*, `-v` att tar ska visa vad det gör och `-f`
att namnet på arkivfilen kommer härnäst. Allt som står efter arkivnamnet
packas ihop – det kan vara hur många filer och kataloger som helst.

> **Obs!** Ordningen är *arkivet först, sedan filerna*. Skriver du fel ordning,
> som `tar -cvf {{documents}} {{documents}}.tar`, försöker tar skriva över katalogen –
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

```quiz
Vad gör `tar -xzvf backup.tar.gz`?
- [ ] Skapar det komprimerade arkivet `backup.tar.gz`
- [ ] Listar innehållet i `backup.tar.gz` utan att packa upp
- [x] Packar upp `backup.tar.gz` med gzip och visar varje fil
---
`x` är operationen (packa upp), `z` betyder gzip, `v` visar filerna och efter
`f` kommer arkivets namn.
```

## Komprimera med `-z`

Lägg till `z` så skickas arkivet genom gzip på vägen:

```sh
tar -czvf {{documents}}.tar.gz {{documents}}
ls -l {{documents}}.tar {{documents}}.tar.gz
```

```text
-rw-r--r-- 1 {{user}} {{user}} 10240 Oct 30 12:00 {{documents}}.tar
-rw-r--r-- 1 {{user}} {{user}}   816 Oct 30 12:00 {{documents}}.tar.gz
```

Arkivet utan komprimering är hela 10 240 byte, fast filerna bara är på drygt
1 000 byte tillsammans. Det beror på att tar lägger ett huvud på 512 byte före
varje fil och fyller ut arkivet till jämna block. Allt det tomma utrymmet
komprimeras bort av gzip.

Kommandot `du` (*disk usage*) visar hur mycket plats något tar på disken.
Med `-h` får du läsbara storlekar och med `-s` en summa för en hel katalog:

```sh
du -h {{documents}}.tar {{documents}}.tar.gz
du -sh {{documents}}
```

```text
12K	{{documents}}.tar
4.0K	{{documents}}.tar.gz
16K	{{documents}}
```

Disken delas in i block om 4 KiB, så `du` visar aldrig mindre än `4.0K` för en
fil som inte är tom. Den exakta storleken ser du med `ls -l` (eller `ls -lh`).

## Titta i ett arkiv innan du packar upp

```sh
tar -tzvf {{documents}}.tar.gz
```

```text
drwxr-xr-x {{user}}/{{user}}         0 2026-10-30 12:00 {{documents}}/
-rw-r--r-- {{user}}/{{user}}       146 2026-10-30 12:00 {{documents}}/{{grades}}
-rw-r--r-- {{user}}/{{user}}        64 2026-10-30 12:00 {{documents}}/{{fruits}}
-rw-r--r-- {{user}}/{{user}}       824 2026-10-30 12:00 {{documents}}/server.log
```

Med `v` visas innehållet som i `ls -l`, med rättigheter, ägare och storlek.
Det är en god vana att titta först: en del arkiv saknar en gemensam katalog
överst och sprider ut hundratals filer där du står när du packar upp dem.

## Packa upp

```sh
mkdir {{unpacked}}
tar -xzvf {{documents}}.tar.gz -C {{unpacked}}
```

`-C` (stort C) väljer katalogen som tar packar upp i. Utan den hamnar allt i
katalogen du står i. Moderna versioner av tar känner själva igen om arkivet är
komprimerat när de packar upp, så `tar -xf {{documents}}.tar.gz` fungerar också.

> **Varning!** tar frågar inte innan det skriver över filer som redan finns.
> Lista innehållet först om du är osäker.

### Absoluta sökvägar

Om du packar ihop en absolut sökväg tas det inledande `/` bort, så att arkivet
går att packa upp var som helst:

```sh
tar -czf backup.tar.gz ~/{{documents}}
```

```text
tar: Removing leading `/' from member names
```

Arkivet innehåller nu `home/{{user}}/{{documents}}/...`. Vill du bara ha `{{documents}}/`
i arkivet kan du låta tar byta katalog först med `-C`:

```sh
tar -czf backup.tar.gz -C ~ {{documents}}
tar -tzf backup.tar.gz
```

```quiz
Du kör `tar -czf backup.tar.gz -C ~ {{documents}}`. Vad innehåller arkivet?
- [x] `{{documents}}/` och filerna i den
- [ ] `home/{{user}}/{{documents}}/` och filerna i den
- [ ] `/home/{{user}}/{{documents}}/` och filerna i den
---
`-C ~` gör att tar först byter till din hemkatalog, så namnen i arkivet börjar
med `{{documents}}/`.
```

## Komprimera enskilda filer med `gzip`

`gzip` komprimerar en fil och **ersätter** den med en `.gz`-fil. Rättigheterna
och tidsstämpeln följer med:

```sh
cp {{documents}}/server.log .
gzip -v server.log
```

```text
server.log:	 39.8% -- replaced with server.log.gz
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
cp {{documents}}/{{fruits}} .
gzip -kv {{fruits}}
```

```text
{{fruits}}:	-20.3% -- created {{fruits}}.gz
```

```predict
$ cp {{documents}}/{{fruits}} .
$ cp {{documents}}/server.log .
$ gzip {{fruits}}
$ gzip -k server.log
$ ls {{fruits}}* server*
{{fruits}}.gz  server.log  server.log.gz
---
Vanligt `gzip` ersätter filen med en `.gz`-fil; `-k` behåller originalet.
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

Programmen `zip` och `unzip` är inte alltid förinstallerade, och i den här
terminalen måste du installera dem först. Det gör du med pakethanteraren – du
lär dig allt om den i delen om distributioner och paket. I Ubuntu gör du så
här:

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` hämtar listan över vilka paket som finns. Utan den hittar apt
inga paket alls.

Packa sedan ihop katalogen. Glöm inte `-r` (*recursive*) – utan den lägger zip
bara till den tomma katalogen, inte filerna i den:

```sh
zip -r {{documents}}.zip {{documents}}
```

```text
  adding: {{documents}}/ (stored 0%)
  adding: {{documents}}/{{grades}} (deflated 17%)
  adding: {{documents}}/{{fruits}} (deflated 27%)
  adding: {{documents}}/server.log (deflated 43%)
```

Lägg märke till att ordningen är densamma som för tar: arkivet först, sedan
filerna. `unzip -l` listar innehållet och `-d` väljer var det packas upp
(katalogen skapas om den inte finns):

```sh
unzip -l {{documents}}.zip
unzip {{documents}}.zip -d {{fromZip}}
```

Finns filerna redan hoppar unzip över dem. Med `unzip -o` skrivs de över.

```quiz
Du kör `zip {{documents}}.zip {{documents}}` utan `-r`. Vad hamnar i zip-filen?
- [ ] Alla filer i `{{documents}}`
- [x] Bara den tomma katalogen `{{documents}}/`
- [ ] Ingenting – zip vägrar köra
---
Utan `-r` (*recursive*) går zip inte in i katalogen.
```

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
