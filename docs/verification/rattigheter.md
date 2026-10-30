# Faktagranskning: rattigheter (Users, permissions and sudo)

Status: **ogranskad**

Källtext: `content/linux/chapters/en/rattigheter.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Varje användare tillhör en eller flera grupper; `id` visar dem | | ogranskad | |
| root är administratören som får göra allt | | ogranskad | |
| Första tecknet i `ls -l` är typen: `-` fil, `d` katalog | | ogranskad | |
| Därefter kommer tre grupper om tre tecken: ägaren, gruppen, övriga | | ogranskad | |
| `r` på fil = läsa innehållet; på katalog = lista innehållet | | ogranskad | |
| `w` på fil = ändra innehållet; på katalog = skapa och ta bort filer i den | | ogranskad | |
| `x` på fil = köra som program; på katalog = gå in med `cd` | | ogranskad | |
| `ls -l` visar ägare och grupp efter rättigheterna | | ogranskad | |
| Sifferform: r = 4, w = 2, x = 1, en siffra per grupp | | ogranskad | |
| `755` = `rwxr-xr-x`, `644` = `rw-r--r--`, `600` = `rw-------` | | ogranskad | |
| `chmod` med symboler: `u`, `g`, `o`, `a` följt av `+`, `-` eller `=` | | ogranskad | |
| `chmod 600` följt av `chmod g+r` ger `-rw-r-----` (kontrollfråga) | | ogranskad | |
| Första raden `#!/bin/bash` (shebang) talar om vilket program som kör filen | | ogranskad | |
| Ett skript måste vara körbart (`chmod +x`) för att köras som program; annars `Permission denied` | | ogranskad | |
| `./` behövs eftersom aktuell katalog inte finns i `PATH` | | ogranskad | |
| `/etc/shadow` innehåller lösenorden och kan bara läsas av root | | ogranskad | |
| `sudo` kör ett enstaka kommando som root | | ogranskad | |
| `sudo` frågar efter användarens **eget** lösenord | | ogranskad | |
| Bara användare i administratörsgruppen får använda sudo | | ogranskad | |
| På Ubuntu heter administratörsgruppen `sudo` | | ogranskad | |
| Vissa andra distributioner kallar gruppen `wheel` | | ogranskad | |
| `sudo -i` startar ett root-skal; prompten blir `#`; `exit` går tillbaka | | ogranskad | |
| I `sudo echo text > fil` öppnar användarens eget skal filen, inte sudo | | ogranskad | |
| `echo ... \| sudo tee -a fil` lägger till text i en fil som bara root får ändra | | ogranskad | |
