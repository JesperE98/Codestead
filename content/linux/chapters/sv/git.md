# Git i terminalen

Har du någon gång sparat filer som `rapport-slutlig.txt`,
`rapport-slutlig-2.txt` och `rapport-VERKLIGEN-slutlig.txt`? Då har du gjort
*versionshantering* för hand. Ett versionshanteringssystem gör samma sak
ordentligt: det sparar ögonblicksbilder av hela projektet, kommer ihåg vem som
ändrade vad och varför, låter dig gå tillbaka i tiden och gör det möjligt för
många att arbeta i samma filer samtidigt.

**Git** är det överlägset vanligaste versionshanteringssystemet. Det skrevs
2005 av Linus Torvalds – samma person som skrev Linuxkärnan – just för att
hantera kärnans källkod. I dag används git för nästan all mjukvara, men det
fungerar lika bra för webbsidor, konfigurationsfiler, anteckningar och
böcker. Allt som är text passar perfekt.

Git är byggt för terminalen. Grafiska program och editorer har git-knappar,
men under huven kör de samma kommandon som du lär dig här.

## Installera git

Git är inte alltid förinstallerat. I Ubuntu-terminalen installerar du det med
apt:

```sh
sudo apt update
sudo apt install git
```

Andra distributioner installerar det med sin egen pakethanterare, som du lärde
dig i delen om distributioner och paket – paketet heter `git` där också.
Kontrollera att det fungerar:

```sh
git --version
```

Alla git-kommandon har formen `git KOMMANDO`, till exempel `git status` eller
`git log`. Manualen hittar du med `man git`.

## Berätta vem du är

Varje sparad version i git innehåller namnet och e-postadressen på den som
gjorde den. Därför vill git veta vem du är innan du kan spara något. Det
ställer du in en gång per dator:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

Byt gärna till ditt eget namn. `--global` betyder att inställningen gäller
alla dina projekt. Den sparas i den vanliga textfilen `~/.gitconfig`:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

Glömmer du det här säger git ifrån när du försöker spara:
`*** Please tell me who you are.` – och föreslår precis de här två
kommandona.

> **Tips:** Lägg också till `git config --global init.defaultBranch main`.
> Huvudgrenen i ett nytt projekt heter då `main` på alla datorer. Äldre
> versioner av git kallar den `master`, och du kommer att se båda namnen ute
> i världen.

## Ett nytt repo

I hemkatalogen finns ett litet webbprojekt, `~/{{webProject}}`, med tre filer.
Gå dit och titta:

```sh
cd ~/{{webProject}}
ls
```

För att git ska börja hålla koll på katalogen gör du den till ett **repo**
(*repository*, förråd):

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

Det enda som hände var att en dold katalog, `.git`, skapades. Där sparar git
hela historiken. Själva filerna rör git inte.

```sh
ls -a
ls .git
```

Ta aldrig bort `.git` om du inte vill bli av med historiken – och redigera
inte filerna där för hand. Vill du sluta använda git i ett projekt räcker det
att ta bort `.git`; dina vanliga filer finns kvar.

```quiz
Du vill sluta använda git i ett projekt, men behålla alla dina filer. Vad gör du?
- [ ] Kör `git init` igen
- [x] Tar bort den dolda katalogen `.git`
- [ ] Tar bort alla filer utom `.git`
---
Hela historiken finns i `.git`, och git rör inte dina vanliga filer. Utan
`.git` finns filerna kvar – bara historiken är borta.
```

## Tre platser: arbetskatalog, index och historik

Det viktigaste att förstå i git är att en ändring passerar tre platser:

```text
 arbetskatalogen  ──git add──▶  indexet  ──git commit──▶  historiken
 (filerna du ser)             (nästa commit)              (.git)
```

- **Arbetskatalogen** är filerna som de ser ut just nu, som du redigerar.
- **Indexet** (även kallat *staging area*) är ett slags packbord. Där lägger
  du det som ska med i nästa sparade version.
- **Historiken** består av **commits**. En commit är en sparad ögonblicksbild
  av alla filer, med ett meddelande, en författare och en tidpunkt.

Varför ett mellansteg? För att du ska kunna välja. Har du ändrat i fem filer
men bara två hör ihop kan du lägga de två i indexet, göra en commit av dem och
spara resten till en egen commit.

```quiz
Du har ändrat i fem filer, men bara två av ändringarna hör ihop. Hur sparar du
bara de två i en commit?
- [ ] Kör `git commit` först och `git add` på de två filerna efteråt
- [x] Kör `git add` på de två filerna, sedan `git commit`
- [ ] Committa alla fem – en commit tar alltid med alla ändrade filer
---
En commit sparar det som finns i indexet. De andra tre ändringarna stannar i
arbetskatalogen tills du lägger till dem.
```

