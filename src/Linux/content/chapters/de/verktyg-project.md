# Projekt: Deine Dotfiles einpacken

Große Neuigkeiten: Nächste Woche bekommst du einen nagelneuen Computer. Schön – nur
bleibt alles, was du auf diesem eingerichtet hast, zurück. Deine Aliase, dein Name
in git, all die kleinen Anpassungen. Sie wohnen in kleinen versteckten Dateien in
deinem Home-Verzeichnis, Dateien, deren Name mit einem Punkt beginnt. Deshalb heißen
sie *Dotfiles*, und Programmiererinnen und Programmierer auf der ganzen Welt
bewahren ihre in einem git-Repository auf: Auf einem neuen Computer klonen sie es,
und eine Minute später fühlen sie sich zu Hause.

Zeit, deine einzupacken. Alles, was du brauchst, steht in *Weitere Werkzeuge* – git
und das, was du über Shells und ihre Einstellungsdateien gelernt hast. Die
Herausforderung ist, es selbst zusammenzusetzen.

## Der Auftrag

1. **Besorg dir einen Umzugskarton.** Lege das Verzeichnis `~/{{dotfilesDir}}` an
   und mach es zu einem git-Repository.
2. **Pack ein, was du hast.** Kopiere deine bash-Einstellungen `~/.bashrc` und deine
   git-Einstellungen `~/.gitconfig` ins Repository. Ob du den Punkt im Namen behältst
   oder weglässt, ist egal – beides ist üblich.
3. **Leg etwas Eigenes dazu.** Schreib die Datei `{{aliasFile}}` im Repository, mit
   mindestens zwei Aliasen, die dir nützlich wären.
4. **Kleb den Karton zu.** Mach einen Commit, der beide Kopien und `{{aliasFile}}`
   enthält.
5. **Halt das Geheimnis draußen.** Dein WLAN-Passwort soll in
   `~/{{dotfilesDir}}/{{secretFile}}` liegen – aber es darf nie in der Historie
   landen. Dotfiles-Repositorys sind oft öffentlich! Lege die Datei an, sorg dafür,
   dass git sie ignoriert, und committe, was dafür nötig ist.
6. **Experimentier auf einem Branch.** Lege den Branch `{{aliasBranch}}` an, füge
   `{{aliasFile}}` mindestens einen weiteren Alias hinzu und committe ihn auf dem
   Branch.
7. **Auspacken und benutzen.** Die neuen Aliase funktionieren, also führe
   `{{aliasBranch}}` mit dem Hauptbranch zusammen. Lies dann `{{aliasFile}}` mit
   `source` in deine Shell ein und führe einen deiner Aliase aus.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du
deine Befehle ausführst.

## Tipps für unterwegs

- `ls -a` zeigt die versteckten Dateien – die, deren Name mit einem Punkt beginnt.
- Führe oft `git status` aus. Es sagt dir, was neu ist, was sich geändert hat und
  was in den nächsten Commit kommt.
- Ein Alias wird `alias ll='ls -la'` geschrieben, ohne Leerzeichen um das `=`. Um
  die Zeile mit `echo` zu schreiben, setzt du außen doppelte und innen einfache
  Anführungszeichen.
- Sagt git *Please tell me who you are*? Dann stell zuerst `user.name` und
  `user.email` mit `git config --global` ein.
- `.gitignore` gilt nur für Dateien, die git noch nicht verfolgt. Hast du das
  Passwort aus Versehen committet? `git rm --cached` nimmt es aus dem Repository,
  lässt es aber auf der Platte. Der alte Commit enthält es trotzdem noch – im echten
  Leben würdest du das Passwort ändern.
- `source` liest die Datei in die Shell ein, in der du gerade bist. zsh versteht
  dieselben Alias-Zeilen wie bash, die Datei funktioniert also in beiden.

## Lust auf mehr?

Wenn die Etappen geschafft sind, gibt es noch mehr einzupacken. Füge die Zeile
`source ~/{{dotfilesDir}}/{{aliasFile}}` am Ende von `~/.bashrc` hinzu, damit jedes
neue Terminal deine Aliase bekommt. Kopiere auch `~/.zshrc` oder die fish-Datei
`~/.config/fish/config.fish`, falls du sie hast. Und spiel den neuen Computer:
`git clone ~/{{dotfilesDir}} ~/neuer-computer` – ist alles da? Und fehlt
`{{secretFile}}` wirklich? Bewundere zum Schluss dein Werk mit
`git log --oneline --graph --all`.
