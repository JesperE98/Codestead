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

## Enkla och dubbla citattecken

Det finns en viktig skillnad:

```sh
echo "Hemma: $HOME"
echo 'Hemma: $HOME'
```

Inom **dubbla** citattecken byts variabler ut mot sitt värde. Inom **enkla**
citattecken skrivs allt ut precis som det står.

## PATH – var hittas kommandon?

När du skriver `ls` letar skalet efter en fil som heter `ls` i katalogerna som
står i variabeln `PATH`, i tur och ordning:

```sh
echo $PATH
```

`which` visar var ett program hittades. Vissa kommandon, som `cd`, är inga
filer utan *inbyggda* i skalet – `type` berättar vad ett namn är:

```sh
which ls
type cd
```

Om du vill köra ett program som inte ligger i `PATH` måste du ange sökvägen,
till exempel `./mittprogram` för en fil i katalogen du står i.

## Slutkoder – `$?`

Varje kommando lämnar en **slutkod** (*exit code*) när det är klart: `0` betyder
att allt gick bra, allt annat betyder fel. Den senaste slutkoden finns i `$?`:

```sh
ls /finnsinte
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

## Spara inställningar – `~/.bashrc`

Variabler och alias som du skapar försvinner när du stänger terminalen. För
att de ska finnas kvar lägger man dem i filen `~/.bashrc`, som bash läser
varje gång en ny terminal öppnas. Efter att du ändrat filen kan du läsa in den
direkt med:

```sh
source ~/.bashrc
```
