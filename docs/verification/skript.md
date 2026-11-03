# Faktagranskning: skript (Shell scripts)

Status: **ogranskad**

Källtext: `src/Linux/content/chapters/en/skript.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Ett here-dokument skickar allt mellan `<< 'SLUT'` och raden `SLUT` till kommandot; ordet är valfritt (`EOF` vanligt) | | ogranskad | |
| Prompten byts till `> ` medan skalet väntar på resten | | ogranskad | |
| `#!/bin/bash` (shebang) talar om vilket program som kör filen | | ogranskad | |
| Rader som börjar med `#` är kommentarer | | ogranskad | |
| Variabler skapas med `namn=värde`, utan mellanslag runt `=` | | ogranskad | |
| Utan citattecken delas ett värde upp vid mellanslag | | ogranskad | |
| `"${stad}_2026"` behövs; `"$stad_2026"` läser variabeln `stad_2026` | | ogranskad | |
| `$(kommando)` byts ut mot det kommandot skriver ut | | ogranskad | |
| Bash räknar med heltal i `$(( ))`; `$` behövs inte framför variabler där | | ogranskad | |
| `7 / 2` blir `3` och `7 % 2` blir `1` (heltalsdivision och rest) | | ogranskad | |
| `(( a++ ))` och `(( a += 10 ))` ändrar en variabel | | ogranskad | |
| `$0`, `$1` …, `$#`, `"$@"`, `$?` och deras innehåll; `$#` räknar inte `$0` | | ogranskad | |
| `if` tittar på slutkoden: 0 sant, annat falskt | | ogranskad | |
| `[` är ett kommando som också heter `test`; mellanslagen innanför är obligatoriska | | ogranskad | |
| Testen `-f`, `-d`, `-z`, `=`, `!=`, `-eq`, `-lt`, `-le`, `-gt`, `-ge`, `-ne`, `!` | | ogranskad | |
| Tal jämförs med `-eq` m.fl., text med `=` och `<` | | ogranskad | |
| `[[ ... ]]` tillåter `&&`, `\|\|` och mönster som `[[ $file == *.txt ]]` | | ogranskad | |
| `for`, `while` och `while read ... done < fil` | | ogranskad | |
| `break` lämnar en loop, `continue` hoppar till nästa varv | | ogranskad | |
| En oändlig loop stoppas med Ctrl+C | | ogranskad | |
| Simulatorn avbryter själv en loop efter 20 000 steg | | ogranskad | |
| `case`: varje alternativ slutar med `;;`, `*)` fångar allt annat | | ogranskad | |
| Funktioner får argument som `$1`, `$2`, `$#`; `local` och `return` | | ogranskad | |
| `read` läser en rad från tangentbordet; `-p` visar en fråga | | ogranskad | |
| `exit 1` avslutar skriptet med slutkoden 1 | | ogranskad | |
| `>&2` skickar utskrift till standard error (backup-exemplet) | | ogranskad | |
| `set -euo pipefail` gör att skriptet avbryts vid första fel | | ogranskad | |
| ShellCheck hittar vanliga misstag och finns i pakethanteraren i alla stora distributioner | | ogranskad | |
