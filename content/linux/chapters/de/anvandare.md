# Benutzer und Gruppen

Linux wurde von Anfang an dafür gebaut, dass sich viele Menschen denselben
Rechner zur selben Zeit teilen. Jede Datei hat einen Besitzer, und jedes
Programm läuft als ein bestimmter Benutzer – deshalb gehört das Anlegen,
Ändern und Entfernen von Konten zu den wichtigsten Aufgaben eines
Administrators. In diesem Kapitel legst du den Benutzer `kim` an, gibst dem
Konto ein Passwort und sudo-Rechte und lernst, wo das alles gespeichert wird.

## Benutzer und UIDs

Wie du herausfindest, wer du bist, weißt du schon:

```sh
whoami
id
```

`id` zeigt, dass du nicht nur einen Namen, sondern auch eine Nummer hast:
`uid=1000`. Das ist die **UID** (*user ID*), und es ist die Nummer – nicht der
Name –, die der Kernel sich merkt. Der Name ist nur da, damit wir Menschen uns
keine Zahlen merken müssen. Einige wichtige Nummern:

| UID | Wer |
|---|---|
| `0` | **root**, der Administrator. Wer UID 0 hat, darf alles. |
| `1`–`999` | **Systembenutzer** für Dienste und Programme |
| `1000` und höher | **Normale Benutzer** – Menschen. Der erste bekommt 1000. |

## Die Benutzerliste – `/etc/passwd`

Alle Benutzer stehen in der Textdatei `/etc/passwd`, eine Zeile pro Benutzer:

```sh
cat /etc/passwd
```

Jede Zeile hat sieben Felder, getrennt durch Doppelpunkte. Sieh dir deine
eigene Zeile an:

```sh
grep elev /etc/passwd
```

```text
elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash
 1   2  3    4      5        6          7
```

| Feld | Bedeutung |
|---|---|
| 1 | Der Benutzername |
| 2 | `x` – das Passwort steht in `/etc/shadow` (siehe unten) |
| 3 | UID |
| 4 | GID – die Nummer der **primären Gruppe** des Benutzers |
| 5 | Kommentar, meist der vollständige Name |
| 6 | Das Home-Verzeichnis |
| 7 | Die Shell, die gestartet wird, wenn sich der Benutzer anmeldet |

Der Befehl `getent` macht dieselbe Abfrage. Der Unterschied ist, dass er auch
Benutzer findet, die nicht in der Datei stehen, zum Beispiel an einer Schule
oder in einer Firma, wo die Konten auf einem zentralen Server liegen:

```sh
getent passwd elev
```

### Systembenutzer

Die meisten Zeilen in `/etc/passwd` sind keine Menschen. Dienste wie der
Webserver und das Logging-System laufen als eigene Benutzer mit so wenigen
Rechten wie möglich – werden sie gehackt, kommt der Angreifer nicht an deine
Dateien heran. Sie haben die Shell `nologin`, sodass sich niemand als sie
anmelden kann:

:::debian
Unter Debian und Ubuntu heißt der Benutzer des Webservers `www-data`:

```sh
grep www-data /etc/passwd
```
:::

:::arch
Unter Arch heißt der Benutzer des Webservers `http`:

```sh
grep http /etc/passwd
```
:::

:::redhat
Unter Fedora gibt es zum Beispiel `dbus`, der den System-Nachrichtenbus
betreibt:

```sh
grep dbus /etc/passwd
```
:::

Mit `awk` aus dem Kapitel über Textbearbeitung kannst du alle mit UID 1000
oder höher auflisten – die normalen Benutzer:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

Auch `nobody` (UID 65534) taucht auf. Das ist ein besonderer Benutzer, dem
„nichts“ gehört und der benutzt wird, wenn ein Programm so wenige Rechte wie
möglich haben soll.

## Gruppen und GIDs

Eine **Gruppe** ist eine Möglichkeit, mehreren Benutzern dieselben Rechte zu
geben, zum Beispiel für ein gemeinsames Projektverzeichnis. Gruppen stehen in
`/etc/group`:

```sh
cat /etc/group
```

```text
sudo:x:27:elev
 1   2  3   4
```

Die Felder sind der Gruppenname, `x`, die Nummer der Gruppe (**GID**) und eine
durch Kommas getrennte Liste der Mitglieder.

Jeder Benutzer hat **eine primäre Gruppe** (das GID-Feld in `/etc/passwd`) und
kann außerdem Mitglied in beliebig vielen **zusätzlichen Gruppen** sein. Neue
Dateien, die du anlegst, bekommen deine primäre Gruppe. In den meisten
Distributionen bekommt jeder Benutzer eine private primäre Gruppe mit
demselben Namen – `elev` ist in der Gruppe `elev`.

```sh
groups
id
```

## Die Passwörter – `/etc/shadow`

Achte auf das `x` in Feld 2 von `/etc/passwd`. Früher stand das
(verschlüsselte) Passwort genau dort. Das Problem ist, dass `/etc/passwd` für
alle lesbar sein **muss** – von dort holt sich `ls -l` die Namen der Besitzer.
So konnte jeder die verschlüsselten Passwörter kopieren und in aller Ruhe
versuchen, sie zu knacken. Deshalb wurden sie nach `/etc/shadow` verschoben,
das nur root lesen kann:

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

