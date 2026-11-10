# Prov: Systemadministration

Visa vad du har lärt dig om tjänster, diskar och användare. Frågorna täcker
hela delen, och du behöver 80 % rätt för godkänt.

```quiz
`myserver` ska starta automatiskt varje gång datorn startar, men den får
**inte** startas just nu. Vilket kommando gör precis det?
- [ ] `sudo systemctl start myserver`
- [x] `sudo systemctl enable myserver`
- [ ] `sudo systemctl enable --now myserver`
- [ ] `sudo systemctl restart myserver`
---
`enable` gäller vid uppstart, `start` gäller nu, och `--now` gör båda.
```

Tjänsten `reportd` på den här datorn har misslyckats med att starta. Vad
skriver det här kommandot ut?

```predict
$ systemctl is-active reportd
failed
---
`is-active` skriver bara ut ett ord – här samma tillstånd som `systemctl
--failed` listar. Slutkoden är 0 bara när svaret är `active`.
```

```quiz
Du vill följa loggen för `myserver` medan du testar den, så att nya rader
dyker upp när de kommer. Vilket kommando använder du?
- [ ] `journalctl -n 20`
- [x] `journalctl -u myserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status myserver --all`
---
`-u` väljer en unit och `-f` fortsätter att visa nya rader tills du trycker
Ctrl+C.
```

```try
systemctl cat myserver
---
`ExecStart=` är kommandot som startar tjänsten, och `WantedBy=` är det som
`enable` använder.
```

```quiz
Du kör `systemctl stop myserver` utan `sudo` och får
*Interactive authentication required*. Varför?
- [ ] myserver är inte igång
- [x] Allt som ändrar en tjänst kräver root
- [ ] Du måste köra `daemon-reload` först
- [ ] `stop` fungerar bara för aktiverade tjänster
```

```quiz
Varför står det oftast `UUID=…` i `/etc/fstab` i stället för `/dev/sda2`?
- [ ] UUID:er är kortare att skriva
- [x] Enhetsnamnen kan ändras när diskar läggs till, men ett UUID ändras aldrig
- [ ] `mount` förstår inte enhetsnamn
- [ ] UUID:t visar hur fullt filsystemet är
---
UUID:t skapas tillsammans med filsystemet. Du hittar det med `lsblk -f`,
`blkid` eller `findmnt`.
```

```quiz
`df -h` visar att `/` är full till 98 %. Vilket kommando hjälper dig att hitta
**vilka kataloger** som tar platsen?
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` frågar filsystemet hur fullt det är; `du` går igenom filerna och lägger
ihop dem.
```

Din hemkatalog ligger inte på ett eget filsystem på den här datorn. Vad
skriver det här ut?

```predict
$ df -h ~ | tail -n 1 | tr -s ' ' | cut -d' ' -f6
/
---
Med en sökväg visar `df` bara filsystemet som den ligger på. Den sjätte
kolumnen är `Mounted on` – rotfilsystemet.
```

```quiz
Du har lagt till en rad i `/etc/fstab`. Vad bör du göra **innan** du startar
om?
- [ ] Ingenting – filen läses bara vid uppstart
- [x] Testa den med `sudo mount -a`
- [ ] Köra `sudo systemctl daemon-reload`
- [ ] Formatera partitionen med `mkfs`
---
Ett fel i `/etc/fstab` kan hindra datorn från att starta ordentligt.
`mount -a` monterar allt i filen som inte redan är monterat, så du ser felen
nu.
```

```quiz
Du ska formatera en partition med `mkfs` på en riktig dator. Vad bör du
kontrollera först? (Välj alla som stämmer.)
- [x] Med `lsblk -f`, att storleken, kolumnen `RM` och etiketten stämmer
- [x] Att partitionen inte är monterad
- [x] Att du har en säkerhetskopia av allt viktigt
- [ ] Att partitionen står i `/etc/fstab`
```

```quiz
Varför ligger lösenordshasharna i `/etc/shadow` och inte i `/etc/passwd`?
- [ ] `/etc/passwd` är för liten
- [x] `/etc/passwd` måste kunna läsas av alla, men `/etc/shadow` bara av root
- [ ] Hasharna går att vända tillbaka, så de måste döljas
- [ ] `/etc/passwd` läses bara vid uppstart
---
Annars skulle vem som helst kunna kopiera hasharna och försöka knäcka dem i
lugn och ro. `ls -l` behöver `/etc/passwd` för att visa ägarnas namn.
```

Fälten i `/etc/group` är gruppnamnet, `x`, GID och medlemmarna. Vem är med i
gruppen `sudo`?

```predict
$ grep ^sudo /etc/group | cut -d: -f4
{{user}}
```

```quiz
Vad händer med `sudo userdel kim` – utan `-r`?
- [x] Användaren tas bort, men hemkatalogen `/home/kim` blir kvar
- [ ] Ingenting – `userdel` kräver alltid `-r`
- [ ] Användaren och hemkatalogen tas bort
- [ ] Kontot låses bara
```

```quiz
En användare har UID 33 och skalet `/usr/sbin/nologin`. Vad är det troligen?
- [ ] root
- [ ] En vanlig användare – en människa
- [x] En systemanvändare som en tjänst körs som
- [ ] En borttagen användare
---
UID 1–999 är till för systemanvändare, och `nologin` betyder att ingen kan
logga in som dem.
```

```try
getent group sudo
---
`getent` slår upp gruppen på samma sätt som systemet gör.
```
