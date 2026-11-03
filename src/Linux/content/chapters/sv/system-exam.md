# Prov: Systemet

Svara på frågorna om variabler, rättigheter, processer och arkiv – du behöver 80 % för godkänt.

```predict
$ echo "$HOME" '$USER'
/home/{{user}} $USER
---
Dubbla citattecken byter ut variabeln mot sitt värde; enkla citattecken
skriver ut den precis som den står.
```

```quiz
Vad gör `export` med en variabel?
- [ ] Sparar den i `~/.bashrc`
- [x] Gör den till en miljövariabel som även programmen du startar kan läsa
- [ ] Tar bort den
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
`ls` gick bra, så slutkoden är `0`. Själva utskriften försvann i `/dev/null`.
```

```quiz
Vilket tal ger rättigheterna `rwxr-x---`?
- [ ] `755`
- [x] `750`
- [ ] `640`
---
Ägaren: 4 + 2 + 1 = 7. Gruppen: 4 + 1 = 5. Övriga: 0.
```

```predict
$ touch verktyg.sh
$ chmod 755 verktyg.sh
$ chmod go-x verktyg.sh
$ ls -l verktyg.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
Medlemmar i vilken grupp får använda `sudo` i Ubuntu?
- [x] `sudo`
- [ ] `root`
- [ ] `{{user}}`
```

```quiz
Vad gör `sudo -i`?
- [ ] Visar information om sudo
- [x] Startar ett root-skal, där prompten ändras till `#`, tills du skriver `exit`
- [ ] Kör förra kommandot igen som root
```

```quiz
I `ps aux` har en process `R` i kolumnen `STAT`. Vad betyder det?
- [x] Den kör
- [ ] Den sover
- [ ] Den tillhör root
```

```quiz
Vilken variabel innehåller PID för det senaste bakgrundsjobbet?
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
Du provar `kill 812` på en process som tillhör root och får
`Operation not permitted`. Vad gör du?
- [ ] Använder `kill -9 812` i stället
- [x] Kör det med `sudo`: `sudo kill 812`
- [ ] Ingenting – roots processer går aldrig att stoppa
```

```quiz
Vad är skillnaden mellan `pkill` och `killall`?
- [x] `pkill` matchar ett mönster, `killall` kräver det exakta namnet
- [ ] `pkill` skickar `SIGKILL`, `killall` skickar `SIGTERM`
- [ ] Det finns ingen – de är samma program
```

```quiz
Vad är fel med `tar -cvf {{documents}} {{documents}}.tar`?
- [ ] `-v` kan inte kombineras med `-c`
- [x] Ordningen: arkivets namn måste komma direkt efter `f`, före filerna
- [ ] Ett tar-arkiv måste sluta på `.tgz`
```

```predict
$ cp {{documents}}/{{fruits}} .
$ gzip {{fruits}}
$ gunzip {{fruits}}.gz
$ ls {{fruits}}*
{{fruits}}
```

```quiz
Vad gör `zcat server.log.gz`?
- [x] Skriver ut det okomprimerade innehållet, och `server.log.gz` förblir som den är
- [ ] Packar upp filen till `server.log`
- [ ] Komprimerar filen en gång till
---
`zcat` är samma sak som `gzip -dc`: dekomprimera till standard output.
```

```try
du -sh {{documents}}
---
`-s` ger en summa för hela katalogen och `-h` gör storleken lätt att läsa.
```

```quiz
Du skapar `ln -s {{notes}} lank` och tar sedan bort `{{notes}}`. Vad händer när du kör `cat lank`?
- [ ] Det gamla innehållet visas
- [x] `No such file or directory` – länken är trasig
- [ ] Länken tas också bort
---
En symbolisk länk innehåller bara en sökväg. När inget finns där längre är
länken trasig. En hård länk hade hållit innehållet vid liv.
```
