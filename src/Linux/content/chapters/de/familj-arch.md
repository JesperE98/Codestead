# Die Arch-Familie: pacman und das AUR

Arch Linux und darauf aufbauende Distributionen wie Manjaro und EndeavourOS
bilden die **Arch-Familie**. Sie verwenden den Paketmanager **pacman** und
Pakete im Format `.pkg.tar.zst`. Dieses Kapitel läuft immer auf einer
Distribution aus der Arch-Familie – gerade ist es **{{distro}}**.

## pacman in Kürze

| Was | Befehl |
|---|---|
| Paketliste aktualisieren | `pacman -Sy` |
| Alles aktualisieren | `pacman -Syu` |
| Installieren | `pacman -S X` |
| Entfernen | `pacman -R X` |
| Suchen | `pacman -Ss X` |
| Paketinfo | `pacman -Si X` |
| Installierte auflisten | `pacman -Q` |

Befehle, die das System verändern, brauchen root-Rechte und werden deshalb mit
`sudo` ausgeführt.

pacman verwendet kurze Optionen, bei denen der **Großbuchstabe** die Operation
ist und die Kleinbuchstaben Modifikatoren sind:

| Option | Bedeutet |
|---|---|
| `-S` | Sync – aus den Repositorys installieren |
| `-R` | Remove – entfernen |
| `-Q` | Query – installierte Pakete abfragen |
| `y` | Die Paketdatenbank aktualisieren |
| `u` | Alle Pakete aktualisieren |
| `s` | Suchen (mit -S und -Q) oder Abhängigkeiten entfernen (mit -R) |
| `i` | Info |

```quiz
Was bedeutet das große `Q` in `pacman -Q`?
- [ ] Quit – pacman beenden
- [x] Query – installierte Pakete abfragen
- [ ] Quick – ohne Nachfrage installieren
---
`-Q` fragt ab, was installiert ist, `-S` installiert aus den Repositorys und
`-R` entfernt.
```

Suchen braucht kein root. Probier es aus:

```try
pacman -Ss htop
```

## Das System aktualisieren

```sh
sudo pacman -Syu
```

`-Syu` bedeutet: synchronisieren (`S`), die Datenbank aktualisieren (`y`) und
alles aktualisieren (`u`). Arch ist ein *Rolling Release*, also wirst du das
oft ausführen.

> **Wichtig!** Führe nie nur `pacman -Sy` und danach `pacman -S package` aus.
> Das neue Paket braucht dann womöglich neuere Bibliotheken als die, die du
> hast – ein sogenanntes *Partial Upgrade*, das dein System kaputtmachen kann.
> Nimm immer `-Syu`.

```quiz
Warum solltest du nicht `pacman -Sy` und danach `pacman -S package` ausführen?
- [ ] Weil `-Sy` die Paketdatenbank löscht
- [x] Das neue Paket braucht vielleicht neuere Bibliotheken, als du hast, und das kann das System kaputtmachen
- [ ] Weil pacman nur ein Paket pro Tag installieren kann
---
Aktualisiere immer alles auf einmal mit `-Syu`.
```

## Installieren und entfernen

```sh
sudo pacman -S htop
```

`pacman -R package` entfernt ein Paket, und `pacman -Rs package` entfernt
zusätzlich Abhängigkeiten, die sonst nichts mehr braucht.

## Das AUR

Die Repositorys der Distribution enthalten Zehntausende von Paketen – aber
nicht alles. Ein Nischenprogramm fehlt vielleicht ganz oder ist nur in einer
alten Version vorhanden. In der Arch-Familie ist die Antwort darauf das
**AUR** (*Arch User Repository*).

Das AUR ist anders als gewöhnliche Repositorys: Es gibt dort keine fertigen
Pakete, sondern nur **Baurezepte**. Ein Rezept heißt `PKGBUILD` und ist ein
kleines bash-Skript, das angibt, wo der Quellcode liegt und wie das Programm
gebaut wird. Du lädst das Rezept herunter, baust das Paket selbst und
installierst es mit pacman. Das AUR ist riesig – fast alles, was es für Linux
gibt, findet sich dort –, aber jeder kann ein Rezept hochladen.

```quiz
Was lädst du aus dem AUR herunter?
- [ ] Ein fertiges `.pkg.tar.zst`-Paket, von Arch geprüft
- [x] Ein Baurezept (`PKGBUILD`), aus dem du das Paket selbst baust
- [ ] Ein Flatpak
```

### Auf eigene Gefahr

