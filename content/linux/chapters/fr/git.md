# Git dans le terminal

Vous est-il déjà arrivé d'enregistrer des fichiers nommés `rapport-final.txt`,
`rapport-final-2.txt` et `rapport-VRAIMENT-final.txt` ? Alors vous avez fait
de la *gestion de versions* à la main. Un système de gestion de versions fait
la même chose, mais proprement : il enregistre des instantanés de tout le
projet, se souvient de qui a changé quoi et pourquoi, vous permet de remonter
le temps et permet à plusieurs personnes de travailler sur les mêmes fichiers
en même temps.

**Git** est de loin le système de gestion de versions le plus répandu. Il a
été écrit en 2005 par Linus Torvalds – celui-là même qui a écrit le noyau
Linux – pour gérer le code source du noyau. Aujourd'hui, git sert pour presque
tous les logiciels, mais il fonctionne tout aussi bien pour des pages web, des
fichiers de configuration, des notes ou des livres. Tout ce qui est du texte
lui convient parfaitement.

Git est pensé pour le terminal. Les programmes graphiques et les éditeurs ont
des boutons git, mais en coulisse, ils lancent les mêmes commandes que celles
que vous apprenez ici.

## Installer git

Git n'est pas toujours préinstallé. Dans le terminal Ubuntu, on l'installe
avec apt :

```sh
sudo apt update
sudo apt install git
```

Les autres distributions l'installent avec leur propre gestionnaire de
paquets, comme vous l'avez appris dans la partie consacrée aux distributions
et aux paquets – le paquet s'y appelle aussi `git`. Vérifiez qu'il
fonctionne :

```sh
git --version
```

Toutes les commandes git ont la forme `git COMMANDE`, par exemple `git status`
ou `git log`. Le manuel est disponible avec `man git`.

## Dites à git qui vous êtes

Chaque version enregistrée dans git contient le nom et l'adresse e-mail de la
personne qui l'a créée. C'est pourquoi git veut savoir qui vous êtes avant que
vous puissiez enregistrer quoi que ce soit. On le règle une fois par
ordinateur :

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

N'hésitez pas à utiliser votre propre nom. `--global` signifie que le réglage
s'applique à tous vos projets. Il est enregistré dans le fichier texte
ordinaire `~/.gitconfig` :

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

Si vous oubliez cette étape, git se plaint quand vous essayez d'enregistrer :
`*** Please tell me who you are.` – et vous propose exactement ces deux
commandes.

> **Astuce :** ajoutez aussi `git config --global init.defaultBranch main`. La
> branche principale de chaque nouveau projet s'appellera alors `main` sur
> tous vos ordinateurs. Les anciennes versions de git l'appellent `master`, et
> vous croiserez les deux noms dans la nature.

## Un nouveau dépôt

Votre répertoire personnel contient un petit projet web, `~/{{webProject}}`,
avec trois fichiers. Allez-y et jetez un œil :

```sh
cd ~/{{webProject}}
ls
```

Pour que git commence à suivre le répertoire, transformez-le en **dépôt**
(*repository*, ou *repo* pour faire court) :

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

La seule chose qui s'est passée, c'est la création d'un répertoire caché,
`.git`. C'est là que git conserve tout l'historique. Git ne touche pas à vos
fichiers.

```sh
ls -a
ls .git
```

Ne supprimez jamais `.git`, à moins de vouloir perdre l'historique – et ne
modifiez pas les fichiers qu'il contient à la main. Si vous voulez arrêter
d'utiliser git dans un projet, il suffit de supprimer `.git` ; vos fichiers
ordinaires restent.

```quiz
Vous voulez arrêter d'utiliser git dans un projet, mais garder tous vos fichiers. Que faites-vous ?
- [ ] Relancer `git init`
- [x] Supprimer le répertoire caché `.git`
- [ ] Supprimer tous les fichiers sauf `.git`
---
Tout l'historique se trouve dans `.git`, et git ne touche pas à vos fichiers
ordinaires. Sans `.git`, les fichiers restent – seul l'historique disparaît.
```

## Trois endroits : répertoire de travail, index et historique

Le plus important à comprendre dans git, c'est qu'une modification passe par
trois endroits :

