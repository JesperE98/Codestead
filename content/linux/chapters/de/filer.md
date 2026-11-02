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
mkdir -p reise/2026/juni
```

## Leere Dateien anlegen – `touch`

`touch` legt eine leere Datei an, falls sie noch nicht existiert (und
aktualisiert andernfalls nur ihren Zeitstempel):

```sh
touch einkaufsliste.txt
```

```quiz
Was macht `touch {{notes}}`, wenn die Datei schon existiert?
- [ ] Es leert die Datei
- [ ] Es beschwert sich, dass die Datei existiert
- [x] Es aktualisiert nur den Zeitstempel der Datei – der Inhalt bleibt gleich
```

## Kopieren – `cp`

```sh
cp {{notes}} notizen-kopie.txt
```

Ist das Ziel ein Verzeichnis, landet die Kopie mit demselben Namen darin. Um
ein ganzes Verzeichnis zu kopieren, brauchst du `-r` (*recursive*):

```sh
cp -r {{documents}} {{documents}}-backup
```

```predict
$ mkdir kopien
$ cp {{notes}} kopien
$ ls kopien
{{notes}}
---
`kopien` ist ein Verzeichnis, also landet die Kopie darin, mit demselben Namen.
```

## Verschieben und umbenennen – `mv`

Unter Linux sind *Verschieben* und *Umbenennen* dasselbe. `mv` erledigt
beides:

```sh
mv einkaufsliste.txt {{documents}}/
mv {{documents}}/einkaufsliste.txt {{documents}}/einkaufen.txt
```

```quiz
Es gibt keine Datei namens `b.txt`. Was macht `mv a.txt b.txt`?
- [ ] Kopiert `a.txt` nach `b.txt`
- [x] Benennt `a.txt` in `b.txt` um
- [ ] Schlägt fehl, weil `b.txt` nicht existiert
---
Verschieben und Umbenennen sind dasselbe. Danach gibt es nur noch `b.txt`.
```

## Löschen – `rm` und `rmdir`

```sh
rm notizen-kopie.txt
```

`rmdir` entfernt *leere* Verzeichnisse. Um ein Verzeichnis mitsamt seinem
ganzen Inhalt zu entfernen, nimmst du `rm -r`:

```sh
rm -r {{documents}}-backup
```

> **Achtung!** Im Terminal gibt es keinen Papierkorb. Was du mit `rm`
> löschst, ist endgültig weg. Der Befehl `rm -rf` (*recursive, force*) stellt
> keine Fragen und beschwert sich nie – prüfe den Pfad immer doppelt, bevor du
> Enter drückst.

```quiz
Welcher Befehl entfernt das Verzeichnis `{{old}}` *nur*, wenn es leer ist?
- [ ] `rm {{old}}`
- [x] `rmdir {{old}}`
- [ ] `rm -r {{old}}`
---
`rmdir` weigert sich, ein Verzeichnis zu entfernen, in dem noch etwas liegt.
`rm -r` entfernt das Verzeichnis samt allem, was darin ist.
```

## Wildcards

Die Shell kann Muster in mehrere Dateinamen erweitern, bevor der Befehl
ausgeführt wird:

| Muster | Passt auf |
|---|---|
| `*` | Beliebiges (null oder mehr Zeichen) |
| `?` | Genau ein Zeichen |
| `[abc]` | Eines der Zeichen a, b oder c |

Das Verzeichnis `{{documents}}` in deinem Home-Verzeichnis enthält drei Dateien:
`{{grades}}`, `{{fruits}}` und `server.log`. So listest du nur die auf, die auf
`.txt` enden:

```sh
ls {{documents}}/*.txt
```

```text
{{documents}}/{{fruits}}
```

Hier bekommt `ls` das Sternchen nie zu sehen – die Shell hat
`{{documents}}/*.txt` bereits durch alle passenden Dateinamen ersetzt.

```predict
$ ls {{documents}}/?????.*
{{documents}}/{{grades}}
---
Jedes `?` steht für genau ein Zeichen, also muss der Name vor dem Punkt fünf
Zeichen lang sein. Das trifft nur auf `{{grades}}` zu – die Namen der anderen
Dateien sind länger.
```

## Leerzeichen in Dateinamen

Die Shell teilt die Befehlszeile an Leerzeichen auf. Hat eine Datei ein
Leerzeichen im Namen, musst du Anführungszeichen benutzen (oder ein `\` vor
das Leerzeichen setzen):

```sh
touch "meine datei.txt"
ls -l "meine datei.txt"
```

Deshalb verwenden viele lieber Bindestriche oder Unterstriche in Dateinamen.
