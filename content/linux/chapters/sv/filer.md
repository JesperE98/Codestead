# Filer och kataloger

Nu när du kan ta dig runt är det dags att skapa, kopiera, flytta och ta bort
saker.

## Skapa kataloger – `mkdir`

```sh
mkdir bilder2
```

Vill du skapa flera nivåer på en gång behövs `-p` (*parents*). Utan den klagar
`mkdir` om föräldrakatalogen inte finns:

```sh
mkdir -p resa/2026/juni
```

## Skapa tomma filer – `touch`

`touch` skapar en tom fil om den inte finns (och uppdaterar annars bara
tidsstämpeln):

```sh
touch inkopslista.txt
```

```quiz
Vad gör `touch anteckningar.txt` om filen redan finns?
- [ ] Den tömmer filen
- [ ] Den klagar på att filen finns
- [x] Den uppdaterar bara filens tidsstämpel – innehållet är oförändrat
```

## Kopiera – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

Om målet är en katalog hamnar kopian i den, med samma namn. För att kopiera en
hel katalog behövs `-r` (*recursive*):

```sh
cp -r dokument dokument-backup
```

```predict
$ mkdir kopior
$ cp anteckningar.txt kopior
$ ls kopior
anteckningar.txt
---
`kopior` är en katalog, så kopian hamnar i den med samma namn.
```

## Flytta och byta namn – `mv`

I Linux är *flytta* och *byta namn* samma sak. `mv` gör båda:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

```quiz
Det finns ingen fil som heter `b.txt`. Vad gör `mv a.txt b.txt`?
- [ ] Kopierar `a.txt` till `b.txt`
- [x] Byter namn på `a.txt` till `b.txt`
- [ ] Misslyckas, eftersom `b.txt` inte finns
---
Flytta och byta namn är samma sak. Efteråt finns bara `b.txt`.
```

## Ta bort – `rm` och `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` tar bort *tomma* kataloger. För att ta bort en katalog med innehåll
används `rm -r`:

```sh
rm -r dokument-backup
```

> **Varning!** Det finns ingen papperskorg i terminalen. Det du tar bort med
> `rm` är borta på riktigt. Kommandot `rm -rf` (*recursive, force*) frågar
> ingenting och klagar inte – dubbelkolla alltid sökvägen innan du trycker
> Enter.

```quiz
Vilket kommando tar bort katalogen `gammalt` *bara* om den är tom?
- [ ] `rm gammalt`
- [x] `rmdir gammalt`
- [ ] `rm -r gammalt`
---
`rmdir` vägrar ta bort en katalog som fortfarande har något i sig.
`rm -r` tar bort katalogen och allt som finns i den.
```

## Jokertecken

Skalet kan expandera mönster till flera filnamn innan kommandot körs:

| Mönster | Matchar |
|---|---|
| `*` | Vad som helst (noll eller fler tecken) |
| `?` | Exakt ett tecken |
| `[abc]` | Ett av tecknen a, b eller c |

Katalogen `dokument` i din hemkatalog innehåller tre filer: `betyg.csv`,
`frukter.txt` och `server.log`. Det här listar bara dem som slutar på `.txt`:

```sh
ls dokument/*.txt
```

Här ser `ls` aldrig stjärnan – skalet har redan bytt ut `dokument/*.txt` mot
alla matchande filnamn.

```predict
$ ls dokument/?????.*
dokument/betyg.csv
---
Varje `?` är exakt ett tecken, så namnet före punkten måste vara fem tecken
långt. Det är bara `betyg` – `frukter` och `server` är längre.
```

## Mellanslag i filnamn

Skalet delar upp kommandoraden vid mellanslag. Har en fil mellanslag i namnet
måste du använda citattecken (eller `\` före mellanslaget):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

Därför föredrar många att använda bindestreck eller understreck i filnamn.
