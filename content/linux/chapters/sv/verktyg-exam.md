# Prov: Fler verktyg

Fjorton frågor om git och andra skal. Du behöver 80 % rätta svar för
godkänt. Frågorna med kommandon börjar i en ny terminal, så de installerar
först programmet de behöver – `> /dev/null 2>&1` slänger utskriften från de
raderna.

```quiz
Du har ändrat `index.html` och skapat den nya filen `kontakt.html`. Du kör
`git commit -am "Contact page"`. Vad hamnar i commiten?
- [x] Bara ändringen i `index.html`
- [ ] Bara `kontakt.html`
- [ ] Båda filerna
---
`-a` lägger till varje ändrad fil som git redan följer – men aldrig nya filer.
`kontakt.html` måste läggas till med `git add` först.
```

```quiz
Du har kört `git add` på en ändring i `style.css`. Vilket kommando visar den
ändringen?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` jämför arbetskatalogen med indexet, så den visar ingenting när
ändringen väl ligger i indexet. `--staged` visar det som väntar på att
committas.
```

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
$ git merge {{newDesign}} > /dev/null
$ git log --oneline | wc -l
2
---
`main` hade inte ändrats sedan grenen skapades, så sammanslagningen blev en
*fast-forward*: git flyttade bara fram `main` till commiten i `{{newDesign}}`.
Ingen merge-commit skapades.
```

```quiz
Vad är en gren i git, tekniskt sett?
- [ ] En fullständig kopia av varje fil i projektet
- [x] En etikett som pekar på en commit och flyttar med när du gör nya commits
- [ ] Ett separat repo med en egen `.git`-katalog
---
Därför är grenar billiga i git – använd dem ofta.
```

```quiz
`git merge` stannade med en konflikt i `index.html`. Du har rättat filen och
tagit bort markeringsraderna. Vad gör du sedan?
- [ ] Kör `git merge` igen
- [x] `git add index.html` och sedan `git commit`
- [ ] `git restore index.html`
---
`git add` talar om för git att konflikten är löst, och `git commit` avslutar
sammanslagningen. `git restore` skulle kasta bort din rättning.
```

```quiz
Filen `fel.log` committades av misstag. Du lägger till `*.log` i
`.gitignore`, men git följer fortfarande filen. Hur tar du bort den från repot
men behåller den på disken?
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
`.gitignore` gäller bara filer som git inte redan följer. `--cached` tar bort
filen från git men låter den ligga kvar på disken.
```

```quiz
Vilket kommando hämtar nya commits från fjärr-repot **utan** att slå ihop dem
med dina?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` hämtar och slår ihop; `git fetch` bara hämtar.
```

```quiz
Vilka av de här ändringarna är förlorade för gott? Välj alla som stämmer.
- [x] Ändringar i en fil som aldrig committades, bortkastade med `git restore`
- [x] Ändringar som aldrig committades, bortkastade med `git reset --hard`
- [ ] En commit som du gjorde i går, innan du körde `git reset --hard`
---
Allt som någon gång har committats går nästan alltid att rädda –
`git reflog` visar var du har varit.
```

```quiz
Du startade zsh från bash. Vilket kommando visar skalet som du kör just nu?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` är ditt inloggningsskal – fortfarande `/bin/bash`. `/etc/shells`
listar skalen som får användas som inloggningsskal.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` klarar decimaltal.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
I fish heter slutkoden från det senaste kommandot `$status` – `false`
misslyckas alltid.
```

```quiz
Hur gör du `EDITOR` till en miljövariabel med värdet `nano` i fish?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` exporterar variabeln; `-e` tar bort den.
```

```quiz
Vilken fil läser zsh när det startar?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep {{user}} /etc/passwd
---
Det sista fältet på raden är ditt inloggningsskal – det som `chsh -s` ändrar.
```
