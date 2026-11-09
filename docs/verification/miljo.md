# Faktagranskning: miljo (Variables, PATH and aliases)

Status: **ogranskad**

Källtext: `src/Linux/content/chapters/en/miljo.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| En variabel läses genom att sätta `$` framför namnet (`echo $HOME`) | | ogranskad | |
| `env` listar alla miljövariabler | | ogranskad | |
| Miljövariabler kan även läsas av program som skalet startar | | ogranskad | |
| En variabel skapas med `NAMN=värde`, utan mellanslag runt `=` | | ogranskad | |
| Med mellanslag runt `=` tolkar skalet namnet som ett kommando | | ogranskad | |
| `export` gör en variabel till miljövariabel | | ogranskad | |
| Inom dubbla citattecken byts variabler ut mot sitt värde | | ogranskad | |
| Inom enkla citattecken skrivs allt ut precis som det står | | ogranskad | |
| Skalet letar efter kommandon i katalogerna i `PATH`, i tur och ordning | | ogranskad | |
| `which` visar var ett program hittades (`which ls` → `/usr/bin/ls` på Ubuntu) | | ogranskad | |
| `cd` är inbyggt i skalet och ingen fil | | ogranskad | |
| `type` berättar vad ett namn är (t.ex. inbyggt kommando) | | ogranskad | |
| Ett program utanför `PATH` körs med sökväg, t.ex. `./mittprogram` | | ogranskad | |
| Varje kommando lämnar en slutkod; `0` betyder att det gick bra, allt annat fel | | ogranskad | |
| Den senaste slutkoden finns i `$?` | | ogranskad | |
| `&&` och `\|\|` tittar på slutkoden | | ogranskad | |
| `alias namn='kommando'` skapar ett alias | | ogranskad | |
| `alias` utan argument listar alla alias, `unalias` tar bort ett | | ogranskad | |
| Variabler och alias försvinner när terminalen stängs | | ogranskad | |
| bash läser `~/.bashrc` varje gång en ny terminal öppnas | | ogranskad | |
| `source ~/.bashrc` läser in filen direkt | | ogranskad | |
| `echo $PATH \| tr ':' '\n'` shows each directory in `PATH` on a line of its own | | ogranskad | |