```text
 répertoire de travail ──git add──▶  index  ──git commit──▶  historique
 (vos fichiers)                (prochain commit)               (.git)
```

- Le **répertoire de travail** (*working tree*), ce sont les fichiers tels
  qu'ils sont en ce moment, ceux que vous modifiez.
- L'**index** (aussi appelé *staging area*, ou zone de préparation) est une
  sorte de table d'emballage. C'est là que vous placez ce qui doit entrer dans
  la prochaine version enregistrée.
- L'**historique** est constitué de **commits**. Un commit est un instantané
  enregistré de tous les fichiers, avec un message, un auteur et une date.

Pourquoi cette étape intermédiaire ? Pour que vous puissiez choisir. Si vous
avez modifié cinq fichiers mais que seuls deux vont ensemble, vous pouvez
mettre ces deux-là dans l'index, les committer et garder le reste pour un
commit à part.

```quiz
Vous avez modifié cinq fichiers, mais seules deux des modifications vont
ensemble. Comment enregistrer uniquement ces deux-là dans un commit ?
- [ ] Lancer d'abord `git commit`, puis `git add` sur les deux fichiers
- [x] Lancer `git add` sur les deux fichiers, puis `git commit`
- [ ] Committer les cinq – un commit prend toujours tous les fichiers modifiés
---
Un commit enregistre ce qui se trouve dans l'index. Les trois autres
modifications restent dans le répertoire de travail jusqu'à ce que vous les
ajoutiez.
```

## `git status` est votre boussole

La commande que vous lancerez le plus souvent est `git status`. Elle vous dit
où se trouve chaque modification – et vous suggère souvent quoi faire
ensuite. Mieux vaut la lancer trop souvent que pas assez !

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

Les *untracked files* (fichiers non suivis) sont des fichiers que git voit
mais qu'il ne suit pas encore. Dans un vrai terminal, ils s'affichent en
rouge. Placez-les dans l'index avec `git add` :

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

Les voilà listés sous *Changes to be committed* – en vert. Au lieu de nommer
chaque fichier, vous pouvez taper `git add .`, qui ajoute tout ce qui se
trouve dans le répertoire courant (le point signifie « ici »). `git add -A`
ajoute toutes les modifications de l'ensemble du dépôt.

## Le premier commit

Enregistrez l'instantané avec `git commit`. L'option `-m` donne le message :

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

`3f2a9c1` est le début de
l'**identifiant** du commit – un *hash* de 40 caractères calculé à partir du
contenu. Le vôtre sera différent, puisque la date et votre nom en font partie.
Les sept premiers caractères suffisent généralement à identifier un commit.

Relancez `git status` :

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* signifie que tout est enregistré. Bien joué !

## Voir ce qui a changé : `git diff`

Ajoutez une ligne à `README.md` et demandez à git ce qui s'est passé :

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index fd866ad..2278ef6 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 Un petit site web que je gère avec git.
+{{builtWith}}
```

La ligne qui commence par `+` est nouvelle (en vert), les lignes qui
commencent par `-` ont été supprimées (en rouge) et le reste est affiché pour
le contexte. `@@ -1,3 +1,4 @@` signifie que les lignes 1 à 3 de l'ancienne
version correspondent aux lignes 1 à 4 de la nouvelle.

`git diff` compare le répertoire de travail avec l'index – c'est-à-dire ce que
vous n'avez *pas encore* ajouté. Pour voir ce qui attend dans l'index d'être
committé, tapez `git diff --staged`.

Ajoutez et committez la modification. L'option `-a` lance `git add` sur tous
les fichiers que git suit déjà, ce qui ne prend qu'une seule étape :

```sh
git commit -a -m "{{commitDescribe}}"
```

Notez que `-a` n'inclut *pas* les nouveaux fichiers que git ne suit pas
encore. Ceux-là, il faut toujours les ajouter d'abord avec `git add`.

Les questions avec des commandes de ce chapitre démarrent dans un terminal
neuf, elles installent donc d'abord git et font le premier commit.
`> /dev/null 2>&1` jette la sortie de ces lignes, comme vous l'avez appris
dans le chapitre sur les redirections et les pipes. Qu'affiche la dernière
commande ?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Première version" > /dev/null
$ echo 'Encore une ligne.' >> README.md
$ git commit -m "Encore une ligne" > /dev/null
$ git log --oneline | wc -l
1
---
Le second commit n'a jamais eu lieu : la modification de `README.md` n'était
pas dans l'index, il n'y avait donc rien à committer. Un `git add README.md`
d'abord – ou `git commit -a` – aurait donné deux commits.
```

