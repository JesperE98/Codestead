# Faktagranskning: arkiv (Archives and compression)

Status: **ogranskad**

Källtext: `content/linux/chapters/en/arkiv.md` (inklusive kontrollfrågorna). Exempelutskrifterna
(storlekar, `betyg.csv`) är hämtade från simulatorn i en ny Ubuntu-terminal.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `tar` samlar filer och kataloger i ett arkiv; rättigheter, ägare och tidsstämplar följer med | | ogranskad | |
| Namnet `tar` kommer från *tape archive*, skrivet för bandstationer på 1970-talet | | ogranskad | |
| Ett tar-arkiv är inte mindre än filerna i det | | ogranskad | |
| `gzip` komprimerar en fil i taget och hanterar inte kataloger | | ogranskad | |
| `.tar.gz` kallas även `.tgz` | | ogranskad | |
| Tabellen över filändelser och hur de packas upp (`.tar`, `.gz`, `.tar.gz`, `.zip`) | | ogranskad | |
| `.tar.xz`, `.tar.bz2`, `.tar.zst` använder `xz`, `bzip2` och `zstd` | | ogranskad | |
| `-c` skapa, `-x` packa upp, `-t` lista, `-v` visa filer, `-f` arkivnamn följer, `-z` gzip | | ogranskad | |
| Exakt en av `c`, `x` och `t` måste anges | | ogranskad | |
| `f` ska stå sist när flaggorna skrivs ihop | | ogranskad | |
| `tar czvf` betyder samma sak som `tar -czvf` | | ogranskad | |
| Fel ordning (`tar -cvf dokument dokument.tar`) får tar att försöka skriva över katalogen/filen | | ogranskad | |
| tar lägger ett huvud på 512 byte före varje fil och fyller ut arkivet till jämna block (10 240 byte i exemplet) | | ogranskad | |
| `du` visar diskanvändning; `-h` läsbara storlekar, `-s` summa | | ogranskad | |
| Disken delas i block om 4 KiB, så `du` visar minst `4.0K` för en fil som inte är tom | | ogranskad | |
| `tar -tzvf` visar innehållet som `ls -l` | | ogranskad | |
| `-C` väljer katalogen tar packar upp i / byter till innan packning | | ogranskad | |
| Moderna tar känner själva igen komprimering vid uppackning (`tar -xf fil.tar.gz`) | | ogranskad | |
| tar frågar inte innan det skriver över befintliga filer | | ogranskad | |
| Inledande `/` tas bort ur absoluta sökvägar (`Removing leading '/' from member names`) | | ogranskad | |
| `gzip` ersätter filen med en `.gz`-fil och behåller rättigheter och tidsstämpel | | ogranskad | |
| `gzip -l` visar storlek före och efter; `gunzip` packar upp | | ogranskad | |
| `gzip -k` behåller originalet | | ogranskad | |
| En mycket liten fil kan bli större av gzip eftersom ett huvud med bl.a. filnamnet läggs till | | ogranskad | |
| Gamla loggfiler i `/var/log` sparas ofta som `.gz` | | ogranskad | |
| `zcat` läser `.gz`-filer utan att packa upp dem; samma som `gzip -dc` | | ogranskad | |
| `zless` och `zgrep` finns på riktiga system | | ogranskad | |
| `.zip` både samlar och komprimerar; Windows och macOS öppnar zip utan extra program | | ogranskad | |
| `.tar.gz` bevarar ägare och rättigheter bättre än zip | | ogranskad | |
| `zip` och `unzip` är inte alltid förinstallerade (inte i simulatorns Ubuntu) | | ogranskad | |
| På Ubuntu installeras de med `sudo apt update` och `sudo apt install zip unzip` | | ogranskad | |
| Utan `apt update` hittar apt inga paket alls (gäller när paketlistorna är tomma) | | ogranskad | |
| Utan `-r` lägger zip bara till den tomma katalogen | | ogranskad | |
| `unzip -l` listar, `-d` väljer katalog och skapar den om den saknas | | ogranskad | |
| unzip hoppar över befintliga filer; `unzip -o` skriver över | | ogranskad | |
