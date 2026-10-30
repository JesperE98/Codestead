# Faktagranskning: verktyg-exam (Prov: Fler verktyg)

Status: **ogranskad**

Provet har 14 frågor (10 quiz, 3 predict, 1 try). Svaren bygger på [git](git.md) och [skal](skal.md);
predict-svaren kontrolleras mot simulatorn av testet `PredictionsMatchTheSimulator`.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Fråga 1: `git commit -am` tar med ändringen i en fil som git följer men inte en ny fil | | ogranskad | 2026-10-30 |
| Fråga 2: efter `git add` visar `git diff` inte ändringen, men `git diff --staged` gör det | | ogranskad | 2026-10-30 |
| Fråga 3: en fast-forward-sammanslagning skapar ingen merge-commit (`git log --oneline \| wc -l` ger 2) | | ogranskad | 2026-10-30 |
| Fråga 4: en gren är en etikett som pekar på en commit och flyttas med nya commits | | ogranskad | 2026-10-30 |
| Fråga 5: efter en rättad konflikt kör man `git add FIL` och `git commit`; `git restore` skulle slänga rättelsen | | ogranskad | 2026-10-30 |
| Fråga 6: `.gitignore` gäller inte en fil som redan committats; `git rm --cached` tar bort den ur repot men inte från disken | | ogranskad | 2026-10-30 |
| Fråga 7: `git fetch` hämtar utan att slå ihop, `git pull` hämtar och slår ihop | | ogranskad | 2026-10-30 |
| Fråga 8: ocommittade ändringar som slängs med `git restore` eller `git reset --hard` går förlorade; committade kan räddas med `git reflog` | | ogranskad | 2026-10-30 |
| Fråga 9: `$0` visar skalet man kör, `$SHELL` inloggningsskalet | | ogranskad | 2026-10-30 |
| Fråga 10: `math 10 / 4` i fish ger `2.5` (math klarar decimaler) | | ogranskad | 2026-10-30 |
| Fråga 11: `$status` är slutstatus för senaste kommandot i fish; `false` ger 1 | | ogranskad | 2026-10-30 |
| Fråga 12: `set -x` exporterar en variabel i fish, `set -e` tar bort den | | ogranskad | 2026-10-30 |
| Fråga 13: zsh läser `~/.zshrc` när det startar | | ogranskad | 2026-10-30 |
| Fråga 14: sista fältet i raden i `/etc/passwd` är inloggningsskalet, det som `chsh -s` ändrar | | ogranskad | 2026-10-30 |
| Provet kräver 80 % rätt (enligt docs/DEVELOPMENT.md) | | ogranskad | 2026-10-30 |