## De bons messages de commit

Dans six mois, ce sont les messages de commit qui raconteront l'histoire – à
vous et aux autres. Quelques règles empiriques :

- Écrivez une première ligne courte, de préférence moins de 50 caractères, qui
  résume la modification.
- Décrivez *ce que* fait la modification et de préférence *pourquoi*, pas
  *comment* vous l'avez écrite.
- Un commit doit faire une seule chose. Trois petits commits valent mieux
  qu'un gros.
- Besoin d'en dire plus ? Laissez une ligne vide et écrivez un texte plus long
  en dessous. Chaque `-m` devient un paragraphe à part :
  `git commit -m "Titre" -m "Explication."`

| Mauvais | Mieux |
|---|---|
| `fix` | `Corrige le lien cassé vers la page de contact` |
| `changements` | `Agrandit les titres sur mobile` |
| `asdf` | `Ajoute un formulaire de contact` |

En anglais, les messages s'écrivent généralement à l'impératif : *Add contact
form*, *Fix broken link*. Cela se lit comme « ce commit va … ». En français,
on utilise souvent la troisième personne (*Ajoute…*, *Corrige…*) ou
l'infinitif (*Ajouter…*) – l'essentiel est de rester cohérent.

## Consulter l'historique

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

Le commit le plus récent vient en premier. `HEAD -> main` signifie que vous
êtes sur la branche `main` et que c'est son dernier commit. Quelques variantes
utiles :

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` donne une ligne par commit, `-n 1` n'affiche que le dernier,
`--stat` montre quels fichiers ont changé et `git show` affiche un commit avec
la modification elle-même. Vous pouvez aussi regarder un fichier tel qu'il
était dans un commit donné : `git show HEAD~1:README.md` (`HEAD~1` signifie
« le commit avant le dernier »).

## Annuler

Avec git, annuler est facile – c'est la moitié de l'intérêt :

| Si vous voulez … | Commande |
|---|---|
| jeter les modifications d'un fichier (pas encore ajoutées) | `git restore FICHIER` |
| retirer un fichier de l'index (la modification reste) | `git restore --staged FICHIER` |
| changer le message du dernier commit | `git commit --amend -m "Nouveau message"` |
| revenir à l'état exact du dernier commit | `git reset --hard` |

Essayez d'abîmer un fichier et de le récupérer :

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **Attention !** `git restore FICHIER` et `git reset --hard` jettent des
> modifications qui n'ont jamais été committées. Elles ne peuvent pas être
> récupérées. En revanche, tout ce qui a été committé à un moment donné peut
> presque toujours être sauvé – demandez à `git reflog` par où vous êtes
> passé.

## Les branches

Une **branche** est une ligne de développement séparée. Vous pouvez essayer
une nouvelle idée dans une branche sans toucher à la version qui fonctionne
dans `main`. Si le résultat est bon, vous fusionnez la branche dans `main` ;
sinon, vous la jetez.

Techniquement, une branche n'est qu'une étiquette qui pointe vers un commit et
qui avance quand vous créez de nouveaux commits. C'est pourquoi les branches
ne coûtent presque rien dans git – utilisez-les souvent !

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` crée la branche et bascule
dessus. L'étoile dans `git branch` indique où vous êtes. Faites une
modification et committez-la sur la branche :

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

Revenez sur `main` et regardez `style.css` :

```sh
git switch main
tail -3 style.css
```

La couleur violette a disparu ! Quand vous changez de branche, git réécrit le
répertoire de travail pour qu'il ressemble au dernier commit de la branche. La
modification est en sécurité dans `{{newDesign}}`. `git log --oneline --all`
affiche toutes les branches :

```sh
git log --oneline --all
```

