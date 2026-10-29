# Navigera i filsystemet

I Linux finns inga enhetsbokstäver som `C:`. Allt – hårddiskar, USB-minnen,
till och med hårdvara – finns i **ett enda träd** av kataloger som börjar i
**roten**, som skrivs `/`.

## De viktigaste katalogerna

| Katalog | Innehåll |
|---|---|
| `/` | Roten – toppen av trädet |
| `/home` | Användarnas hemkataloger, t.ex. `/home/elev` |
| `/root` | Hemkatalogen för administratören root |
| `/etc` | Systemets inställningar (konfigurationsfiler) |
| `/usr/bin` | Program (kommandon) som `ls` och `cat` |
| `/var/log` | Loggfiler |
| `/tmp` | Tillfälliga filer som alla får skriva |
| `/dev` | Enheter (*devices*), t.ex. diskar |
| `/proc` | Information om processer och kärnan |
| `/boot` | Filer som behövs för att starta datorn |

Strukturen kallas *Filesystem Hierarchy Standard* och är nästan densamma i
alla distributioner.

## Var är jag? – `pwd`

`pwd` (*print working directory*) visar katalogen du står i just nu:

```sh
pwd
```

## Vad finns här? – `ls`

`ls` listar innehållet i en katalog. Utan argument visas katalogen du står i,
men du kan också ange en annan:

```sh
ls /etc
```

Med flaggan `-l` får du ett långt format med mer information:

```sh
ls -l
```

Filer vars namn börjar med en punkt är **dolda** och visas inte som standard.
Ofta är det inställningsfiler, som `.bashrc`. Flaggan `-a` (*all*) visar dem:

```sh
ls -a
```

Flaggor kan kombineras: `ls -la` är samma sak som `ls -l -a`.

## Byta katalog – `cd`

`cd` (*change directory*) flyttar dig till en annan katalog:

```sh
cd /var/log
```

Det finns två sorters sökvägar:

- En **absolut** sökväg börjar med `/` och utgår från roten, t.ex. `/var/log`.
  Den fungerar oavsett var du står.
- En **relativ** sökväg utgår från katalogen du står i. Står du i `/` når du
  `/var/log` med bara `cd var/log`.

Några specialnamn är bra att kunna:

| Namn | Betyder |
|---|---|
| `.` | Katalogen du står i |
| `..` | Katalogen ovanför (föräldern) |
| `~` | Din hemkatalog |
| `-` | (bara med `cd`) katalogen du var i senast |

`cd` utan argument tar dig alltid hem.

```sh
cd ..
```

## Tab-komplettering

Du behöver sällan skriva hela namn. Skriv början, till exempel `cd /va`, och
tryck **Tab** – skalet fyller i resten. Finns det flera möjligheter visas de
när du trycker Tab. Vana Linux-användare trycker Tab hela tiden!
