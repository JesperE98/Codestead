# Prov: Skript och automatisering

Svara på frågorna om shell-skript – du behöver 80 % för godkänt.

```quiz
Vad gör den första raden `#!/bin/bash` i ett skript?
- [ ] Det är en kommentar som skalet hoppar över
- [x] Den talar om för systemet vilket program som ska köra filen
- [ ] Den gör filen körbar
---
Den kallas *shebang*. Du behöver fortfarande `chmod +x` för att göra filen
körbar.
```

```quiz
`namn = Kim` ger felet `command not found`. Varför?
- [x] Mellanslagen runt `=` gör att skalet tolkar `namn` som ett kommando
- [ ] Variabelnamn måste skrivas med versaler
- [ ] Du måste skriva `$namn = Kim`
```

```predict
$ antal=$(ls ~/dokument | wc -l)
$ echo "$antal files"
3 files
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
Vad innehåller `"$@"` i ett skript?
- [ ] Antalet argument
- [ ] Skriptets namn
- [x] Alla argument, vart och ett för sig
```

```quiz
Vilket test är sant när talet i `n` är större än 10?
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
Tal jämförs med `-eq`, `-lt`, `-gt` och så vidare; `=` och `<` jämför text.
```

```predict
$ [ -d ~/finnsinte ] && echo yes || echo no
no
```

```predict
$ fil=rapport.txt
$ case $fil in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` hoppar direkt till nästa varv, så `3` skrivs aldrig ut.
```

```quiz
Vad gör `local` i en funktion?
- [x] Skapar en variabel som bara finns inuti funktionen
- [ ] Gör att funktionen går fortare
- [ ] Avslutar funktionen med en slutkod
```

```quiz
Varför avslutas ett skript med `exit 1` när något går fel?
- [ ] För att starta om skriptet
- [x] Så att den som anropade skriptet kan se på slutkoden att det misslyckades
- [ ] För att skriva ut talet 1
```

```quiz
Du startar ett here-dokument med `cat > hej.sh << 'SLUT'`. När tar det slut?
- [ ] När du trycker Enter på en tom rad
- [x] Vid raden `SLUT`
- [ ] Efter tio rader
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```