## `git status` är din kompass

Det kommando du kommer att köra oftast är `git status`. Det berättar var alla
ändringar befinner sig – och föreslår ofta vad du kan göra härnäst. Kör det
hellre för ofta än för sällan!

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

*Untracked files* är filer som git ser men inte följer än. I en riktig
terminal visas de i rött. Lägg dem i indexet med `git add`:

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

Nu står de under *Changes to be committed* – i grönt. Istället för att räkna
upp filerna kan du skriva `git add .`, som lägger till allt i den aktuella
katalogen (punkten betyder ju "här"). `git add -A` lägger till alla ändringar
i hela repot.

## Den första commiten

Spara ögonblicksbilden med `git commit`. Flaggan `-m` anger meddelandet:

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

`3f2a9c1` är början på commitens **id** – en *hash* på 40 tecken som räknas
fram ur innehållet. Ditt id blir ett annat, eftersom tiden och ditt namn
ingår. Oftast räcker de första sju tecknen för att peka ut en commit.

Kör `git status` igen:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* betyder att allt är sparat. Skönt!

## Se vad som ändrats: `git diff`

Lägg till en rad i `README.md` och fråga git vad som hänt:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 1100cf4..de5864d 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # Min webbplats
 
 En liten webbplats som jag versionshanterar med git.
+{{builtWith}}
```

Raden som börjar med `+` är ny (grön), rader som börjar med `-` är borttagna
(röda) och de övriga visas som sammanhang. `@@ -1,3 +1,4 @@` betyder att
rad 1–3 i den gamla versionen motsvaras av rad 1–4 i den nya.

`git diff` jämför arbetskatalogen med indexet – alltså det du *inte* lagt
till än. Vill du se det som ligger i indexet och väntar på att committas
skriver du `git diff --staged`.

Lägg till och committa ändringen. Flaggan `-a` gör `git add` på alla filer
som git redan följer, så det går i ett steg:

```sh
git commit -a -m "{{commitDescribe}}"
```

Observera att `-a` *inte* tar med nya filer som git inte följer än. Dem måste
du alltid lägga till med `git add` först.

Frågorna med kommandon i det här kapitlet börjar i en ny terminal, så de
installerar först git och gör den första commiten. `> /dev/null 2>&1` slänger
utskriften från de raderna, som du lärde dig i kapitlet om omdirigering och
pipes. Vad skriver det sista kommandot ut?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ echo 'En rad till.' >> README.md
$ git commit -m "En rad till" > /dev/null
$ git log --oneline | wc -l
1
---
Den andra commiten blev aldrig av: ändringen i `README.md` fanns inte i
indexet, så det fanns inget att committa. `git add README.md` först – eller
`git commit -a` – hade gett två commits.
```

## Bra commit-meddelanden

Om ett halvår är det commit-meddelandena som berättar vad som hände – för
dig själv och för andra. Några tumregler:

- Skriv en kort första rad, helst under 50 tecken, som sammanfattar ändringen.
- Beskriv *vad* ändringen gör och gärna *varför*, inte *hur* du skrev den.
- En commit ska göra en sak. Hellre tre små commits än en stor.
- Behöver du förklara mer: lämna en tom rad och skriv en längre text under.
  Varje `-m` blir ett eget stycke: `git commit -m "Rubrik" -m "Förklaring."`

| Dåligt | Bättre |
|---|---|
| `fix` | `Rätta trasig länk till kontaktsidan` |
| `ändringar` | `Gör rubrikerna större på mobilen` |
| `asdf` | `Lägg till kontaktformulär` |

På engelska skriver man ofta i imperativ: *Add contact form*, *Fix broken
link*. Det läses som "den här commiten kommer att …".

## Titta i historiken

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