Feld 2 ist nicht das Passwort selbst, sondern ein **Hash** – ein
„Fingerabdruck“, der sich nicht zurückrechnen lässt. Wenn du dich anmeldest,
wird der Hash dessen berechnet, was du getippt hast, und mit dem gespeicherten
verglichen. `$y$` bedeutet, dass das Verfahren *yescrypt* benutzt wird. Ein
`!` oder `*` stattdessen bedeutet, dass es kein Passwort gibt oder dass das
Konto **gesperrt** ist. Die übrigen Felder geben an, wann das Passwort zuletzt
geändert wurde und wann es abläuft. `chage` zeigt sie im Klartext:

```sh
chage -l elev
```

## Einen Benutzer anlegen – `useradd`

Benutzer anzulegen erfordert root. Der gängigste Befehl existiert in jeder
Distribution:

```sh
sudo useradd -m -s /bin/bash kim
```

| Option | Bedeutung |
|---|---|
| `-m` | Das Home-Verzeichnis `/home/kim` anlegen |
| `-s /bin/bash` | Die Shell des Benutzers |
| `-c "Kim Svensson"` | Der Kommentar (vollständiger Name) |
| `-G group1,group2` | Gleich zusätzliche Gruppen |

`useradd` sucht die nächste freie UID ab 1000 aufwärts – `kim` bekommt 1001.
Die Grenzen stehen in `/etc/login.defs`. Außerdem wird eine Gruppe `kim`
angelegt, und die Dateien in `/etc/skel` (*skeleton*, „Skelett“) werden in das
neue Home-Verzeichnis kopiert. Leg etwas dort ab, und jeder neue Benutzer
bekommt es:

```sh
ls -a /etc/skel
```

Hier unterscheiden sich die Distributionen:

:::debian
Unter Debian und Ubuntu ist `useradd` knauserig: Ohne `-m` wird **kein**
Home-Verzeichnis angelegt, und ohne `-s` wird die Shell `/bin/sh`. Deshalb
gibt es das freundlichere Skript `adduser`, das zur Debian-Familie gehört. Es
legt das Home-Verzeichnis an, wählt bash und fragt nach Passwort und Namen:

```sh
sudo adduser lisa
```

Beantworte die Fragen – bei den meisten kannst du einfach Enter drücken.
`adduser` kann auch einen bestehenden Benutzer zu einer Gruppe hinzufügen:
`sudo adduser lisa sudo`.
:::

:::arch
Unter Arch wird ohne `-m` kein Home-Verzeichnis angelegt, und den Befehl
`adduser` gibt es überhaupt nicht – probiere es aus:

```sh
adduser lisa
```

Das Arch-Wiki empfiehlt, alles auf einmal zu erledigen:
`useradd -m -G wheel -s /bin/bash name`.
:::

:::redhat
Unter Fedora wird das Home-Verzeichnis auch ohne `-m` angelegt (die
Einstellung `CREATE_HOME` in `/etc/login.defs`), und die Shell ist bash. `-m`
schadet aber nicht, also gewöhn dir an, es zu tippen – dann funktioniert
derselbe Befehl überall.
:::

`useradd`, `passwd` und die anderen Befehle in diesem Kapitel sind immer
installiert. Das Paket heißt `passwd` unter Debian, `shadow` unter Arch und
`shadow-utils` unter Fedora – noch ein Beispiel dafür, dass dieselbe Sache
unterschiedliche Namen hat.

## Ein Passwort setzen – `passwd`

Ein neues Konto hat kein Passwort (`!` in `/etc/shadow`), also kann sich
niemand daran anmelden. Setze eines mit `passwd`:

```sh
sudo passwd kim
```

Du tippst das Passwort zweimal. **Was du tippst, wird nicht angezeigt** – keine
Sternchen, gar nichts. Das ist Absicht: Wer dir über die Schulter schaut, soll
nicht einmal sehen, wie lang das Passwort ist. Tippe es ein und drücke Enter.

`passwd` ohne Namen ändert dein eigenes Passwort. Nur root darf die Passwörter
anderer Benutzer ändern – probiere es ohne sudo:

```sh
passwd root
```

## Gruppen – `groupadd`, `usermod -aG` und `gpasswd`

Lege eine Gruppe an und füge ein Mitglied hinzu:

```sh
sudo groupadd utvecklare
sudo usermod -aG utvecklare kim
groups kim
```

`-aG` bedeutet *append to Groups* (an die Gruppen anhängen). **Vergiss das
`-a` nicht!** Mit nur `-G` wird die Liste der zusätzlichen Gruppen auf genau
das gesetzt, was du tippst – und der Benutzer wird aus allen anderen Gruppen
entfernt, etwa aus der sudo-Gruppe. Ein beliebter Weg, sich selbst
auszusperren.

`gpasswd` macht dasselbe und kann außerdem Mitglieder entfernen:

```sh
sudo gpasswd -a kim utvecklare
sudo gpasswd -d kim utvecklare
```

