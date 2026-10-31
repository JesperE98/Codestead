# Git im Terminal

Hast du schon einmal Dateien namens `report-final.txt`, `report-final-2.txt`
und `report-REALLY-final.txt` gespeichert? Dann hast du *Versionsverwaltung*
von Hand betrieben. Ein Versionsverwaltungssystem macht dasselbe, nur richtig:
Es speichert Schnappschüsse des ganzen Projekts, merkt sich, wer was warum
geändert hat, lässt dich in der Zeit zurückreisen und macht es möglich, dass
viele Leute gleichzeitig an denselben Dateien arbeiten.

**Git** ist mit Abstand das verbreitetste Versionsverwaltungssystem. Es wurde
2005 von Linus Torvalds geschrieben – derselben Person, die den Linux-Kernel
geschrieben hat –, um den Quellcode des Kernels zu verwalten. Heute wird git
für fast jede Software verwendet, eignet sich aber genauso gut für Webseiten,
Konfigurationsdateien, Notizen und Bücher. Alles, was Text ist, passt perfekt.

Git ist für das Terminal gemacht. Grafische Programme und Editoren haben
git-Knöpfe, aber unter der Haube führen sie dieselben Befehle aus, die du hier
lernst.

## git installieren

Git ist nicht immer vorinstalliert. Im Ubuntu-Terminal installierst du es mit
apt:

```sh
sudo apt update
sudo apt install git
```

Andere Distributionen installieren es mit ihrem eigenen Paketmanager, wie du im
Teil über Distributionen und Pakete gelernt hast – auch dort heißt das Paket
`git`. Prüfe, ob es funktioniert:

```sh
git --version
```

Alle git-Befehle haben die Form `git COMMAND`, zum Beispiel `git status` oder
`git log`. Das Handbuch bekommst du mit `man git`.

## Sag git, wer du bist

Jede gespeicherte Version in git enthält den Namen und die E-Mail-Adresse der
Person, die sie erstellt hat. Deshalb will git wissen, wer du bist, bevor du
etwas speichern kannst. Das stellst du einmal pro Rechner ein:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

Du kannst gern deinen eigenen Namen verwenden. `--global` bedeutet, dass die
Einstellung für alle deine Projekte gilt. Sie wird in der ganz normalen
Textdatei `~/.gitconfig` gespeichert:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

Wenn du diesen Schritt vergisst, beschwert sich git, sobald du speichern
willst: `*** Please tell me who you are.` – und schlägt genau diese beiden
Befehle vor.

> **Tipp:** Füge außerdem `git config --global init.defaultBranch main` hinzu.
> Dann heißt der Hauptbranch jedes neuen Projekts auf all deinen Rechnern
> `main`. Ältere git-Versionen nennen ihn `master`, und draußen in der Welt
> wirst du beiden Namen begegnen.

## Ein neues Repository

In deinem Home-Verzeichnis liegt ein kleines Webprojekt, `~/{{webProject}}`,
mit drei Dateien. Geh dorthin und sieh dich um:

```sh
cd ~/{{webProject}}
ls
```

Damit git anfängt, das Verzeichnis zu verfolgen, machst du es zu einem
**Repository** (kurz *Repo*):

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

Das Einzige, was passiert ist: Ein verstecktes Verzeichnis, `.git`, wurde
angelegt. Dort bewahrt git die gesamte Geschichte auf. Deine Dateien rührt git
nicht an.

```sh
ls -a
ls .git
```

Lösche `.git` niemals, es sei denn, du willst die Geschichte verlieren – und
bearbeite die Dateien darin nicht von Hand. Wenn du git in einem Projekt nicht
mehr verwenden willst, reicht es, `.git` zu entfernen; deine normalen Dateien
bleiben erhalten.

```quiz
Du willst git in einem Projekt nicht mehr verwenden, aber alle deine Dateien behalten. Was tust du?
- [ ] `git init` noch einmal ausführen
- [x] Das versteckte Verzeichnis `.git` entfernen
- [ ] Alle Dateien außer `.git` entfernen
---
Die ganze Geschichte liegt in `.git`, und git rührt deine normalen Dateien
nicht an. Ohne `.git` bleiben die Dateien – nur die Geschichte ist weg.
```

## Drei Orte: Arbeitsverzeichnis, Index und Geschichte

Das Wichtigste, was man über git verstehen muss: Eine Änderung durchläuft drei
Orte:

```text
 working tree  ──git add──▶  index  ──git commit──▶  history
 (deine Dateien)           (nächster Commit)         (.git)
```