Die Pakete in den eigenen Repositorys der Distribution werden gemeinsam
getestet, signiert und von den Entwicklern der Distribution geprüft. Die
Pakete im AUR werden nicht von Arch geprüft. Behalte das im Hinterkopf:

- **Pakete werden als root installiert.** Ein Paket kann mit dem Rechner
  alles Mögliche anstellen. Du vertraust demjenigen, der das Rezept
  geschrieben hat, genauso sehr wie der Distribution.
- **Es kann zu Konflikten kommen.** Ein Paket kann die eigenen Bibliotheken
  des Systems ersetzen oder andere Versionen brauchen als die, die du hast.
- **Es kann aufhören, aktualisiert zu werden.** Wenn die Person, die das
  Rezept pflegt, die Lust verliert, bekommst du keine Sicherheitsupdates mehr
  für das Programm.

Eine gute Faustregel: Schau zuerst in den Repositorys der Distribution nach,
dann nach einem Flatpak (im Kapitel über universelle Pakete) und erst danach
im AUR.

Im Rest dieses Kapitels installierst du ein ausgedachtes Programm,
`moonphase` (es zeigt die Mondphase im Terminal an), aus dem AUR.

### Vorbereitungen

Um Rezepte herunterzuladen und Pakete zu bauen, brauchst du `git` und
`base-devel` (einen Compiler, `make`, `fakeroot` und mehr):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` überspringt, was schon installiert ist.

### Das Rezept holen

Jedes AUR-Paket ist ein eigenes git-Repository:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Wenn du dich beim Paketnamen vertippst, sagt git *„You appear to have cloned
> an empty repository“*, und das Verzeichnis ist leer. Das AUR lässt dich
> alles klonen!

### Lies das PKGBUILD – jedes Mal

```sh
less PKGBUILD
```

`PKGBUILD` ist ein Skript, das auf deinem Rechner läuft. Prüfe mindestens,

- dass `source=` von der echten Website des Programms herunterlädt,
- dass `build()` und `package()` nur bauen und Dateien kopieren – und nicht
  zum Beispiel etwas anderes herunterladen und ausführen (`curl … | sh`),
- dass das Paket gepflegt aussieht (Datumsangaben, Kommentare auf
  aur.archlinux.org).

### Bauen und installieren

```sh
makepkg -si
```

`makepkg` liest `PKGBUILD`, lädt den Quellcode herunter, baut ihn und packt
eine `.pkg.tar.zst`-Datei. `-s` installiert fehlende Abhängigkeiten, und `-i`
installiert das Paket mit pacman, wenn es fertig ist. Führe makepkg **nicht**
mit sudo aus – es weigert sich, als root zu laufen, und verwendet sudo von
selbst, wenn es nötig ist.

```sh
ls
moonphase
```

### „Fremde“ Pakete

pacman weiß nichts vom AUR. Pakete, die nicht aus den Repositorys stammen,
heißen *foreign* (fremd) und werden so aufgelistet:

```sh
pacman -Qm
```

Das bedeutet auch, dass `sudo pacman -Syu` AUR-Pakete **nicht** aktualisiert.
Du musst das neue Rezept selbst holen (`git pull`) und neu bauen – oder das
einem AUR-Helper überlassen.

```quiz
Du hast `moonphase` aus dem AUR installiert und führst `sudo pacman -Syu` aus.
Wird `moonphase` aktualisiert?
- [ ] Ja – pacman aktualisiert jedes installierte Paket
- [x] Nein – pacman weiß nichts vom AUR
---
Hol das neue Rezept mit `git pull` und bau neu, oder nimm einen AUR-Helper.
```

### Der AUR-Helper yay

Ein AUR-Helper erledigt all das für dich: Er sucht, lädt herunter, zeigt das
`PKGBUILD`, baut und installiert. Der verbreitetste ist **yay** (ein anderer
ist *paru*). yay selbst gibt es nur im AUR, deshalb wird er einmal von Hand
installiert. Das Paket `yay-bin` ist vorkompiliert und am schnellsten:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Danach wird yay ganz ähnlich wie pacman verwendet – aber ohne sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (oder einfach `yay`) aktualisiert sowohl die Pakete aus den
Repositorys als auch deine AUR-Pakete. Bequemlichkeit heißt aber nicht, dass
du aufhören darfst, die Rezepte zu lesen!

Beim AUR gibt es kein Repository zum Entfernen – jedes Paket ist ein eigenes
Rezept. Räum auf, was du nicht mehr brauchst.
