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
Vad gör `touch {{notes}}` om filen redan finns?
- [ ] Den tömmer filen
- [ ] Den klagar på att filen finns
- [x] Den uppdaterar bara filens tidsstämpel – innehållet är oförändrat
```

## Kopiera – `cp`

```sh
cp {{notes}} anteckningar-kopia.txt
```

Om målet är en katalog hamnar kopian i den, med samma namn. För att kopiera en
hel katalog behövs `-r` (*recursive*):

```sh
cp -r {{documents}} {{documents}}-backup
```

```predict
$ mkdir kopior
$ cp {{notes}} kopior
$ ls kopior
{{notes}}
---
`kopior` är en katalog, så kopian hamnar i den med samma namn.
```

## Flytta och byta namn – `mv`

I Linux är *flytta* och *byta namn* samma sak. `mv` gör båda:

```sh
mv inkopslista.txt {{documents}}/
mv {{documents}}/inkopslista.txt {{documents}}/handla.txt
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
rm -r {{documents}}-backup
```

> **Varning!** Det finns ingen papperskorg i terminalen. Det du tar bort med
> `rm` är borta på riktigt. Kommandot `rm -rf` (*recursive, force*) frågar
> ingenting och klagar inte – dubbelkolla alltid sökvägen innan du trycker
> Enter.

```quiz
Vilket kommando tar bort katalogen `{{old}}` *bara* om den är tom?
- [ ] `rm {{old}}`
- [x] `rmdir {{old}}`
- [ ] `rm -r {{old}}`
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

Katalogen `{{documents}}` i din hemkatalog innehåller tre filer: `{{grades}}`,
`{{fruits}}` och `server.log`. Det här listar bara dem som slutar på `.txt`:

```sh
ls {{documents}}/*.txt
```

Här ser `ls` aldrig stjärnan – skalet har redan bytt ut `{{documents}}/*.txt` mot
alla matchande filnamn.

```predict
$ ls {{documents}}/?????.*
{{documents}}/{{grades}}
---
Varje `?` är exakt ett tecken, så namnet före punkten måste vara fem tecken
långt. Det gäller bara `{{grades}}` – `{{fruits}}` och `server.log` har längre namn.
```

## Mellanslag i filnamn

Skalet delar upp kommandoraden vid mellanslag. Har en fil mellanslag i namnet
måste du använda citattecken (eller `\` före mellanslaget):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

Därför föredrar många att använda bindestreck eller understreck i filnamn.
