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

## Kopiera – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

Om målet är en katalog hamnar kopian i den, med samma namn. För att kopiera en
hel katalog behövs `-r` (*recursive*):

```sh
cp -r dokument dokument-backup
```

## Flytta och byta namn – `mv`

I Linux är *flytta* och *byta namn* samma sak. `mv` gör båda:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
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

## Jokertecken

Skalet kan expandera mönster till flera filnamn innan kommandot körs:

| Mönster | Matchar |
|---|---|
| `*` | Vad som helst (noll eller fler tecken) |
| `?` | Exakt ett tecken |
| `[abc]` | Ett av tecknen a, b eller c |

```sh
ls dokument/*.txt
```

Här ser `ls` aldrig stjärnan – skalet har redan bytt ut `dokument/*.txt` mot
alla matchande filnamn.

## Mellanslag i filnamn

Skalet delar upp kommandoraden vid mellanslag. Har en fil mellanslag i namnet
måste du använda citattecken (eller `\` före mellanslaget):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

Därför föredrar många att använda bindestreck eller understreck i filnamn.
