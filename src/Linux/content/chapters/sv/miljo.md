# Variabler, PATH och alias

Skalet har ett eget minne i form av **variabler**. Här lär du dig läsa och
sätta dem, förstå hur skalet hittar program och hur du gör egna kortkommandon.

## Miljövariabler

En variabel läses genom att sätta `$` framför namnet:

```sh
echo $HOME
echo "Jag heter $USER"
```

`env` listar alla *miljövariabler* – variabler som även program du startar
kan läsa:

```sh
env
```

Du skapar en variabel med `NAMN=värde` (inga mellanslag runt `=`!). Med
`export` blir den en miljövariabel:

```sh
export EDITOR=nano
```

```quiz
Vilken rad skapar variabeln `FARG` med värdet `blue`?
- [ ] `FARG = blue`
- [x] `FARG=blue`
- [ ] `$FARG=blue`
---
Det får inte finnas mellanslag runt `=`. Med mellanslag tror skalet att `FARG`
är ett kommando. `$` används bara när du *läser* en variabel.
```

## Enkla och dubbla citattecken

Det finns en viktig skillnad:

```sh
echo "Hemma: $HOME"
echo 'Hemma: $HOME'
```

Inom **dubbla** citattecken byts variabler ut mot sitt värde. Inom **enkla**
citattecken skrivs allt ut precis som det står.

```predict
$ x=linux
$ echo "I like $x"
$ echo 'I like $x'
I like linux
I like $x
```

## PATH – var hittas kommandon?

När du skriver `ls` letar skalet efter en fil som heter `ls` i katalogerna som
står i variabeln `PATH`, i tur och ordning:

```sh
echo $PATH
```

Ett klassiskt knep är att byta kolon mot radbrytning (`\n`), så att varje
katalog i `PATH` hamnar på en egen rad:

```sh
echo $PATH | tr ':' '\n'
```

`which` visar var ett program hittades. Vissa kommandon, som `cd`, är inga
filer utan *inbyggda* i skalet – `type` berättar vad ett namn är:

```sh
which ls
type cd
```

Om du vill köra ett program som inte ligger i `PATH` måste du ange sökvägen,
till exempel `./mittprogram` för en fil i katalogen du står i.

```quiz
Du har ett program som heter `hej` i katalogen du står i, och den katalogen
finns inte i `PATH`. Hur kör du det?
- [ ] `hej`
- [x] `./hej`
- [ ] `type hej`
---
Utan sökväg letar skalet bara i katalogerna i `PATH`. `./hej` säger exakt var
filen finns: i katalogen du står i.
```

## Slutkoder – `$?`

Varje kommando lämnar en **slutkod** (*exit code*) när det är klart: `0` betyder
att allt gick bra, allt annat betyder fel. Den senaste slutkoden finns i `$?`:

```sh
ls /{{missing}}
echo $?
```

Det är slutkoden som `&&` och `||` tittar på.

## Alias

Ett **alias** är ett eget kortkommando:

```sh
alias ll='ls -la'
ll
```

`alias` utan argument listar alla alias och `unalias ll` tar bort ett.

```predict
$ alias hej='echo Hello'
$ hej
Hello
```

## Spara inställningar – `~/.bashrc`

Variabler och alias som du skapar försvinner när du stänger terminalen. För
att de ska finnas kvar lägger man dem i filen `~/.bashrc`, som bash läser
varje gång en ny terminal öppnas. Efter att du ändrat filen kan du läsa in den
direkt med:

```sh
source ~/.bashrc
```

```quiz
Du skapar ett alias, stänger terminalen och öppnar en ny. Aliaset är borta.
Vad borde du ha gjort?
- [ ] Kört `alias` utan argument
- [x] Lagt aliaset i `~/.bashrc`
- [ ] Skapat det med `export`
---
Allt du lägger i `~/.bashrc` läses in igen varje gång en ny terminal öppnas.
```