Nyaste commiten står först. `HEAD -> main` betyder att du står på grenen
`main` och att det här är dess senaste commit. Några användbara varianter:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` ger en rad per commit, `-n 1` visar bara den senaste, `--stat`
visar vilka filer som ändrats och `git show` visar en commit inklusive själva
ändringen. Du kan också titta på en fil som den såg ut i en viss commit:
`git show HEAD~1:README.md` (`HEAD~1` betyder "commiten före den senaste").

## Ångra

Git gör det lätt att ångra – det är halva poängen:

| Vill du … | Kommando |
|---|---|
| kasta bort ändringar i en fil (som inte lagts till) | `git restore FIL` |
| plocka ut en fil ur indexet (ändringen finns kvar) | `git restore --staged FIL` |
| ändra meddelandet i senaste commiten | `git commit --amend -m "Nytt meddelande"` |
| hoppa tillbaka till hur allt såg ut vid senaste commit | `git reset --hard` |

Prova att förstöra en fil och ta tillbaka den:

```sh
echo 'hoppsan' > index.html
git diff
git restore index.html
cat index.html
```

> **Obs!** `git restore FIL` och `git reset --hard` kastar bort ändringar som
> aldrig committats. De går inte att få tillbaka. Allt som någon gång
> committats går däremot nästan alltid att rädda – fråga `git reflog` om var
> du har varit.

## Grenar

En **gren** (*branch*) är en egen utvecklingslinje. Du kan prova en ny idé i
en gren utan att röra den fungerande versionen i `main`. Blir det bra slår
du ihop grenen med `main`; blir det dåligt slänger du den.

Tekniskt är en gren bara en etikett som pekar på en commit och flyttar med
när du gör nya commits. Därför är grenar billiga i git – använd dem ofta!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` skapar grenen och byter till den. Stjärnan i
`git branch` visar var du står. Gör en ändring och committa den på grenen:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

Byt tillbaka till `main` och titta i `style.css`:

```sh
git switch main
tail -3 style.css
```

Den lila färgen är borta! När du byter gren gör git om arbetskatalogen så
att den ser ut som grenens senaste commit. Ändringen ligger tryggt kvar i
`{{newDesign}}`. `git log --oneline --all` visar alla grenar:

```sh
git log --oneline --all
```

> **Tips:** Du ser ofta `git checkout {{newDesign}}` och `git checkout -b ny-gren`
> i äldre guider. `checkout` gör samma sak som `switch`, men kan även
> återställa filer. De nyare kommandona `switch` och `restore` delar upp
> uppgifterna och är lättare att komma ihåg.

Har du ändringar som inte är committade när du byter gren följer de med –
om de inte krockar med den andra grenen. Då vägrar git och ber dig committa
först (eller lägga undan ändringarna tillfälligt med `git stash`, och ta
fram dem igen med `git stash pop`).

Den ursprungliga `style.css` innehåller inget `purple` – rubrikerna är navy.
Hur många rader med `purple` har `style.css` till slut?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ grep purple style.css | wc -l
0
---
Den lila raden committades på `{{newDesign}}`. När du byter till `main` gör git
arbetskatalogen som den senaste commiten på `main` – där raden inte finns än.
```

## Slå ihop grenar: `git merge`

Stå på grenen som ska *ta emot* ändringarna – här `main` – och slå ihop:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* betyder att `main` inte har ändrats sedan grenen skapades.
Git behöver då bara flytta fram `main` till samma commit som `{{newDesign}}`.

Har båda grenarna fått nya commits gör git en **trevägssammanfogning**: den
jämför båda grenarna med deras gemensamma ursprung och skapar en ny
*merge-commit* med två föräldrar. Med `git log --oneline --graph --all` ser
du hur historiken delar sig och går ihop igen:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'rubrik'
|\
| * 7c3f9e2 (rubrik) Vänligare rubrik
* | 52d8a71 Kortare text
|/
* c19e2f4 {{commitPurple}}
```

En gren som är ihopslagen behövs inte längre och kan tas bort. `-d` vägrar
om grenen innehåller commits som inte finns i den du står på:

```sh
git branch -d {{newDesign}}
```

## Konflikter

Om båda grenarna har ändrat *samma rader* kan git inte veta vilken version
som är rätt. Det kallas en **konflikt**, och då får du bestämma. Låt oss
skapa en med flit:

```sh
git switch -c rubrik
sed -i 's/Välkommen!/Hej och välkommen!/' index.html
git commit -am "Vänligare rubrik"
git switch main
sed -i 's/Välkommen!/Välkommen till min sida!/' index.html
git commit -am "Längre rubrik"
git merge rubrik
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Lugn – inget är förstört. `git status` listar filen under *Unmerged paths*
som `both modified`. Titta i den:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>Välkommen till min sida!</h1>
=======
  <h1>Hej och välkommen!</h1>
>>>>>>> rubrik
```

Mellan `<<<<<<< HEAD` och `=======` står din version (grenen du står på),
mellan `=======` och `>>>>>>> rubrik` står den andra grenens. Så löser du
konflikten:

1. Öppna filen i en editor och gör den som du vill ha den – välj en av
   raderna, eller skriv ihop dem – och ta bort markeringsraderna.
2. Berätta för git att konflikten är löst med `git add FIL`.
3. Avsluta sammanfogningen med `git commit`.

