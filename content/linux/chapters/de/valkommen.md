# Willkommen in der Linux-Shell

Diese Anleitung bringt dir bei, Linux über die Kommandozeile zu benutzen – von
deinen allerersten Befehlen bis hin zur Paketverwaltung auf verschiedenen
Distributionen. Jedes Kapitel erklärt ein Thema. Unterwegs gibt es im Text
kurze **Fragen**; beantworte sie, dann werden das Terminal rechts und die
**Aufgaben** des Kapitels freigeschaltet. Eine Aufgabe wird automatisch
abgehakt, sobald du sie richtig gelöst hast. Am besten lernst du durch *Tun*:
lesen, ausprobieren, Fehler machen und es noch einmal versuchen.

## Was ist Linux?

Genau genommen ist **Linux** nur der *Kernel*: das Programm, das mit der
Hardware spricht und dafür sorgt, dass sich andere Programme Prozessor,
Arbeitsspeicher und Festplatten teilen können. Der Kernel wurde 1991 von Linus
Torvalds geschaffen und ist freie Software.

Für ein benutzbares System brauchst du noch viel mehr: eine Shell, Werkzeuge
zum Verwalten von Dateien, einen Paketmanager, vielleicht einen Desktop. Eine
**Distribution** (*Distro*) packt all das zu einem fertigen Ganzen zusammen.
Debian, Ubuntu, Arch Linux und Fedora sind ein paar bekannte Beispiele.

Das meiste, was du in dieser Anleitung lernst, funktioniert auf jeder
Distribution gleich, deshalb beginnt der Kurs damit. Das Terminal hier läuft
mit **Ubuntu 24.04 LTS**. Distributionen unterscheiden sich vor allem darin,
wie Software installiert wird – das kommt im Kapitel über Distributionen.

## Was ist eine Shell?

Eine **Shell** ist das Programm, das die Befehle liest, die du eintippst, und
sie ausführt. Die verbreitetste Shell ist **bash**, der Standard auf fast jeder
Distribution. Andere beliebte Shells sind **zsh** (der Standard unter macOS)
und **fish**. Die Grundlagen sind in allen gleich.

Beachte den Unterschied zwischen *Terminal* und *Shell*: Das Terminal ist das
Fenster, das Text anzeigt, und die Shell ist das Programm, das darin läuft.

```quiz
Du tippst `ls` und drückst Enter. Welches Programm liest den Befehl und führt ihn aus?
- [ ] Das Terminal
- [x] Die Shell
- [ ] Der Kernel
---
Das Terminal zeigt nur den Text an. Die Shell (hier bash) liest, was du
tippst, und führt es aus.
```

## Der Prompt

Wenn die Shell auf einen Befehl wartet, zeigt sie einen **Prompt** (eine
Eingabeaufforderung) an. Im Terminal hier sieht er so aus:

```text
elev@ubuntu:~$
```

Er verrät dir, wer du bist (`elev`), an welchem Rechner du sitzt
(`ubuntu`) und wo im Dateisystem du dich befindest (`~` bedeutet dein
Home-Verzeichnis). Das `$`-Zeichen zeigt, dass du ein normaler Benutzer bist.
Bist du der Administrator (*root*), siehst du stattdessen ein `#`.

```quiz
Der Prompt endet mit `#` statt mit `$`. Was sagt dir das?
- [ ] Du bist in deinem Home-Verzeichnis
- [ ] Der vorige Befehl ist fehlgeschlagen
- [x] Du bist der Administrator, root
```

## Dein erster Befehl

Klicke ins Terminal, tippe den folgenden Befehl ein und drücke **Enter**:

```sh
echo Hej världen
```

`echo` gibt einfach aus, was du ihm übergibst – hier *Hej världen*, das ist
Schwedisch für „Hallo Welt“. Die meisten Befehle folgen demselben Muster:

```text
Befehl   -Optionen  Argumente
ls       -l         /etc
```

Der *Befehl* ist das Programm, das ausgeführt wird, die *Optionen* (oder
*Flags*) ändern sein Verhalten, und die *Argumente* sind das, womit der Befehl
arbeiten soll.

```quiz
Welcher Teil ist im Befehl `ls -l /etc` die **Option**?
- [ ] `ls`
- [x] `-l`
- [ ] `/etc`
---
`ls` ist der Befehl, `-l` ändert sein Verhalten, und `/etc` ist das Argument –
das, womit `ls` arbeiten soll.
```

Probier `echo` mit einem eigenen Text aus:

```try
echo Linux is fun
---
`echo` hat genau die Wörter ausgegeben, die du ihm übergeben hast.
```

## Wer und wo bin ich?

Zwei kleine Befehle verraten dir etwas über das System, an dem du sitzt.
`whoami` gibt den Namen des Benutzers aus, als der du angemeldet bist. Die
Datei `/etc/os-release` beschreibt die Distribution, und `cat` gibt eine Datei
aus (mehr über `cat` in einem späteren Kapitel):

```sh
whoami
cat /etc/os-release
```

## So funktioniert der Simulator

Das Terminal hier ist ein **Simulator**, der vollständig in dieser App läuft.
Er verhält sich wie ein echter Linux-Rechner, aber nichts, was du tust, kann
deinem eigenen Computer schaden – und wenn du etwas Dummes anstellst, kannst
du jederzeit mit *Terminal zurücksetzen* in den Einstellungen von vorn
beginnen.

- **Klicke auf ein Codebeispiel**, um den Befehl ins Terminal zu übernehmen.
- **Tab** vervollständigt Befehle und Dateinamen.
- Mit den **Pfeiltasten hoch/runter** blätterst du durch frühere Befehle.
- **Strg+L** leert den Bildschirm und **Strg+C** bricht die Zeile ab, die du
  gerade tippst.
- `help` listet alle Befehle auf, und `man command` zeigt eine Handbuchseite.

```quiz
Du hast `ech` getippt und drückst **Tab**. Was passiert?
- [ ] Die Zeile wird abgebrochen
- [x] Die Shell versucht, den Rest des Namens zu ergänzen
- [ ] Der Bildschirm wird geleert
---
Tab vervollständigt Befehle und Dateinamen. **Strg+C** bricht die Zeile ab,
und **Strg+L** leert den Bildschirm.
```

### Ein paar schwedische Wörter

Diese Anleitung wurde ursprünglich auf Schwedisch geschrieben, deshalb haben
der Benutzer und die Übungsdateien im Simulator schwedische Namen. Du musst
kein Schwedisch können – die Befehle sind genau dieselben –, aber dieses
kleine Glossar hilft dir vielleicht:

| Name | Bedeutung |
|---|---|
| `elev` | Schüler (dein Benutzername) |
| `dokument` | Dokumente |
| `anteckningar.txt` | Notizen |
| `frukter.txt` | Früchte |
| `betyg.csv` | Noten |
| `bilder` | Bilder |
| `gammalt` | altes Zeug |
