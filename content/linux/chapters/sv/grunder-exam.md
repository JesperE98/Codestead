# Prov: Grunderna

Svara på frågorna nedan för att visa vad du har lärt dig i den här delen.

```quiz
Vilken av de här sökvägarna är **absolut**?
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `dokument`
---
En absolut sökväg börjar med `/`, i roten. De andra utgår från katalogen du
står i.
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
Varje `..` går upp en nivå: från `/var/log` till `/var` och sedan till `/`.
```

```quiz
Vad gör `cd -`?
- [ ] Går upp en nivå
- [ ] Går till din hemkatalog
- [x] Går tillbaka till katalogen du var i senast
```

```quiz
Du vill kopiera hela katalogen `bilder`, med allt innehåll, till `bilder-kopia`. Vilket kommando fungerar?
- [ ] `cp bilder bilder-kopia`
- [x] `cp -r bilder bilder-kopia`
- [ ] `mv bilder bilder-kopia`
---
En katalog kopieras med `-r` (*recursive*). `mv` skulle flytta den i stället
för att kopiera den.
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` skapar `a`, `a/b` och `a/b/c` på en gång, så `a/b` innehåller `c`.
```

```quiz
Du skriver `touch min fil.txt` – utan citattecken. Vad händer?
- [ ] En fil som heter `min fil.txt` skapas
- [x] Två filer skapas: `min` och `fil.txt`
- [ ] Ingenting, eftersom namnet innehåller ett mellanslag
---
Skalet delar upp raden vid mellanslag, så `touch` får två argument. Skriv
`touch "min fil.txt"` för att få en fil.
```

```quiz
Vilka rader visar `grep -i error dokument/server.log`?
- [ ] Bara rader med `error` i små bokstäver
- [ ] Bara rader med `ERROR` i stora bokstäver
- [x] Rader med `error` i valfri blandning av stora och små bokstäver
```

```quiz
Du vill följa en loggfil och se nya rader när de skrivs. Vilket kommando passar?
- [ ] `head -n 10 dokument/server.log`
- [x] `tail -f dokument/server.log`
- [ ] `wc -l dokument/server.log`
---
`tail -f` *följer* filen. Avsluta med **Ctrl+C**.
```

```quiz
Vad skriver `wc` ut när du ger det en fil och inga flaggor?
- [ ] Bara antalet rader
- [x] Antalet rader, ord och byte
- [ ] Filens 10 första rader
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` lade till `b`, men det sista `>` skrev över hela filen.
```

```quiz
När körs `b` i `a || b`?
- [ ] Alltid, efter `a`
- [ ] Bara om `a` lyckades
- [x] Bara om `a` misslyckades
```

```try
grep ERROR ~/dokument/server.log | tee fel.txt | wc -l
---
`tee` sparade felraderna i `fel.txt` och skickade dem vidare till `wc -l`, som
räknade dem.
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` gör kommatecknet till avgränsare, och `-f2` behåller fält 2.
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` är antalet fält på raden. Fälten skiljs åt av mellanslag.
```

```quiz
Varför ska ett awk-program som `'{print $3}'` skrivas inom **enkla** citattecken?
- [ ] awk kan inte läsa dubbla citattecken
- [x] Annars tror skalet att `$3` är en skalvariabel och byter ut den innan awk startar
- [ ] Enkla citattecken gör att awk går snabbare
```
