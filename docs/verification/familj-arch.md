# familj-arch – The Arch family: pacman and the AUR

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Arch Linux och t.ex. Manjaro och EndeavourOS hör till Arch-familjen och använder pacman och `.pkg.tar.zst` | | ogranskad | 2026-10-30 |
| pacman-kommandon: `-Sy`, `-Syu`, `-S`, `-R`, `-Ss`, `-Si`, `-Q` | | ogranskad | 2026-10-30 |
| Stor bokstav är operationen (`-S` sync, `-R` remove, `-Q` query), små bokstäver är modifierare (`y`, `u`, `s`, `i`) | | ogranskad | 2026-10-30 |
| `s` betyder sök med `-S`/`-Q` och ta bort beroenden med `-R` | | ogranskad | 2026-10-30 |
| `pacman -Ss` behöver inte root | | ogranskad | 2026-10-30 |
| `-Syu` synkroniserar, uppdaterar databasen och uppgraderar allt | | ogranskad | 2026-10-30 |
| `pacman -Sy` följt av `pacman -S paket` är en partiell uppgradering som kan förstöra systemet | | ogranskad | 2026-10-30 |
| `pacman -Rs` tar även bort beroenden som inget annat behöver | | ogranskad | 2026-10-30 |
| AUR (*Arch User Repository*) har byggrecept (`PKGBUILD`), inga färdiga paket; vem som helst kan ladda upp | | ogranskad | 2026-10-30 |
| `PKGBUILD` är ett litet bash-skript | | ogranskad | 2026-10-30 |
| Paketen i AUR granskas inte av Arch | | ogranskad | 2026-10-30 |
| `base-devel` innehåller bl.a. kompilator, `make` och `fakeroot` | | ogranskad | 2026-10-30 |
| `--needed` hoppar över det som redan är installerat | | ogranskad | 2026-10-30 |
| Varje AUR-paket är ett eget git-förråd; felstavat namn ger "You appear to have cloned an empty repository" | | ogranskad | 2026-10-30 |
| `makepkg` bygger en `.pkg.tar.zst`; `-s` installerar beroenden, `-i` installerar paketet med pacman | | ogranskad | 2026-10-30 |
| `makepkg` vägrar köras som root och använder sudo själv vid behov | | ogranskad | 2026-10-30 |
| Paket som inte kommer från förråden kallas *foreign* och listas med `pacman -Qm` | | ogranskad | 2026-10-30 |
| `pacman -Syu` uppdaterar inte AUR-paket | | ogranskad | 2026-10-30 |
| yay och paru är AUR-hjälpare; yay finns bara i AUR; `yay-bin` är förkompilerat | | ogranskad | 2026-10-30 |
| yay används utan sudo, och `yay -Syu` (eller bara `yay`) uppgraderar både förrådens paket och AUR-paket | | ogranskad | 2026-10-30 |
| `moonphase` och `snowfall` är påhittade AUR-paket i simulatorn | | ogranskad | 2026-10-30 |
