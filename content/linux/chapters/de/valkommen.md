# Willkommen in der Linux-Shell

Diese Anleitung bringt dir bei, Linux über die Kommandozeile zu benutzen – von
deinen allerersten Befehlen bis hin zur Paketverwaltung auf verschiedenen
Distributionen. Jedes Kapitel erklärt ein Thema und endet mit einigen
**Aufgaben**, die du im Terminal rechts löst. Eine Aufgabe wird automatisch
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
Gerade benutzt du **{{distro}}**.

Distributionen werden in *Familien* eingeteilt, die aufeinander aufbauen und
denselben Paketmanager verwenden:

| Familie | Paketmanager | Beispiele |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

Das meiste, was du in dieser Anleitung lernst, funktioniert überall gleich.
Was sich unterscheidet – vor allem die Paketverwaltung –, bekommt eigene
Kapitel. Über das Menü oben kannst du jederzeit die Distribution wechseln.

## Was ist eine Shell?

Eine **Shell** ist das Programm, das die Befehle liest, die du eintippst, und
sie ausführt. Die verbreitetste Shell ist **bash**, der Standard auf fast jeder
Distribution. Andere beliebte Shells sind **zsh** (der Standard unter macOS)
und **fish**. Die Grundlagen sind in allen gleich.

Beachte den Unterschied zwischen *Terminal* und *Shell*: Das Terminal ist das
Fenster, das Text anzeigt, und die Shell ist das Programm, das darin läuft.

## Der Prompt

Wenn die Shell auf einen Befehl wartet, zeigt sie einen **Prompt** (eine
Eingabeaufforderung) an. Unter {{distro}} sieht er ungefähr so aus:

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

Er verrät dir, wer du bist (`elev`), an welchem Rechner du sitzt
(`{{hostname}}`) und wo im Dateisystem du dich befindest (`~` bedeutet dein
Home-Verzeichnis). Das `$`-Zeichen zeigt, dass du ein normaler Benutzer bist.
Bist du der Administrator (*root*), siehst du stattdessen ein `#`.

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

## So funktioniert der Simulator

Das Terminal hier ist ein **Simulator**, der vollständig in deinem Browser
läuft. Er verhält sich wie ein echter Linux-Rechner, aber nichts, was du tust,
kann deinem eigenen Computer schaden – und wenn du etwas Dummes anstellst,
kannst du jederzeit mit dem Knopf *Zurücksetzen* von vorn beginnen.

- **Klicke auf ein Codebeispiel**, um den Befehl ins Terminal zu übernehmen.
- **Tab** vervollständigt Befehle und Dateinamen.
- Mit den **Pfeiltasten hoch/runter** blätterst du durch frühere Befehle.
- **Strg+L** leert den Bildschirm und **Strg+C** bricht die Zeile ab, die du
  gerade tippst.
- `help` listet alle Befehle auf, und `man command` zeigt eine Handbuchseite.

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
