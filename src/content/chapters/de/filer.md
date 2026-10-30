# Dateien und Verzeichnisse

Jetzt, wo du dich zurechtfindest, ist es Zeit, Dinge anzulegen, zu kopieren,
zu verschieben und zu löschen.

## Verzeichnisse anlegen – `mkdir`

```sh
mkdir bilder2
```

Wenn du mehrere Ebenen auf einmal anlegen willst, brauchst du `-p`
(*parents*). Ohne diese Option beschwert sich `mkdir`, wenn das übergeordnete
Verzeichnis nicht existiert:

```sh
mkdir -p resa/2026/juni
```

## Leere Dateien anlegen – `touch`

`touch` legt eine leere Datei an, falls sie noch nicht existiert (und
aktualisiert andernfalls nur ihren Zeitstempel):

```sh
touch inkopslista.txt
```

## Kopieren – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

Ist das Ziel ein Verzeichnis, landet die Kopie mit demselben Namen darin. Um
ein ganzes Verzeichnis zu kopieren, brauchst du `-r` (*recursive*):

```sh
cp -r dokument dokument-backup
```

## Verschieben und umbenennen – `mv`

Unter Linux sind *Verschieben* und *Umbenennen* dasselbe. `mv` erledigt
beides:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

## Löschen – `rm` und `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` entfernt *leere* Verzeichnisse. Um ein Verzeichnis mitsamt seinem
ganzen Inhalt zu entfernen, nimmst du `rm -r`:

```sh
rm -r dokument-backup
```

> **Achtung!** Im Terminal gibt es keinen Papierkorb. Was du mit `rm`
> löschst, ist endgültig weg. Der Befehl `rm -rf` (*recursive, force*) stellt
> keine Fragen und beschwert sich nie – prüfe den Pfad immer doppelt, bevor du
> Enter drückst.

## Wildcards

Die Shell kann Muster in mehrere Dateinamen erweitern, bevor der Befehl
ausgeführt wird:

| Muster | Passt auf |
|---|---|
| `*` | Beliebiges (null oder mehr Zeichen) |
| `?` | Genau ein Zeichen |
| `[abc]` | Eines der Zeichen a, b oder c |

```sh
ls dokument/*.txt
```

Hier bekommt `ls` das Sternchen nie zu sehen – die Shell hat
`dokument/*.txt` bereits durch alle passenden Dateinamen ersetzt.

## Leerzeichen in Dateinamen

Die Shell teilt die Befehlszeile an Leerzeichen auf. Hat eine Datei ein
Leerzeichen im Namen, musst du Anführungszeichen benutzen (oder ein `\` vor
das Leerzeichen setzen):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

Deshalb verwenden viele lieber Bindestriche oder Unterstriche in Dateinamen.