> **Astuce :** les anciens guides utilisent souvent `git checkout {{newDesign}}`
> et `git checkout -b nouvelle-branche`. `checkout` fait la même chose que
> `switch`, mais sait aussi restaurer des fichiers. Les commandes plus
> récentes `switch` et `restore` se partagent ces tâches et sont plus faciles
> à retenir.

Les modifications non committées vous suivent quand vous changez de branche –
sauf si elles entrent en conflit avec l'autre branche. Dans ce cas, git refuse
et vous demande de committer d'abord (ou de mettre les modifications de côté
temporairement avec `git stash` et de les récupérer avec `git stash pop`).

Combien de lignes contenant `purple` le fichier `style.css` a-t-il à la fin ?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Première version" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ grep purple style.css | wc -l
0
---
La ligne violette a été committée sur `{{newDesign}}`. Quand vous passez sur
`main`, git rend le répertoire de travail identique au dernier commit de
`main` – où la ligne n'existe pas encore.
```

## Fusionner des branches : `git merge`

Placez-vous sur la branche qui doit *recevoir* les modifications – ici `main`
– et fusionnez :

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* (avance rapide) signifie que `main` n'a pas changé depuis la
création de la branche. Git n'a alors qu'à avancer `main` jusqu'au même commit
que `{{newDesign}}`.

Si les deux branches ont de nouveaux commits, git fait une **fusion à trois
points** (*three-way merge*) : il compare les deux branches avec leur ancêtre
commun et crée un nouveau *commit de fusion* (*merge commit*) avec deux
parents. `git log --oneline --graph --all` montre comment l'historique se
sépare puis se rejoint :

```text
*   e4b1d0a (HEAD -> main) Merge branch 'titre'
|\
| * 7c3f9e2 (titre) Titre plus accueillant
* | 52d8a71 Texte plus court
|/
* c19e2f4 {{commitPurple}}
```

Une branche fusionnée n'est plus nécessaire et peut être supprimée. `-d`
refuse si la branche contient des commits qui ne sont pas dans celle où vous
êtes :

```sh
git branch -d {{newDesign}}
```

## Les conflits

Si les deux branches ont modifié *les mêmes lignes*, git ne peut pas savoir
quelle version est la bonne. On appelle cela un **conflit**, et c'est alors à
vous de décider. Créons-en un exprès :

```sh
git switch -c titre
sed -i 's/Bienvenue !/Bonjour et bienvenue !/' index.html
git commit -am "Titre plus accueillant"
git switch main
sed -i 's/Bienvenue !/Bienvenue sur mon site !/' index.html
git commit -am "Titre plus long"
git merge titre
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Pas de panique – rien n'est cassé. `git status` liste le fichier sous
*Unmerged paths* comme `both modified`. Regardez dedans :

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>Bienvenue sur mon site !</h1>
=======
  <h1>Bonjour et bienvenue !</h1>
>>>>>>> titre
```

Entre `<<<<<<< HEAD` et `=======` se trouve votre version (celle de la branche
où vous êtes) ; entre `=======` et `>>>>>>> titre`, celle de l'autre branche.
Voici comment résoudre le conflit :

1. Ouvrez le fichier dans un éditeur et mettez-le dans l'état voulu – gardez
   l'une des lignes, ou combinez-les – et supprimez les lignes de marqueurs.
2. Indiquez à git que le conflit est résolu avec `git add FICHIER`.
3. Terminez la fusion avec `git commit`.

Le simulateur n'a pas de véritable éditeur, mais si vous voulez simplement
choisir la version de l'un des deux côtés, git peut le faire pour vous :
`--ours` prend votre version et `--theirs` celle de l'autre branche.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Fusionner la branche titre"
```

Si vous changez d'avis au milieu d'un conflit, `git merge --abort` vous ramène
là où vous étiez avant la fusion.

Les conflits sont tout à fait normaux quand plusieurs personnes travaillent
sur le même projet. Un bon moyen d'en avoir moins, c'est de faire de petits
commits et de fusionner souvent.

