# Examen : Autres outils

Quatorze questions sur git et les autres shells. Il faut 80 % de bonnes
réponses pour réussir. Les questions avec des commandes démarrent dans un
terminal neuf, elles installent donc d'abord le programme dont elles ont
besoin – `> /dev/null 2>&1` jette la sortie de ces lignes.

```quiz
Vous avez modifié `index.html` et créé le nouveau fichier `kontakt.html`.
Vous lancez `git commit -am "Contact page"`. Qu'est-ce qui se retrouve dans
le commit ?
- [x] Seulement la modification de `index.html`
- [ ] Seulement `kontakt.html`
- [ ] Les deux fichiers
---
`-a` ajoute tous les fichiers modifiés que git suit déjà – mais jamais les
nouveaux fichiers. `kontakt.html` doit d'abord être ajouté avec `git add`.
```

```quiz
Vous avez fait `git add` sur une modification de `style.css`. Quelle commande
montre cette modification ?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` compare le répertoire de travail avec l'index, il n'affiche donc
plus rien une fois la modification dans l'index. `--staged` montre ce qui
attend d'être committé.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "Elev Elevsson"
$ git config --global user.email "elev@example.com"
$ cd ~/projekt-webb && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ git switch -c ny-design > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "Lila rubriker" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge ny-design > /dev/null
$ git log --oneline | wc -l
2
---
`main` n'avait pas changé depuis la création de la branche, la fusion a donc
été un *fast-forward* : git a seulement avancé `main` jusqu'au commit de
`ny-design`. Aucun commit de fusion n'a été créé.
```

```quiz
Qu'est-ce qu'une branche dans git, techniquement ?
- [ ] Une copie complète de chaque fichier du projet
- [x] Une étiquette qui pointe vers un commit et avance quand vous créez de nouveaux commits
- [ ] Un dépôt séparé avec son propre répertoire `.git`
---
C'est pourquoi les branches ne coûtent presque rien dans git – utilisez-les
souvent.
```

```quiz
`git merge` s'est arrêté sur un conflit dans `index.html`. Vous avez corrigé
le fichier et supprimé les lignes de marqueurs. Que faites-vous ensuite ?
- [ ] Relancer `git merge`
- [x] `git add index.html` puis `git commit`
- [ ] `git restore index.html`
---
`git add` indique à git que le conflit est résolu, et `git commit` termine la
fusion. `git restore` jetterait votre correction.
```

```quiz
Le fichier `fel.log` a été committé par erreur. Vous ajoutez `*.log` à
`.gitignore`, mais git suit toujours le fichier. Comment le retirer du dépôt
tout en le gardant sur le disque ?
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
`.gitignore` ne s'applique qu'aux fichiers que git ne suit pas encore.
`--cached` retire le fichier de git mais le laisse sur le disque.
```

```quiz
Quelle commande récupère les nouveaux commits du dépôt distant **sans** les
fusionner avec les vôtres ?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` récupère et fusionne ; `git fetch` ne fait que récupérer.
```

```quiz
Lesquelles de ces modifications sont perdues pour de bon ? Choisissez toutes
les bonnes réponses.
- [x] Les modifications d'un fichier qui n'ont jamais été committées, jetées avec `git restore`
- [x] Des modifications jamais committées, jetées avec `git reset --hard`
- [ ] Un commit que vous avez fait hier, avant de lancer `git reset --hard`
---
Tout ce qui a été committé à un moment donné peut presque toujours être
récupéré – `git reflog` montre où vous êtes passé.
```

```quiz
Vous avez lancé zsh depuis bash. Quelle commande montre le shell que vous
utilisez en ce moment ?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` est votre shell de connexion – toujours `/bin/bash`. `/etc/shells`
liste les shells qui peuvent servir de shell de connexion.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` gère les nombres décimaux.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
Dans fish, le code de retour de la dernière commande s'appelle `$status` –
`false` échoue toujours.
```

```quiz
Comment faire de `EDITOR` une variable d'environnement de valeur `nano` dans fish ?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` exporte la variable ; `-e` l'efface.
```

```quiz
Quel fichier zsh lit-il au démarrage ?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep elev /etc/passwd
---
Le dernier champ de la ligne est votre shell de connexion – celui que
`chsh -s` modifie.
```