Simulatorn har ingen riktig editor, men vill du bara välja den ena sidans
version kan git göra det åt dig: `--ours` tar din version och `--theirs` den
andra grenens.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Slå ihop grenen rubrik"
```

Ångrar du dig mitt i en konflikt tar `git merge --abort` dig tillbaka till
läget före sammanfogningen.

Konflikter är helt normala när flera jobbar i samma projekt. Ett bra sätt att
få färre är att göra små commits och slå ihop ofta.

```quiz
Du står på `main` och kör `git merge rubrik`. Filen får en konflikt:

    <<<<<<< HEAD
      <h1>Hej!</h1>
    =======
      <h1>Välkommen!</h1>
    >>>>>>> rubrik

Vilken rad kommer från `main`?
- [x] `<h1>Hej!</h1>`
- [ ] `<h1>Välkommen!</h1>`
---
`HEAD` är grenen du står på – här `main`. Dess version står mellan
`<<<<<<< HEAD` och `=======`; den andra grenens version kommer efter `=======`.
```

## Filer som git ska strunta i: `.gitignore`

Vissa filer ska aldrig in i historiken: lösenord och nycklar, loggar,
temporära filer och sådant som byggs automatiskt. Skriv deras namn eller
mönster i filen `.gitignore` i repots rot:

```sh
echo 'lösenord=hemligt' > hemligt.txt
echo 'fel' > fel.log
printf 'hemligt.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`hemligt.txt` och `fel.log` syns inte längre – inte ens med `git add .`. Ett
`*` matchar vad som helst, och ett snedstreck på slutet (`build/`) betyder
en hel katalog. `.gitignore` själv ska däremot committas, så att alla som
jobbar i projektet ignorerar samma saker:

```sh
git add .gitignore
git commit -m "Ignorera hemligheter och loggar"
```

Observera att `.gitignore` bara gäller filer som git inte redan följer. Har
en fil redan committats tar du bort den ur repot (men inte från disken) med
`git rm --cached FIL`.

## GitHub, GitLab och fjärr-repon

Hittills har allt legat i ditt eget repo. För att samarbeta, eller bara ha en
säkerhetskopia, lägger man ofta en kopia av repot på en server, ett
**fjärr-repo** (*remote*). De mest kända tjänsterna är **GitHub**, **GitLab**
och **Codeberg**.

| Kommando | Gör |
|---|---|
| `git clone URL` | Hämtar ett helt repo, med all historik, till en ny katalog |
| `git push` | Skickar dina nya commits till fjärr-repot |
| `git pull` | Hämtar nya commits från fjärr-repot och slår ihop dem med dina |
| `git fetch` | Hämtar nya commits utan att slå ihop något |
| `git remote -v` | Visar vilka fjärr-repon som finns |

Ett fjärr-repo heter oftast `origin`, och ett typiskt arbetsflöde ser ut så
här: `git pull` när du börjar, sedan ändra, `git add` och `git commit` – och
till sist `git push`. Till GitHub och GitLab loggar man in med en SSH-nyckel
eller en åtkomsttoken, inte med lösenord.

Allt det här kräver nätverk, och simulatorn har inget. Men `clone`, `push`
och `pull` fungerar lika bra mellan två repon på samma dator, så du kan prova
ändå. Klona ditt projekt till en ny katalog:

```sh
cd ~
git clone ~/{{webProject}} ~/kopia
cd ~/kopia
git log --oneline
git remote -v
```

En server som GitHub har bara historiken, ingen arbetskatalog. Ett sådant
*bare*-repo skapar du med `git init --bare`. Låtsas att det är ditt konto på
GitHub och skicka upp `main` dit:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` kopplar ihop din `main` med `origin/main`, så att `git status` kan
berätta om du ligger före eller efter servern och så att det sedan räcker
att skriva bara `git push` och `git pull`.

## Sammanfattning

| Kommando | Gör |
|---|---|
| `git init` | Gör katalogen till ett repo |
| `git status` | Visar läget – kör det ofta! |
| `git add FIL` / `git add .` | Lägger ändringar i indexet |
| `git commit -m "…"` | Sparar indexet som en ny commit |
| `git diff` / `git diff --staged` | Visar ändringar som inte är committade |
| `git log --oneline --graph --all` | Visar historiken |
| `git restore FIL` | Kastar bort ändringar i en fil |
| `git switch -c GREN` | Skapar en gren och byter till den |
| `git merge GREN` | Slår ihop en gren med den du står på |
| `git clone`, `git pull`, `git push` | Samarbetar via ett fjärr-repo |