- Das **Arbeitsverzeichnis** (*working tree*) sind die Dateien, wie sie gerade
  aussehen – die, die du bearbeitest.
- Der **Index** (auch *Staging Area* genannt) ist eine Art Packtisch. Dort
  legst du hin, was in die nächste gespeicherte Version soll.
- Die **Geschichte** (*history*) besteht aus **Commits**. Ein Commit ist ein
  gespeicherter Schnappschuss aller Dateien, mit einer Nachricht, einem Autor
  und einem Zeitpunkt.

Wozu der Zwischenschritt? Damit du auswählen kannst. Wenn du fünf Dateien
geändert hast, aber nur zwei zusammengehören, kannst du diese beiden in den
Index legen, sie committen und den Rest für einen eigenen Commit aufheben.

```quiz
Du hast fünf Dateien geändert, aber nur zwei der Änderungen gehören zusammen.
Wie speicherst du nur diese beiden in einem Commit?
- [ ] Zuerst `git commit` ausführen und danach `git add` auf die beiden Dateien
- [x] `git add` auf die beiden Dateien ausführen, dann `git commit`
- [ ] Alle fünf committen – ein Commit nimmt immer jede geänderte Datei mit
---
Ein Commit speichert, was im Index liegt. Die anderen drei Änderungen bleiben
im Arbeitsverzeichnis, bis du sie hinzufügst.
```

## `git status` ist dein Kompass

Der Befehl, den du am häufigsten ausführen wirst, ist `git status`. Er sagt
dir, wo sich jede Änderung befindet – und schlägt oft vor, was du als Nächstes
tun kannst. Führ ihn lieber zu oft als zu selten aus!

```sh
git status
```

```text
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md
	index.html
	style.css

nothing added to commit but untracked files present (use "git add" to track)
```

*Untracked files* sind Dateien, die git sieht, aber noch nicht verfolgt. In
einem echten Terminal werden sie rot angezeigt. Leg sie mit `git add` in den
Index:

```sh
git add index.html style.css README.md
git status
```

```text
Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
	new file:   index.html
	new file:   style.css
```

Jetzt stehen sie unter *Changes to be committed* – in Grün. Statt jede Datei
einzeln zu nennen, kannst du `git add .` eingeben; das fügt alles im aktuellen
Verzeichnis hinzu (der Punkt bedeutet „hier“). `git add -A` fügt jede Änderung
im ganzen Repository hinzu.

## Der erste Commit

Speichere den Schnappschuss mit `git commit`. Die Option `-m` gibt die
Nachricht an:

```sh
git commit -m "{{commitFirst}}"
```

```text
[main (root-commit) 3f2a9c1] {{commitFirst}}
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

`3f2a9c1` ist der Anfang der **ID**
des Commits – ein 40 Zeichen langer *Hash*, der aus dem Inhalt berechnet wird.
Deine ID wird anders aussehen, denn der Zeitpunkt und dein Name fließen mit
ein. Die ersten sieben Zeichen reichen meist, um einen Commit eindeutig zu
erkennen.

Führe `git status` noch einmal aus:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* bedeutet, dass alles gespeichert ist. Prima!

## Sieh nach, was sich geändert hat: `git diff`

Füge eine Zeile zu `README.md` hinzu und frag git, was passiert ist:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 948fd1e..ecbdeba 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 Eine kleine Webseite, die ich mit git versioniere.
+{{builtWith}}
```

Die Zeile, die mit `+` beginnt, ist neu (grün), Zeilen mit `-` wurden entfernt
(rot), und der Rest wird als Kontext angezeigt. `@@ -1,3 +1,4 @@` bedeutet,
dass die Zeilen 1–3 der alten Version den Zeilen 1–4 der neuen entsprechen.

`git diff` vergleicht das Arbeitsverzeichnis mit dem Index – zeigt also, was
du *noch nicht* hinzugefügt hast. Um zu sehen, was im Index liegt und auf den
Commit wartet, gibst du `git diff --staged` ein.

Füge die Änderung hinzu und committe sie. Die Option `-a` führt `git add` für
jede Datei aus, die git bereits verfolgt, sodass es in einem einzigen Schritt
geht:

```sh
git commit -a -m "{{commitDescribe}}"
```

Beachte, dass `-a` *keine* neuen Dateien einschließt, die git noch nicht
verfolgt. Die musst du immer zuerst mit `git add` hinzufügen.