Auf einem echten Rechner wirkt eine neue Gruppenmitgliedschaft erst, wenn sich
der Benutzer das nächste Mal anmeldet. Der Simulator ist netter – hier gilt sie
sofort.

Gruppen benutzt man für gemeinsame Verzeichnisse. Mach die Gruppe mit `chgrp`
zum Besitzer und gib ihr mit `chmod` Schreibrechte:

```sh
sudo mkdir /srv/projekt
sudo chgrp utvecklare /srv/projekt
sudo chmod 775 /srv/projekt
ls -ld /srv/projekt
```

## sudo-Rechte vergeben – `sudo` oder `wheel`

Wer `sudo` benutzen darf, wird in `/etc/sudoers` festgelegt:

```sh
sudo cat /etc/sudoers
```

Die Zeile `%{{adminGroup}} ALL=(ALL:ALL) ALL` bedeutet, dass jeder in der
Gruppe **{{adminGroup}}** jeden Befehl als root ausführen darf. Jemandem
sudo-Rechte zu geben, heißt also nur, ihn in die richtige Gruppe aufzunehmen –
und die Gruppe heißt in den verschiedenen Familien unterschiedlich:

:::debian
Unter Debian und Ubuntu heißt die Gruppe `sudo`:

```sh
sudo usermod -aG sudo kim
```
:::

:::arch
Unter Arch heißt die Gruppe `wheel` – ein alter Unix-Name für „die, die das
Sagen haben“ (*big wheel*, auf Deutsch etwa „hohes Tier“):

```sh
sudo usermod -aG wheel kim
```
:::

:::redhat
Unter Fedora heißt die Gruppe `wheel` – ein alter Unix-Name für „die, die das
Sagen haben“ (*big wheel*, auf Deutsch etwa „hohes Tier“):

```sh
sudo usermod -aG wheel kim
```
:::

Bearbeite `/etc/sudoers` niemals direkt mit einem gewöhnlichen Editor – ein
Tippfehler kann dazu führen, dass niemand mehr sudo benutzen kann. Nimm
`visudo`, das die Datei vor dem Speichern prüft. Meistens brauchst du ohnehin
nur die Gruppen.

## Benutzer wechseln – `su` und `sudo -u`

Es gibt zwei Wege, jemand anderes zu werden:

| Befehl | Wessen Passwort? | Was passiert |
|---|---|---|
| `su - kim` | **kims** | Du bist als kim angemeldet, bis du `exit` tippst |
| `sudo -u kim command` | **dein eigenes** (du brauchst sudo-Rechte) | Ein einzelner Befehl läuft als kim |
| `sudo -iu kim` | dein eigenes | Eine Login-Shell als kim |

```sh
sudo -u kim whoami
```

Mit `su` wechselst du wirklich. Der Bindestrich (`-`) macht daraus ein Login:
Du landest in kims Home-Verzeichnis mit kims Einstellungen. Der Prompt zeigt,
wer du bist, und `exit` bringt dich zurück:

```sh
su - kim
```

`su` ohne Namen bedeutet root. Unter Ubuntu hat root kein Passwort, deshalb
funktioniert `su -` dort nicht – nimm `sudo -i`.

## Konten sperren und löschen

Ein Konto, das eine Weile nicht benutzt werden soll, lässt sich **sperren**.
`usermod -L` setzt ein `!` vor den Hash in `/etc/shadow`, sodass kein Passwort
mehr passt. `-U` entsperrt es wieder:

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` zeigt den Status: `P` (hat ein Passwort), `L` (gesperrt) oder `NP`
(kein Passwort). Mit `chage -E` kann ein Konto an einem bestimmten Datum
ablaufen – praktisch für Ferienjobber und Vertretungen.

Bevor du jemanden löschst, kann es gut sein, nachzusehen, wer angemeldet ist
und wann jemand zuletzt angemeldet war:

```sh
who
last
```

Dann entfernt `userdel` den Benutzer. Mit `-r` verschwindet auch das
Home-Verzeichnis – ohne `-r` bleiben die Dateien liegen:

```sh
sudo useradd -m vikarie
sudo userdel -r vikarie
```

:::debian
Die Debian-Familie hat außerdem `deluser`, das Gegenstück zu `adduser`:
`sudo deluser --remove-home vikarie`. `sudo deluser kim sudo` entfernt kim aus
der Gruppe sudo.
:::

`userdel` weigert sich, einen Benutzer zu löschen, der angemeldet ist – probiere
`sudo userdel elev`.

## Zusammenfassung

| Befehl | Macht |
|---|---|
| `id`, `groups` | UID, GID und Gruppen anzeigen |
| `useradd -m -s /bin/bash name` | Einen Benutzer anlegen |
| `passwd name` | Ein Passwort setzen |
| `usermod -aG group name` | Zu einer Gruppe hinzufügen |
| `groupadd group` | Eine Gruppe anlegen |
| `usermod -L` / `-U` | Sperren / entsperren |
| `userdel -r name` | Den Benutzer und das Home-Verzeichnis löschen |
| `su - name`, `sudo -u name` | Benutzer wechseln |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | Wo das alles gespeichert wird |
