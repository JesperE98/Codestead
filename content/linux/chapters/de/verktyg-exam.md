# Prüfung: Weitere Werkzeuge

Vierzehn Fragen zu git und anderen Shells. Zum Bestehen brauchst du 80 %
richtige Antworten. Die Fragen mit Befehlen beginnen in einem frischen
Terminal, deshalb installieren sie zuerst das Programm, das sie brauchen –
`> /dev/null 2>&1` wirft die Ausgabe dieser Zeilen weg.

```quiz
Du hast `index.html` geändert und die neue Datei `kontakt.html` angelegt. Du
führst `git commit -am "Kontaktseite"` aus. Was landet im Commit?
- [x] Nur die Änderung an `index.html`
- [ ] Nur `kontakt.html`
- [ ] Beide Dateien
---
`-a` nimmt jede geänderte Datei auf, die git schon verfolgt – aber nie neue
Dateien. `kontakt.html` muss zuerst mit `git add` hinzugefügt werden.
```

```quiz
Du hast `git add` auf eine Änderung in `style.css` ausgeführt. Welcher
Befehl zeigt diese Änderung?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` vergleicht das Arbeitsverzeichnis mit dem Index, zeigt also nichts
mehr, sobald die Änderung im Index ist. `--staged` zeigt, was darauf wartet,
committet zu werden.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge {{newDesign}} > /dev/null
$ git log --oneline | wc -l
2
---
`main` hatte sich seit dem Anlegen des Branches nicht geändert, also war der
Merge ein *Fast-Forward*: git hat `main` nur auf den Commit von `{{newDesign}}`
vorgeschoben. Es wurde kein Merge-Commit angelegt.
```

```quiz
Was ist ein Branch in git, technisch gesehen?
- [ ] Eine vollständige Kopie jeder Datei im Projekt
- [x] Ein Etikett, das auf einen Commit zeigt und mitwandert, wenn du neue Commits machst
- [ ] Ein eigenes Repository mit einem eigenen `.git`-Verzeichnis
---
Deshalb sind Branches in git billig – verwende sie oft.
```

```quiz
`git merge` hat mit einem Konflikt in `index.html` angehalten. Du hast die
Datei repariert und die Markierungszeilen entfernt. Was tust du als Nächstes?
- [ ] `git merge` noch einmal ausführen
- [x] `git add index.html` und danach `git commit`
- [ ] `git restore index.html`
---
`git add` sagt git, dass der Konflikt gelöst ist, und `git commit` schließt
den Merge ab. `git restore` würde deine Reparatur wegwerfen.
```

```quiz
Die Datei `fehler.log` wurde versehentlich committet. Du fügst `*.log` zu
`.gitignore` hinzu, aber git verfolgt die Datei immer noch. Wie entfernst du
sie aus dem Repository, behältst sie aber auf der Festplatte?
- [ ] `rm fehler.log`
- [x] `git rm --cached fehler.log`
- [ ] `git restore fehler.log`
---
`.gitignore` gilt nur für Dateien, die git nicht schon verfolgt. `--cached`
entfernt die Datei aus git, lässt sie aber auf der Festplatte.
```

```quiz
Welcher Befehl holt neue Commits vom Remote, **ohne** sie mit deinen
zusammenzuführen?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` holt und führt zusammen; `git fetch` holt nur.
```

```quiz
Welche dieser Änderungen sind endgültig verloren? Wähle alle passenden aus.
- [x] Änderungen in einer Datei, die nie committet wurden, mit `git restore` verworfen
- [x] Änderungen, die nie committet wurden, mit `git reset --hard` verworfen
- [ ] Ein Commit, den du gestern gemacht hast, bevor du `git reset --hard` ausgeführt hast
---
Alles, was irgendwann committet wurde, lässt sich fast immer retten –
`git reflog` zeigt, wo du gewesen bist.
```

```quiz
Du hast zsh aus bash heraus gestartet. Welcher Befehl zeigt die Shell, die du
gerade ausführst?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` ist deine Login-Shell – immer noch `/bin/bash`. `/etc/shells` listet
die Shells auf, die als Login-Shells verwendet werden dürfen.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` kann mit Dezimalzahlen umgehen.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
In fish heißt der Exit-Status des letzten Befehls `$status` – `false` schlägt
immer fehl.
```

```quiz
Wie machst du in fish `EDITOR` zu einer Umgebungsvariablen mit dem Wert `nano`?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` exportiert die Variable; `-e` löscht sie.
```

```quiz
Welche Datei liest zsh, wenn es startet?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep {{user}} /etc/passwd
---
Das letzte Feld der Zeile ist deine Login-Shell – die, die `chsh -s` ändert.
```