Die Fragen mit Befehlen in diesem Kapitel beginnen in einem frischen Terminal,
deshalb installieren sie zuerst git und machen den ersten Commit.
`> /dev/null 2>&1` wirft die Ausgabe dieser Zeilen weg, wie du im Kapitel über
Umleitungen und Pipes gelernt hast. Was gibt der letzte Befehl aus?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ echo 'Noch eine Zeile.' >> README.md
$ git commit -m "Noch eine Zeile" > /dev/null
$ git log --oneline | wc -l
1
---
Der zweite Commit ist nie passiert: Die Änderung an `README.md` lag nicht im
Index, also gab es nichts zu committen. Zuerst `git add README.md` – oder
`git commit -a` – hätte zwei Commits ergeben.
```

## Gute Commit-Nachrichten

In einem halben Jahr sind es die Commit-Nachrichten, die die Geschichte
erzählen – dir und anderen. Ein paar Faustregeln:

- Schreib eine kurze erste Zeile, am besten unter 50 Zeichen, die die Änderung
  zusammenfasst.
- Beschreibe, *was* die Änderung bewirkt und am besten *warum*, nicht *wie* du
  sie geschrieben hast.
- Ein Commit sollte eine Sache tun. Drei kleine Commits sind besser als ein
  großer.
- Musst du mehr erklären? Lass eine Leerzeile und schreib darunter einen
  längeren Text. Jedes `-m` wird zu einem eigenen Absatz:
  `git commit -m "Titel" -m "Erklärung."`

| Schlecht | Besser |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

Auf Englisch werden Nachrichten meist im Imperativ geschrieben: *Add contact
form*, *Fix broken link*. Das liest sich wie „dieser Commit wird …“. Auf
Deutsch ist der Infinitiv üblich: *Kontaktformular hinzufügen*.

## Die Geschichte ansehen

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: {{gitName}} <{{user}}@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    {{commitDescribe}}

commit 3f2a9c1...
```

Der neueste Commit steht oben. `HEAD -> main` bedeutet, dass du auf dem Branch
`main` bist und dass dies sein letzter Commit ist. Ein paar nützliche
Varianten:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` gibt eine Zeile pro Commit aus, `-n 1` zeigt nur den letzten,
`--stat` zeigt, welche Dateien sich geändert haben, und `git show` zeigt einen
Commit samt der Änderung selbst. Du kannst dir auch eine Datei ansehen, wie
sie in einem bestimmten Commit aussah: `git show HEAD~1:README.md` (`HEAD~1`
bedeutet „der Commit vor dem letzten“).

## Rückgängig machen

Git macht das Rückgängigmachen leicht – das ist die halbe Miete:

| Wenn du … willst | Befehl |
|---|---|
| Änderungen in einer Datei verwerfen (noch nicht hinzugefügt) | `git restore FILE` |
| eine Datei aus dem Index nehmen (die Änderung bleibt) | `git restore --staged FILE` |
| die Nachricht des letzten Commits ändern | `git commit --amend -m "New message"` |
| zurück dazu, wie alles beim letzten Commit aussah | `git reset --hard` |

Mach doch mal eine Datei kaputt und hol sie dir zurück:

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **Achtung!** `git restore FILE` und `git reset --hard` verwerfen Änderungen,
> die nie committet wurden. Die lassen sich nicht wiederherstellen. Alles, was
> irgendwann einmal committet wurde, lässt sich dagegen fast immer retten –
> frag `git reflog`, wo du überall warst.

## Branches

Ein **Branch** (Zweig) ist eine eigene Entwicklungslinie. In einem Branch
kannst du eine neue Idee ausprobieren, ohne die funktionierende Version in
`main` anzurühren. Wenn es gut wird, führst du den Branch mit `main` zusammen;
wenn nicht, wirfst du ihn weg.

Technisch gesehen ist ein Branch nur ein Etikett, das auf einen Commit zeigt
und mitwandert, wenn du neue Commits machst. Deshalb sind Branches in git
billig – nutze sie oft!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` legt den Branch an und wechselt
dorthin. Der Stern in `git branch` zeigt, wo du bist. Mach eine Änderung und
committe sie auf dem Branch:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

Wechsle zurück zu `main` und sieh dir `style.css` an:

```sh
git switch main
tail -3 style.css
```

Die lila Farbe ist weg! Wenn du den Branch wechselst, schreibt git das
Arbeitsverzeichnis so um, dass es wie der letzte Commit des Branches aussieht.
Die Änderung ist in `{{newDesign}}` sicher aufgehoben. `git log --oneline --all`
zeigt alle Branches:

```sh
git log --oneline --all
```