```quiz
Vous êtes sur `main` et lancez `git merge titre`. Le fichier a un conflit :

    <<<<<<< HEAD
      <h1>Hello!</h1>
    =======
      <h1>Welcome!</h1>
    >>>>>>> titre

Quelle ligne vient de `main` ?
- [x] `<h1>Hello!</h1>`
- [ ] `<h1>Welcome!</h1>`
---
`HEAD` est la branche sur laquelle vous êtes – ici `main`. Sa version se
trouve entre `<<<<<<< HEAD` et `=======` ; la version de l'autre branche vient
après `=======`.
```

## Les fichiers que git doit ignorer : `.gitignore`

Certains fichiers ne devraient jamais finir dans l'historique : mots de passe
et clés, journaux, fichiers temporaires et tout ce qui est généré
automatiquement. Écrivez leurs noms ou des motifs dans le fichier `.gitignore`
à la racine du dépôt :

```sh
echo 'password=secret' > secret.txt
echo 'error' > erreur.log
printf 'secret.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`secret.txt` et `erreur.log` ne sont plus
affichés – même `git add .` ne les prend pas. Un `*` correspond à n'importe
quoi, et une barre oblique finale (`build/`) désigne un répertoire entier.
`.gitignore` lui-même, en revanche, doit être committé, pour que tous ceux qui
travaillent sur le projet ignorent les mêmes choses :

```sh
git add .gitignore
git commit -m "Ignorer les secrets et les journaux"
```

Notez que `.gitignore` ne s'applique qu'aux fichiers que git ne suit pas
encore. Si un fichier a déjà été committé, retirez-le du dépôt (mais pas du
disque) avec `git rm --cached FICHIER`.

## GitHub, GitLab et dépôts distants

Jusqu'ici, tout se trouvait dans votre propre dépôt. Pour collaborer, ou
simplement pour avoir une sauvegarde, on garde généralement une copie du dépôt
sur un serveur – un **dépôt distant** (*remote*). Les services les plus connus
sont **GitHub**, **GitLab** et **Codeberg**.

| Commande | Effet |
|---|---|
| `git clone URL` | Télécharge un dépôt entier, avec tout l'historique, dans un nouveau répertoire |
| `git push` | Envoie vos nouveaux commits vers le dépôt distant |
| `git pull` | Récupère les nouveaux commits du dépôt distant et les fusionne avec les vôtres |
| `git fetch` | Récupère les nouveaux commits sans rien fusionner |
| `git remote -v` | Liste les dépôts distants |

Le dépôt distant s'appelle généralement `origin`, et une façon de travailler
typique ressemble à ceci : `git pull` quand vous commencez, puis vous
modifiez, `git add` et `git commit` – et pour finir `git push`. GitHub et
GitLab utilisent une clé SSH ou un jeton d'accès pour vous authentifier, pas
un mot de passe.

Tout cela nécessite un réseau, et le simulateur n'en a pas. Mais `clone`,
`push` et `pull` fonctionnent tout aussi bien entre deux dépôts sur le même
ordinateur, vous pouvez donc quand même les essayer. Clonez votre projet dans
un nouveau répertoire :

```sh
cd ~
git clone ~/{{webProject}} ~/copie
cd ~/copie
git log --oneline
git remote -v
```

Un serveur comme GitHub n'a que l'historique, pas de répertoire de travail. Un
tel dépôt *nu* (*bare*) se crée avec `git init --bare`. Imaginez que c'est
votre compte GitHub et poussez `main` dessus :

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` relie votre `main` à `origin/main`, pour que `git status` puisse vous
dire si vous êtes en avance ou en retard sur le serveur, et pour qu'un simple
`git push` ou `git pull` suffise ensuite.

## Résumé

| Commande | Effet |
|---|---|
| `git init` | Transforme le répertoire en dépôt |
| `git status` | Affiche l'état – lancez-la souvent ! |
| `git add FICHIER` / `git add .` | Place des modifications dans l'index |
| `git commit -m "…"` | Enregistre l'index comme un nouveau commit |
| `git diff` / `git diff --staged` | Affiche les modifications non committées |
| `git log --oneline --graph --all` | Affiche l'historique |
| `git restore FICHIER` | Jette les modifications d'un fichier |
| `git switch -c BRANCHE` | Crée une branche et bascule dessus |
| `git merge BRANCHE` | Fusionne une branche dans celle où vous êtes |
| `git clone`, `git pull`, `git push` | Collaborer via un dépôt distant |
