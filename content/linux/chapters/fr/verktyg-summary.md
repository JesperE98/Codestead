# Résumé : Autres outils

Dans cette partie, vous avez découvert deux outils que vous utiliserez dans
le terminal pour le reste de votre vie : git, qui garde l'historique de vos
fichiers, et d'autres shells que bash. Voici ce qu'il faut retenir avant
l'examen.

## Git dans le terminal

**Git** est un système de gestion de versions : il enregistre des instantanés
de tout le projet, se souvient de qui a modifié quoi et pourquoi, et vous
permet de remonter dans le temps. Sur Ubuntu, on l'installe avec
`sudo apt install git` ; les autres distributions utilisent leur propre
gestionnaire de paquets.

- Avant votre premier commit, vous indiquez à git qui vous êtes avec
  `git config --global user.name` et `user.email`. `--global` signifie tous
  vos projets ; les réglages atterrissent dans `~/.gitconfig`.
- `git init` transforme un répertoire en **dépôt**. Tout l'historique se
  trouve dans le répertoire caché `.git`.
- Une modification passe par trois endroits : le **répertoire de travail**
  (les fichiers que vous voyez), l'**index** (ce qui ira dans le prochain
  commit) et l'**historique** (les commits). `git add` déplace les
  modifications vers l'index, `git commit` enregistre l'index comme un nouveau
  commit.
- `git commit -a` ajoute tous les fichiers modifiés que git suit déjà – mais
  jamais les nouveaux fichiers.
- `git diff` montre les modifications qui ne sont pas encore dans l'index ;
  `git diff --staged` montre ce qui est dans l'index.
- Une **branche** est une étiquette qui pointe vers un commit et avance avec
  les nouveaux commits. Quand vous changez de branche, git réécrit le
  répertoire de travail.
- `git merge` fusionne une branche dans celle où vous êtes. Si les deux
  branches ont modifié les mêmes lignes, vous obtenez un **conflit** :
  corrigez le fichier, faites `git add` dessus et terminez avec `git commit`.
- `.gitignore` liste les fichiers que git ne doit pas suivre. Il ne
  s'applique qu'aux fichiers que git ne suit pas encore.
- Un **dépôt distant** (*remote*) est une copie du dépôt ailleurs,
  généralement appelée `origin`. `git pull` récupère et fusionne, `git push`
  envoie vos commits.

| Commande | Fait |
|---|---|
| `git config --global user.name "…"` | Indiquer votre nom à git (et `user.email`) |
| `git init` | Transformer le répertoire en dépôt |
| `git status` | Montrer où se trouve chaque modification |
| `git add FILE` / `git add .` | Mettre des modifications dans l'index |
| `git commit -m "…"` | Enregistrer l'index comme un nouveau commit |
| `git commit -am "…"` | Ajouter tous les fichiers suivis et committer en une étape |
| `git diff` / `git diff --staged` | Montrer les modifications non committées |
| `git log --oneline --graph --all` | Montrer l'historique |
| `git restore FILE` | Jeter les modifications d'un fichier |
| `git restore --staged FILE` | Retirer un fichier de l'index |
| `git switch -c BRANCH` / `git switch BRANCH` | Créer une branche / changer de branche |
| `git merge BRANCH` | Fusionner une branche dans celle où vous êtes |
| `git branch -d BRANCH` | Supprimer une branche fusionnée |
| `git rm --cached FILE` | Ne plus suivre un fichier mais le garder sur le disque |
| `git clone`, `git pull`, `git push` | Collaborer via un dépôt distant |

## D'autres shells : zsh et fish

Le **shell** lit ce que vous tapez et lance d'autres programmes. Des
programmes comme `ls` et `grep` fonctionnent de la même façon dans tous les
shells – ce qui diffère, c'est le langage qui les entoure : variables,
boucles, conditions et invite.

- `/etc/shells` liste les shells qui peuvent servir de shell de connexion.
  Votre shell de connexion est le dernier champ de votre ligne dans
  `/etc/passwd` et se trouve aussi dans `$SHELL`. `$0` contient le shell que
  vous utilisez en ce moment.
- **zsh** comprend presque toute la syntaxe de bash et ajoute des commodités :
  `**/` cherche dans tous les sous-répertoires, et avec `autocd`, vous allez
  dans un répertoire en tapant simplement son nom. Les options s'activent et
  se désactivent avec `setopt` et `unsetopt`. Contrairement à bash, zsh ne
  découpe pas les variables sans guillemets aux espaces.
- **fish** est facile à utiliser dès le départ mais a **sa propre syntaxe** :
  `set` au lieu de `=`, `$status` au lieu de `$?`, `math` au lieu de
  `$((...))`, et chaque bloc se termine par `end`. Chaque variable est une
  liste, numérotée à partir de 1.
- Un shell lancé tourne **à l'intérieur** de bash ; `exit` vous y ramène.
  Avec `-c`, un shell exécute une seule commande puis se termine.
- Les scripts s'écrivent toujours pour bash (ou pour le `sh` POSIX) : c'est la
  ligne `#!` qui décide quel shell exécute un script, quel que soit le shell
  dans lequel vous êtes.
- `chsh -s` change votre shell de connexion. Le changement prend effet à la
  prochaine connexion.

| Commande | Fait |
|---|---|
| `cat /etc/shells` | Lister les shells utilisables |
| `echo $0` / `ps` | Voir quel shell vous utilisez en ce moment |
| `echo $SHELL` | Voir votre shell de connexion |
| `zsh` / `fish` / `exit` | Lancer un autre shell / revenir |
| `zsh -c '…'` / `fish -c '…'` | Exécuter une commande dans un autre shell |
| `setopt autocd` / `unsetopt autocd` | Activer / désactiver une option de zsh |
| `set frukt äpple` / `set -e frukt` | Définir / supprimer une variable dans fish |
| `set -x NAME value` | Définir une variable d'environnement dans fish |
| `math 17 x 23` | Arithmétique dans fish |
| `chsh -s /usr/bin/zsh` | Changer votre shell de connexion |

Les fichiers de configuration : `~/.bashrc` (bash), `~/.zshrc` (zsh) et
`~/.config/fish/config.fish` (fish).
