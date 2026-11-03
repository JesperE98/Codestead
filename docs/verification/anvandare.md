# Faktagranskning: anvandare

Kapitel: Användare och grupper (`src/Linux/content/chapters/en/anvandare.md`)

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Kärnan håller reda på UID, inte namnet |  | ogranskad |  |
| UID 0 = root, 1–999 systemanvändare, 1000 och uppåt vanliga användare |  | ogranskad |  |
| `/etc/passwd` har sju fält separerade med kolon (namn, x, UID, GID, kommentar, hemkatalog, skal) |  | ogranskad |  |
| `getent passwd` hittar även användare som inte står i filen, t.ex. på en central server |  | ogranskad |  |
| Systemanvändare har skalet `nologin`; i Ubuntu heter webbserverns användare `www-data`; namnen skiljer sig mellan distributioner |  | ogranskad |  |
| `nobody` har UID 65534 |  | ogranskad |  |
| Kontrollfråga: `awk -F: '$3 == 0 {print $1}' /etc/passwd` ger `root` |  | ogranskad |  |
| `/etc/group`: gruppnamn, x, GID, medlemmar |  | ogranskad |  |
| En primär grupp och valfritt antal extra grupper; nya filer får den primära gruppen |  | ogranskad |  |
| I de flesta distributioner får varje användare en egen primär grupp med samma namn |  | ogranskad |  |
| `/etc/passwd` måste vara läsbar för alla (för `ls -l`), därför ligger hasharna i `/etc/shadow` som bara root kan läsa |  | ogranskad |  |
| Fält 2 i `/etc/shadow` är en hash som inte kan vändas; `$y$` = yescrypt; `!` eller `*` = inget lösenord eller låst |  | ogranskad |  |
| `chage -l` visar lösenordets datum i klartext |  | ogranskad |  |
| `useradd`-flaggorna `-m`, `-s`, `-c`, `-G` |  | ogranskad |  |
| `useradd` väljer nästa lediga UID från 1000; gränserna finns i `/etc/login.defs` |  | ogranskad |  |
| En grupp med samma namn skapas och `/etc/skel` kopieras till hemkatalogen |  | ogranskad |  |
| I Ubuntu skapar `useradd` ingen hemkatalog utan `-m`, och skalet blir `/bin/sh` utan `-s` |  | ogranskad |  |
| Andra distributioner har andra standardval |  | ogranskad |  |
| `adduser` är ett vänligare skript från Debian-familjen som skapar hemkatalog, väljer bash och frågar efter lösenord och namn; `adduser lisa sudo` lägger till i grupp |  | ogranskad |  |
| I Ubuntu kommer `useradd`, `passwd` m.fl. i paketet `passwd`; andra familjer kallar paketet något annat |  | ogranskad |  |
| En ny användare har inget lösenord (`!` i `/etc/shadow`) |  | ogranskad |  |
| `passwd` visar inte det du skriver |  | ogranskad |  |
| Bara root får ändra andras lösenord |  | ogranskad |  |
| `groupadd`, `usermod -aG`; utan `-a` sätts listan till exakt det du skriver |  | ogranskad |  |
| `gpasswd -a` och `gpasswd -d` |  | ogranskad |  |
| På en riktig dator gäller ny gruppmedlemskap först vid nästa inloggning |  | ogranskad |  |
| `chgrp` och `chmod 775` för en gemensam katalog |  | ogranskad |  |
| `/etc/sudoers`: `%sudo ALL=(ALL:ALL) ALL`; i Ubuntu ger gruppen `sudo` sudo-rätt |  | ogranskad |  |
| I Arch och Fedora heter gruppen `wheel` (gammalt Unix-namn, *big wheel*) |  | ogranskad |  |
| Redigera `/etc/sudoers` med `visudo`, som kontrollerar filen |  | ogranskad |  |
| `su - kim` kräver kims lösenord; `sudo -u` och `sudo -iu` kräver ditt eget |  | ogranskad |  |
| `su` utan namn = root; i Ubuntu har root inget lösenord, använd `sudo -i` |  | ogranskad |  |
| `usermod -L` sätter `!` före hashen, `-U` låser upp; `passwd -S` visar P, L eller NP |  | ogranskad |  |
| `chage -E` låter kontot gå ut ett visst datum |  | ogranskad |  |
| `who` och `last` |  | ogranskad |  |
| `userdel -r` tar bort hemkatalogen; utan `-r` blir filerna kvar |  | ogranskad |  |
| Ubuntu har `deluser --remove-home` och `deluser kim sudo` |  | ogranskad |  |
| `userdel` vägrar ta bort en inloggad användare |  | ogranskad |  |
