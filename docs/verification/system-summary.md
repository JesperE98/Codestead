# Faktagranskning: system-summary (Summary: The system)

Status: **ogranskad**

Källtext: `src/Linux/content/chapters/en/system-summary.md`. Allt bygger på sub-kapitlen miljo,
rattigheter, processer och arkiv; påståendena granskas där och här kontrolleras att
sammanfattningen återger dem rätt.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `$NAMN` läser en variabel; `NAMN=värde` utan mellanslag skapar den | | ogranskad | |
| `export` gör den till miljövariabel som startade program kan läsa | | ogranskad | |
| Dubbla citattecken byter ut variabler, enkla skriver ut exakt | | ogranskad | |
| Kommandon letas upp i `PATH`; `$?` är senaste slutkoden, `0` = gick bra | | ogranskad | |
| Alias och variabler försvinner utan `~/.bashrc` | | ogranskad | |
| Ägare, grupp och tre grupper av rättigheter; r = 4, w = 2, x = 1; `755` och `600` | | ogranskad | |
| Skript behöver `x` och körs med `./` eftersom aktuell katalog inte är i `PATH` | | ogranskad | |
| `sudo` kör ett kommando som root och frågar efter det egna lösenordet; gruppen heter `sudo` på Ubuntu | | ogranskad | |
| Process har PID och PPID; `ps aux` visar alla, `top` live sorterat efter processor | | ogranskad | |
| `kill`: `SIGTERM` (15) standard, `SIGKILL` (9) sista utväg | | ogranskad | |
| `&`, `jobs`, `fg`, `bg` för jobb | | ogranskad | |
| `tar` samlar, `gzip` komprimerar en fil; tillsammans `.tar.gz` | | ogranskad | |
| Exakt en av `c`, `x`, `t`; `f` följs av arkivnamnet | | ogranskad | |
| `zcat` läser `.gz` utan uppackning; zip är lätt att dela med Windows och macOS | | ogranskad | |
| Kommandotabellen (alla rader) stämmer med sub-kapitlen | | ogranskad | |
