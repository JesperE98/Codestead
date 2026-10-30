# Faktagranskning: git (Git i terminalen)

Status: **ogranskad**

Texten är omskriven så att den gäller Ubuntu (terminalen utanför distro-delen) och har fått
kontrollfrågor. Inget påstående nedan är ännu kontrollerat mot en officiell källa.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Git skrevs 2005 av Linus Torvalds för att hantera Linuxkärnans källkod | | ogranskad | 2026-10-30 |
| Git är det överlägset vanligaste versionshanteringssystemet | | ogranskad | 2026-10-30 |
| Grafiska program och editorer kör samma git-kommandon under huven | | ogranskad | 2026-10-30 |
| Git är inte alltid förinstallerat; på Ubuntu installeras det med `sudo apt update` och `sudo apt install git` | | ogranskad | 2026-10-30 |
| Paketet heter `git` även i andra distributioner | | ogranskad | 2026-10-30 |
| `git --version` visar versionen; alla kommandon har formen `git KOMMANDO`; manualen finns med `man git` | | ogranskad | 2026-10-30 |
| Varje commit innehåller namn och e-postadress för den som gjorde den | | ogranskad | 2026-10-30 |
| `git config --global user.name/user.email` gäller alla projekt och sparas i `~/.gitconfig` (format `[user]`, `name = …`, `email = …`) | | ogranskad | 2026-10-30 |
| Utan identitet skriver git `*** Please tell me who you are.` och föreslår de två `git config`-kommandona | | ogranskad | 2026-10-30 |
| `git config --global init.defaultBranch main` ger nya repon huvudgrenen `main`; äldre versioner av git kallar den `master` | | ogranskad | 2026-10-30 |
| `git init` skriver `Initialized empty Git repository in …/.git/` och skapar bara den dolda katalogen `.git`, där hela historiken finns; vanliga filer rörs inte | | ogranskad | 2026-10-30 |
| Tar man bort `.git` slutar projektet använda git; filerna finns kvar men historiken försvinner (kontrollfråga 1) | | ogranskad | 2026-10-30 |
| En ändring går genom arbetskatalogen, indexet (*staging area*) och historiken; en commit är en ögonblicksbild med meddelande, författare och tid | | ogranskad | 2026-10-30 |
| Bara det som ligger i indexet kommer med i nästa commit, så man kan välja vilka ändringar som committas (kontrollfråga 2) | | ogranskad | 2026-10-30 |
| `git status` visar *Untracked files* och *Changes to be committed* med texterna i kapitlet; i en riktig terminal i rött respektive grönt | | ogranskad | 2026-10-30 |
| `git add .` lägger till allt i aktuell katalog; `git add -A` alla ändringar i hela repot | | ogranskad | 2026-10-30 |
| `git commit -m` anger meddelandet; utskriften visar `(root-commit)` för första committen | | ogranskad | 2026-10-30 |
| En commits id är en 40 tecken lång hash beräknad från innehållet; tid och namn ingår; de första sju tecknen räcker oftast | | ogranskad | 2026-10-30 |
| `nothing to commit, working tree clean` betyder att allt är sparat | | ogranskad | 2026-10-30 |
| `git diff` jämför arbetskatalogen med indexet; `git diff --staged` visar det som ligger i indexet | | ogranskad | 2026-10-30 |
| I diff-utskriften är `+` nya rader och `-` borttagna; `@@ -1,3 +1,4 @@` betyder rad 1–3 i gamla och 1–4 i nya versionen | | ogranskad | 2026-10-30 |
| `git commit -a` kör `git add` på alla filer git redan följer, men tar inte med nya filer | | ogranskad | 2026-10-30 |
| `git commit` utan något i indexet skapar ingen commit (kontrollfråga 3: `git log --oneline \| wc -l` ger 1) | | ogranskad | 2026-10-30 |
| Råd om commit-meddelanden: kort första rad, helst under 50 tecken; vad och varför; en sak per commit; varje `-m` blir ett eget stycke; engelska meddelanden skrivs oftast i imperativ | | ogranskad | 2026-10-30 |
| `git log` visar nyaste commit först; `HEAD -> main` betyder att man står på `main` och att det är dess senaste commit | | ogranskad | 2026-10-30 |
| `--oneline`, `-n 1`, `--stat`, `git show` och `git show HEAD~1:README.md` fungerar som beskrivet; `HEAD~1` är committen före den senaste | | ogranskad | 2026-10-30 |
| `git restore FIL`, `git restore --staged FIL`, `git commit --amend -m`, `git reset --hard` gör det som tabellen säger | | ogranskad | 2026-10-30 |
| Ändringar som aldrig committats och slängs med `git restore`/`git reset --hard` går inte att få tillbaka; det som committats går nästan alltid att rädda med `git reflog` | | ogranskad | 2026-10-30 |
| En gren är en etikett som pekar på en commit och flyttas med nya commits; grenar är billiga | | ogranskad | 2026-10-30 |
| `git switch -c GREN` skapar grenen och byter till den; stjärnan i `git branch` visar var man står | | ogranskad | 2026-10-30 |
| Vid grenbyte skriver git om arbetskatalogen så att den ser ut som grenens senaste commit (kontrollfråga 4) | | ogranskad | 2026-10-30 |
| `git checkout` gör samma sak som `switch` men kan också återställa filer; `switch` och `restore` delar upp jobben | | ogranskad | 2026-10-30 |
| Ocommittade ändringar följer med vid grenbyte om de inte krockar; annars vägrar git; `git stash`/`git stash pop` | | ogranskad | 2026-10-30 |
| *Fast-forward* när `main` inte ändrats sedan grenen skapades; annars trevägssammanslagning med en merge-commit med två föräldrar | | ogranskad | 2026-10-30 |
| `git log --oneline --graph --all` visar hur historiken delar sig och går ihop | | ogranskad | 2026-10-30 |
| `git branch -d` vägrar om grenen har commits som inte finns i den man står på | | ogranskad | 2026-10-30 |
| Konfliktutskriften (`CONFLICT (content): Merge conflict in …`), `both modified` under *Unmerged paths* | | ogranskad | 2026-10-30 |
| Mellan `<<<<<<< HEAD` och `=======` står versionen från grenen man står på, efter `=======` den andra grenens (kontrollfråga 5) | | ogranskad | 2026-10-30 |
| En konflikt löses genom att redigera filen, `git add FIL` och `git commit` | | ogranskad | 2026-10-30 |
| `git checkout --ours/--theirs FIL` väljer en sidas version; `git merge --abort` avbryter sammanslagningen | | ogranskad | 2026-10-30 |
| `.gitignore`: `*` matchar vad som helst, avslutande `/` betyder en hel katalog; filen själv ska committas | | ogranskad | 2026-10-30 |
| `.gitignore` gäller bara filer som git inte redan följer; `git rm --cached FIL` tar bort filen ur repot men inte från disken | | ogranskad | 2026-10-30 |
| GitHub, GitLab och Codeberg är kända tjänster för fjärrepon | | ogranskad | 2026-10-30 |
| `git clone`, `git push`, `git pull` (hämtar och slår ihop), `git fetch` (hämtar utan att slå ihop), `git remote -v` | | ogranskad | 2026-10-30 |
| Fjärrepot heter oftast `origin`; GitHub och GitLab loggar in med SSH-nyckel eller åtkomsttoken, inte lösenord | | ogranskad | 2026-10-30 |
| `clone`, `push` och `pull` fungerar mellan två repon på samma dator | | ogranskad | 2026-10-30 |
| Ett *bare* repo har bara historiken och skapas med `git init --bare` | | ogranskad | 2026-10-30 |
| `git push -u origin main` kopplar `main` till `origin/main` så att `git status` visar före/efter och vanliga `git push`/`git pull` räcker | | ogranskad | 2026-10-30 |
