# Zeitgesteuerte Jobs mit cron

Jede Nacht ein Backup, jede Woche alte Logs aufräumen, alle fünf Minuten Daten
abholen – der Rechner kann Befehle zu festen Zeiten von selbst ausführen. Das
klassische Werkzeug dafür ist **cron**, und systemd hat eigene **Timer**.

## cron und crontab

Der Dienst cron wacht jede Minute auf und führt die Jobs aus, deren Zeit
gekommen ist. Jeder Benutzer hat seine eigene Liste von Jobs, eine
**crontab**:

```sh
crontab -l
```

*no crontab for {{user}}* bedeutet, dass du noch keine Jobs hast.

## Die fünf Zeitfelder

Jede Zeile in einer crontab hat fünf Zeitfelder und danach den Befehl:

```text
┌───────────── Minute (0–59)
│ ┌─────────── Stunde (0–23)
│ │ ┌───────── Tag des Monats (1–31)
│ │ │ ┌─────── Monat (1–12)
│ │ │ │ ┌───── Wochentag (0–7, Sonntag ist 0 oder 7)
│ │ │ │ │
* * * * *  Befehl
```

| Du schreibst | Bedeutet |
|---|---|
| `*` | Jede |
| `5` | Genau 5 |
| `1-5` | 1 bis 5 |
| `1,15` | 1 und 15 |
| `*/10` | Jede zehnte: 0, 10, 20 … |

| Zeile | Läuft |
|---|---|
| `* * * * * command` | Jede Minute |
| `*/5 * * * * command` | Alle fünf Minuten |
| `30 2 * * * command` | Jede Nacht um 02:30 |
| `0 7 * * 1-5 command` | Montag bis Freitag um 07:00 |
| `0 0 1 * * command` | Am Ersten jedes Monats um Mitternacht |
| `@reboot command` | Einmal, wenn der Rechner startet |

`@hourly`, `@daily`, `@weekly` und `@monthly` sind ebenfalls Abkürzungen.

```quiz
Wann läuft der Job `15 8 * * 6 ~/backup.sh`?
- [ ] Jeden Tag um 15:08
- [x] Jeden Samstag um 08:15
- [ ] Am 15. jedes Monats um 08:00
---
Die Reihenfolge ist Minute, Stunde, Tag des Monats, Monat und Wochentag:
Minute 15, Stunde 8, jedes Datum, jeder Monat, Tag 6 – Samstag.
```

```quiz
Wie oft läuft `0 */2 * * * command`?
- [ ] Alle zwei Minuten
- [x] Alle zwei Stunden, zur vollen Stunde
- [ ] Zweimal am Tag
---
Minute 0 und jede zweite Stunde: 00:00, 02:00, 04:00 …
```

## Jobs installieren

`crontab -e` öffnet deine crontab in einem Texteditor und installiert sie,
wenn du speicherst. Der Simulator hat noch keinen Editor, deshalb gibst du
`crontab` die Jobs hier über seine Eingabe – `-` bedeutet „von der Eingabe
lesen“:

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

Vorsicht: `crontab -` und `crontab FILE` **ersetzen** die ganze crontab. Um
einen Job hinzuzufügen, kombinierst du die alten Jobs mit dem neuen:

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

Um eine Zeile zu entfernen, filterst du sie mit `grep -v` heraus und
installierst den Rest – oder du entfernst alles mit `crontab -r`:

```sh
crontab -l | grep -v backup.sh | crontab -
```

`crontab` prüft die Zeilen, bevor es irgendetwas installiert:

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
Es gibt keine Stunde 25 – die Stunden gehen von 0 bis 23. Es wurde nichts
installiert.
```

## Zusehen, wie er läuft

Wenn du den Job installiert hast, der jede Minute läuft, warte eine Minute und
sieh nach:

```sh
cat ~/cron.log
journalctl -u cron
```

Jeder Lauf wird ins Journal geschrieben, etwa als
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`. Im Simulator läuft cron nur,
solange die App geöffnet ist – genau wie ein echter Rechner holt er die Jobs,
die er im ausgeschalteten Zustand verpasst hat, nicht nach.

## Die cron-Falle: eine andere Umgebung

Die Jobs laufen nicht in deinem Terminal, und das überrascht fast jeden:

- Sie laufen mit `/bin/sh`, ohne deine Aliase und ohne deine `~/.bashrc`.
- `PATH` ist kurz (`/usr/bin:/bin`), deshalb brauchen Programme an anderen
  Orten ihren vollständigen Pfad.
- Sie starten in deinem Home-Verzeichnis.
- Ausgaben, die nicht in eine Datei geschickt werden, gehen verloren. Beende
  die Zeile immer mit zum Beispiel `>> ~/job.log 2>&1`.

Führe den Befehl zuerst von Hand aus. Wenn er dort funktioniert, trag ihn in
die crontab ein.

```quiz
Der Job `* * * * * echo hi` läuft jede Minute, aber du siehst `hi` nirgends.
Warum?
- [ ] cron erlaubt kein `echo`
- [x] Die Ausgabe kann nirgendwohin – schick sie mit `>>` in eine Datei
- [ ] Jobs laufen nur als root
---
Die Ausgabe von cron-Jobs wird in keinem Terminal angezeigt. Das echte cron
versucht, sie per E-Mail zu verschicken, und die meisten Rechner haben keine
Mail – also geht sie verloren.
```

## Die eigenen Jobs des Systems

Neben den crontabs der Benutzer gibt es `/etc/crontab` und Verzeichnisse wie
`/etc/cron.daily` und `/etc/cron.weekly`. Die Skripte darin werden einmal am
Tag bzw. einmal in der Woche ausgeführt:

```sh
cat /etc/crontab
ls /etc/cron.daily
```

Die Zeilen in `/etc/crontab` haben vor dem Befehl ein zusätzliches Feld: den
Benutzer, als der der Job läuft.

## systemd-Timer

In modernen Distributionen erledigen das oft stattdessen systemd-**Timer**:
eine `.timer`-Unit, die zu festen Zeiten eine `.service`-Unit startet. Sie
schreiben ins Journal und können verpasste Läufe nachholen, aber jeder Job
braucht zwei Unit-Dateien. Für deine eigenen kleinen Jobs ist cron der
schnellste Weg. Liste die Timer auf dem Rechner mit dem nächsten und dem
letzten Lauf auf:

```try
systemctl list-timers
```

## In anderen Distributionen

| | Ubuntu und Debian | Fedora | Arch |
|---|---|---|---|
| Paket | `cron` | `cronie` | `cronie` |
| Dienst | `cron` | `crond` | `cronie` |
| Von Anfang an installiert | Ja | Ja | Nein |

Unter Arch beginnst du mit `sudo pacman -S cronie` und
`sudo systemctl enable --now cronie`.