> **Tipp:** Ältere Anleitungen verwenden oft `git checkout {{newDesign}}` und
> `git checkout -b new-branch`. `checkout` macht dasselbe wie `switch`, kann
> aber auch Dateien wiederherstellen. Die neueren Befehle `switch` und
> `restore` teilen sich die Aufgaben und sind leichter zu merken.

Nicht committete Änderungen kommen beim Branchwechsel mit – es sei denn, sie
kollidieren mit dem anderen Branch. Dann weigert sich git und bittet dich,
zuerst zu committen (oder die Änderungen mit `git stash` vorübergehend
beiseitezulegen und sie mit `git stash pop` zurückzuholen).

Wie viele Zeilen mit `purple` hat `style.css` am Ende?

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
$ grep purple style.css | wc -l
0
---
Die lila Zeile wurde auf `{{newDesign}}` committet. Wenn du zu `main` wechselst,
lässt git das Arbeitsverzeichnis so aussehen wie den letzten Commit von
`main` – und dort gibt es die Zeile noch nicht.
```

## Branches zusammenführen: `git merge`

Stell dich auf den Branch, der die Änderungen *bekommen* soll – hier `main` –,
und führe zusammen:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* bedeutet, dass sich `main` nicht verändert hat, seit der Branch
angelegt wurde. Git muss `main` dann nur auf denselben Commit wie `{{newDesign}}`
vorschieben.

Wenn beide Branches neue Commits haben, macht git einen **Three-Way-Merge**:
Es vergleicht beide Branches mit ihrem gemeinsamen Vorfahren und erstellt einen
neuen *Merge-Commit* mit zwei Eltern. `git log --oneline --graph --all` zeigt,
wie sich die Geschichte aufteilt und wieder zusammenfindet:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'ueberschrift'
|\
| * 7c3f9e2 (ueberschrift) Freundlichere Überschrift
* | 52d8a71 Kürzerer Text
|/
* c19e2f4 {{commitPurple}}
```

Ein zusammengeführter Branch wird nicht mehr gebraucht und kann gelöscht
werden. `-d` weigert sich, wenn der Branch Commits hat, die nicht in dem
Branch sind, auf dem du stehst:

```sh
git branch -d {{newDesign}}
```

## Konflikte

Wenn beide Branches *dieselben Zeilen* geändert haben, kann git nicht wissen,
welche Version die richtige ist. Das nennt man einen **Konflikt**, und dann
entscheidest du. Lass uns absichtlich einen erzeugen:

```sh
git switch -c ueberschrift
sed -i 's/Willkommen!/Hallo und willkommen!/' index.html
git commit -am "Freundlichere Überschrift"
git switch main
sed -i 's/Willkommen!/Willkommen auf meiner Seite!/' index.html
git commit -am "Längere Überschrift"
git merge ueberschrift
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Keine Panik – nichts ist kaputt. `git status` führt die Datei unter *Unmerged
paths* als `both modified` auf. Sieh hinein:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>Willkommen auf meiner Seite!</h1>
=======
  <h1>Hallo und willkommen!</h1>
>>>>>>> ueberschrift
```

Zwischen `<<<<<<< HEAD` und `=======` steht deine Version (die des Branches,
auf dem du stehst); zwischen `=======` und `>>>>>>> ueberschrift` die des anderen
Branches. So löst du den Konflikt:

1. Öffne die Datei in einem Editor und bring sie in die Form, die du willst –
   nimm eine der Zeilen oder kombiniere sie – und lösche die Markierungszeilen.
2. Sag git mit `git add FILE`, dass der Konflikt gelöst ist.
3. Schließ den Merge mit `git commit` ab.

Der Simulator hat keinen richtigen Editor, aber wenn du einfach die Version
einer Seite übernehmen willst, kann git das für dich erledigen: `--ours` nimmt
deine Version und `--theirs` die des anderen Branches.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Branch ueberschrift zusammenführen"
```

Wenn du es dir mitten in einem Konflikt anders überlegst, bringt dich
`git merge --abort` dorthin zurück, wo du vor dem Merge warst.

Konflikte sind völlig normal, wenn mehrere Leute am selben Projekt arbeiten.
Ein guter Weg, weniger davon zu bekommen: kleine Commits machen und oft
zusammenführen.

```quiz
Du bist auf `main` und führst `git merge ueberschrift` aus. Die Datei bekommt einen Konflikt:

    <<<<<<< HEAD
      <h1>Hallo!</h1>
    =======
      <h1>Willkommen!</h1>
    >>>>>>> ueberschrift

