# Zusammenfassung: Weitere Werkzeuge

In diesem Teil hast du zwei Werkzeuge kennengelernt, die du für den Rest
deines Lebens im Terminal verwenden wirst: git, das die Geschichte deiner
Dateien aufbewahrt, und andere Shells als bash. Das solltest du dir vor der
Prüfung merken.

## Git im Terminal

**Git** ist ein Versionsverwaltungssystem: Es speichert Schnappschüsse des
ganzen Projekts, merkt sich, wer was warum geändert hat, und lässt dich in der
Zeit zurückgehen. Unter Ubuntu installierst du es mit `sudo apt install git`;
andere Distributionen verwenden ihren eigenen Paketmanager.

- Vor deinem ersten Commit sagst du git mit
  `git config --global user.name` und `user.email`, wer du bist. `--global`
  bedeutet alle deine Projekte; die Einstellungen landen in `~/.gitconfig`.
- `git init` macht ein Verzeichnis zu einem **Repository**. Die ganze
  Geschichte liegt im versteckten Verzeichnis `.git`.
- Eine Änderung durchläuft drei Orte: das **Arbeitsverzeichnis** (die Dateien,
  die du siehst), den **Index** (was in den nächsten Commit kommt) und die
  **Geschichte** (die Commits). `git add` bringt Änderungen in den Index,
  `git commit` speichert den Index als neuen Commit.
- `git commit -a` nimmt jede geänderte Datei auf, die git schon verfolgt –
  aber nie neue Dateien.
- `git diff` zeigt Änderungen, die noch nicht im Index sind;
  `git diff --staged` zeigt, was im Index ist.
- Ein **Branch** ist ein Etikett, das auf einen Commit zeigt und mit neuen
  Commits mitwandert. Wenn du den Branch wechselst, schreibt git das
  Arbeitsverzeichnis um.
- `git merge` holt einen Branch in den, auf dem du bist. Wenn beide Branches
  dieselben Zeilen geändert haben, bekommst du einen **Konflikt**: Repariere
  die Datei, mach `git add` darauf und schließe mit `git commit` ab.
- `.gitignore` listet Dateien auf, die git nicht verfolgen soll. Sie gilt nur
  für Dateien, die git nicht schon verfolgt.
- Ein **Remote** ist eine Kopie des Repositorys an einem anderen Ort, meist
  `origin` genannt. `git pull` holt und führt zusammen, `git push` schickt
  deine Commits.

| Befehl | Tut |
|---|---|
| `git config --global user.name "…"` | Git deinen Namen sagen (und `user.email`) |
| `git init` | Das Verzeichnis zu einem Repository machen |
| `git status` | Zeigen, wo jede Änderung ist |
| `git add FILE` / `git add .` | Änderungen in den Index legen |
| `git commit -m "…"` | Den Index als neuen Commit speichern |
| `git commit -am "…"` | Jede verfolgte Datei aufnehmen und in einem Schritt committen |
| `git diff` / `git diff --staged` | Änderungen zeigen, die nicht committet sind |
| `git log --oneline --graph --all` | Die Geschichte zeigen |
| `git restore FILE` | Änderungen in einer Datei verwerfen |
| `git restore --staged FILE` | Eine Datei aus dem Index nehmen |
| `git switch -c BRANCH` / `git switch BRANCH` | Einen Branch anlegen / den Branch wechseln |
| `git merge BRANCH` | Einen Branch in den aktuellen zusammenführen |
| `git branch -d BRANCH` | Einen zusammengeführten Branch löschen |
| `git rm --cached FILE` | Eine Datei nicht mehr verfolgen, aber auf der Festplatte behalten |
| `git clone`, `git pull`, `git push` | Über ein Remote zusammenarbeiten |

## Andere Shells: zsh und fish

Die **Shell** liest, was du tippst, und startet andere Programme. Programme
wie `ls` und `grep` funktionieren in jeder Shell gleich – was sich
unterscheidet, ist die Sprache drumherum: Variablen, Schleifen, Bedingungen
und der Prompt.

- `/etc/shells` listet die Shells auf, die Login-Shells sein dürfen. Deine
  Login-Shell ist das letzte Feld deiner Zeile in `/etc/passwd` und steht auch
  in `$SHELL`. `$0` enthält die Shell, die du gerade ausführst.
- **zsh** versteht fast die ganze bash-Syntax und bringt Annehmlichkeiten
  mit: `**/` durchsucht alle Unterverzeichnisse, und mit `autocd` wechselst du
  in ein Verzeichnis, indem du einfach seinen Namen tippst. Optionen werden
  mit `setopt` und `unsetopt` ein- und ausgeschaltet. Anders als bash teilt
  zsh Variablen ohne Anführungszeichen nicht an Leerzeichen auf.
- **fish** ist von Anfang an leicht zu bedienen, hat aber **eine eigene
  Syntax**: `set` statt `=`, `$status` statt `$?`, `math` statt `$((...))`,
  und jeder Block endet mit `end`. Jede Variable ist eine Liste, ab 1
  nummeriert.
- Eine gestartete Shell läuft **innerhalb** von bash; `exit` bringt dich
  zurück. Mit `-c` führt eine Shell einen Befehl aus und beendet sich.
- Skripte werden weiterhin für bash (oder POSIX-`sh`) geschrieben: Die
  `#!`-Zeile entscheidet, welche Shell ein Skript ausführt, egal in welcher
  Shell du sitzt.
- `chsh -s` ändert deine Login-Shell. Die Änderung wirkt beim nächsten
  Anmelden.

| Befehl | Tut |
|---|---|
| `cat /etc/shells` | Die Shells auflisten, die verwendet werden dürfen |
| `echo $0` / `ps` | Sehen, welche Shell du gerade ausführst |
| `echo $SHELL` | Deine Login-Shell sehen |
| `zsh` / `fish` / `exit` | Eine andere Shell starten / zurückgehen |
| `zsh -c '…'` / `fish -c '…'` | Einen Befehl in einer anderen Shell ausführen |
| `setopt autocd` / `unsetopt autocd` | Eine zsh-Option ein- / ausschalten |
| `set frukt äpple` / `set -e frukt` | Eine Variable in fish setzen / entfernen |
| `set -x NAME value` | Eine Umgebungsvariable in fish setzen |
| `math 17 x 23` | Rechnen in fish |
| `chsh -s /usr/bin/zsh` | Deine Login-Shell ändern |

Die Konfigurationsdateien: `~/.bashrc` (bash), `~/.zshrc` (zsh) und
`~/.config/fish/config.fish` (fish).
