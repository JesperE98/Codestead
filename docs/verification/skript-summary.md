# Faktagranskning: skript-summary (Summary: Scripts and automation)

Status: **ogranskad**

Källtext: `src/Linux/content/chapters/en/skript-summary.md`. Allt bygger på sub-kapitlet skript;
här kontrolleras att sammanfattningen återger det rätt.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Ett skript börjar med shebang `#!/bin/bash`, görs körbart med `chmod +x` och körs med `./` | | ogranskad | |
| Here-dokument `cat > fil << 'SLUT'` skriver rader till filen fram till raden `SLUT` | | ogranskad | |
| `#` inleder kommentarer | | ogranskad | |
| `namn=värde` utan mellanslag; `"$namn"` och `"${namn}_text"` | | ogranskad | |
| `$(kommando)` byts mot utskriften; `$(( ))` räknar med heltal | | ogranskad | |
| Argument i `$1`, `$2` …, `$#` och `"$@"` | | ogranskad | |
| `if` tittar på slutkoden, oftast från `[ ]` | | ogranskad | |
| Tal jämförs med `-eq`, `-lt` m.fl., text med `=` och `!=` | | ogranskad | |
| `for`, `while`, `while read`, `break`, `continue` | | ogranskad | |
| `case`, funktioner med egna `$1`, `local`, `return` | | ogranskad | |
| `read -p` läser en rad från tangentbordet | | ogranskad | |
| `exit 1` signalerar fel till den som anropade | | ogranskad | |
| `set -euo pipefail` stoppar skriptet vid första fel | | ogranskad | |
| Syntaxtabellen (alla rader) stämmer med sub-kapitlet | | ogranskad | |