Welche Zeile stammt von `main`?
- [x] `<h1>Hallo!</h1>`
- [ ] `<h1>Willkommen!</h1>`
---
`HEAD` ist der Branch, auf dem du bist – hier `main`. Seine Version steht
zwischen `<<<<<<< HEAD` und `=======`; die Version des anderen Branches kommt
nach `=======`.
```

## Dateien, die git ignorieren soll: `.gitignore`

Manche Dateien sollen nie in der Geschichte landen: Passwörter und Schlüssel,
Logs, temporäre Dateien und Dinge, die automatisch gebaut werden. Schreib ihre
Namen oder Muster in die Datei `.gitignore` im Wurzelverzeichnis des
Repositorys:

```sh
echo 'password=secret' > geheim.txt
echo 'error' > fehler.log
printf 'geheim.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`geheim.txt` und `fehler.log` werden nicht mehr
angezeigt – nicht einmal `git add .` erfasst sie. Ein `*` passt auf alles, und
ein Schrägstrich am Ende (`build/`) bedeutet ein ganzes Verzeichnis.
`.gitignore` selbst sollte dagegen committet werden, damit alle, die am
Projekt arbeiten, dieselben Dinge ignorieren:

```sh
git add .gitignore
git commit -m "Geheimnisse und Logs ignorieren"
```

Beachte, dass `.gitignore` nur für Dateien gilt, die git noch nicht verfolgt.
Wurde eine Datei schon committet, entfernst du sie mit `git rm --cached FILE`
aus dem Repository (aber nicht von der Festplatte).

## GitHub, GitLab und entfernte Repositorys

Bisher lag alles in deinem eigenen Repository. Um zusammenzuarbeiten – oder
einfach, um ein Backup zu haben –, hält man meist eine Kopie des Repositorys
auf einem Server vor, ein sogenanntes **Remote**. Die bekanntesten Dienste sind
**GitHub**, **GitLab** und **Codeberg**.

| Befehl | Macht |
|---|---|
| `git clone URL` | Lädt ein ganzes Repository samt Geschichte in ein neues Verzeichnis herunter |
| `git push` | Schickt deine neuen Commits an das Remote |
| `git pull` | Holt neue Commits vom Remote und führt sie mit deinen zusammen |
| `git fetch` | Holt neue Commits, ohne etwas zusammenzuführen |
| `git remote -v` | Listet die Remotes auf |

Das Remote heißt meist `origin`, und ein typischer Arbeitsablauf sieht so aus:
`git pull`, wenn du anfängst, dann bearbeiten, `git add` und `git commit` – und
zum Schluss `git push`. GitHub und GitLab melden dich mit einem SSH-Schlüssel
oder einem Zugriffstoken an, nicht mit einem Passwort.

All das braucht ein Netzwerk, und das hat der Simulator nicht. Aber `clone`,
`push` und `pull` funktionieren genauso gut zwischen zwei Repositorys auf
demselben Rechner, du kannst sie also trotzdem ausprobieren. Klone dein
Projekt in ein neues Verzeichnis:

```sh
cd ~
git clone ~/{{webProject}} ~/kopie
cd ~/kopie
git log --oneline
git remote -v
```

Ein Server wie GitHub hat nur die Geschichte, kein Arbeitsverzeichnis. Ein
solches *Bare*-Repository legst du mit `git init --bare` an. Tu so, als wäre es
dein GitHub-Konto, und pushe `main` dorthin:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` verknüpft dein `main` mit `origin/main`, damit `git status` dir sagen
kann, ob du dem Server voraus oder hinterher bist, und damit von da an ein
einfaches `git push` und `git pull` genügen.

## Zusammenfassung

| Befehl | Macht |
|---|---|
| `git init` | Macht das Verzeichnis zu einem Repository |
| `git status` | Zeigt den Zustand – führ ihn oft aus! |
| `git add FILE` / `git add .` | Legt Änderungen in den Index |
| `git commit -m "…"` | Speichert den Index als neuen Commit |
| `git diff` / `git diff --staged` | Zeigt Änderungen, die nicht committet sind |
| `git log --oneline --graph --all` | Zeigt die Geschichte |
| `git restore FILE` | Verwirft Änderungen in einer Datei |
| `git switch -c BRANCH` | Legt einen Branch an und wechselt dorthin |
| `git merge BRANCH` | Führt einen Branch mit dem zusammen, auf dem du stehst |
| `git clone`, `git pull`, `git push` | Zusammenarbeit über ein Remote |
