# Résumé : Les bases

Vous avez appris les commandes que vous utiliserez tous les jours, sur toutes
les distributions. Voici un petit récapitulatif avant l'examen.

## Naviguer dans le système de fichiers

Tout se trouve dans une seule arborescence qui part de la racine, `/`. Les
réglages sont dans `/etc`, les programmes dans `/usr/bin`, les journaux dans
`/var/log` et vos propres fichiers dans votre répertoire personnel, `~`.
`pwd` montre où vous êtes, `ls` liste ce qui s'y trouve et `cd` vous déplace.
Un chemin **absolu** commence par `/` ; un chemin **relatif** part du
répertoire où vous êtes. `..` est le répertoire du dessus, et `cd` sans
argument vous ramène chez vous.

## Fichiers et répertoires

`mkdir` crée des répertoires (`-p` crée plusieurs niveaux d'un coup) et
`touch` crée des fichiers vides. `cp` copie (`-r` pour des répertoires
entiers), `mv` déplace et renomme à la fois, et `rm` supprime – pour de bon,
il n'y a pas de corbeille. `rmdir` ne supprime que les répertoires vides ;
`rm -r` supprime un répertoire et tout ce qu'il contient. Les jokers comme
`*`, `?` et `[abc]` sont développés par le shell avant que la commande ne
s'exécute, et les noms qui contiennent des espaces ont besoin de guillemets.

## Lire et rechercher du texte

`cat` affiche un fichier et `less` vous permet de le faire défiler. `head` et
`tail` montrent le début et la fin (`-n` choisit le nombre de lignes,
`tail -f` suit un fichier). `wc` compte les lignes, les mots et les octets.
`grep` montre les lignes qui correspondent à un motif, `sort` trie les lignes
et `uniq` supprime les lignes répétées qui se suivent. `man` affiche le
manuel d'une commande. `cut` extrait un champ (`-d` définit le séparateur, `-f` le champ).

## Redirections et pipes

Chaque programme a trois flux : stdin, stdout et stderr. `>` envoie stdout
dans un fichier (et l'écrase), `>>` ajoute à la fin, `<` lit stdin depuis un
fichier et `2>` redirige les messages d'erreur – par exemple vers
`/dev/null`. Un pipe `|` envoie la sortie d'une commande dans la suivante, et
`tee` en garde une copie au passage. `xargs` transforme les mots de son
entrée en arguments pour une commande. `;`, `&&` et `||` lancent plusieurs
commandes sur une seule ligne. `tr` remplace, supprime (`-d`) ou compresse (`-s`) des caractères isolés et ne lit que stdin.

## Commandes et options

| Commande | Ce qu'elle fait | Options et syntaxe de cette partie |
|---|---|---|
| `pwd` | Montre le répertoire où vous êtes | |
| `ls` | Liste le contenu d'un répertoire | `-l` format long, `-a` fichiers cachés aussi |
| `cd` | Change de répertoire | `..` monter, `~` chez vous, `-` le dernier répertoire, sans argument = chez vous |
| `mkdir` | Crée un répertoire | `-p` plusieurs niveaux d'un coup |
| `touch` | Crée un fichier vide | |
| `cp` | Copie | `-r` répertoires entiers |
| `mv` | Déplace ou renomme | |
| `rm` | Supprime | `-r` répertoires et leur contenu, `-f` sans questions |
| `rmdir` | Supprime un répertoire vide | |
| `cat` | Affiche un fichier | |
| `less` | Affiche un fichier page par page | `/mot` recherche, `q` quitte |
| `head` / `tail` | Les premières / dernières lignes | `-n N` nombre de lignes, `tail -f` suit |
| `wc` | Compte lignes, mots et octets | `-l` seulement les lignes |
| `grep` | Montre les lignes correspondantes | `-i`, `-n`, `-v`, `-c`, `-r`, `-E` |
| `sort` | Trie des lignes | `-n` nombres, `-r` ordre inverse |
| `uniq` | Supprime les lignes répétées qui se suivent | `-c` les compte |
| `man` | Affiche la page de manuel | |
| `tee` | Transmet l'entrée et en garde une copie | |
| `xargs` | Transforme son entrée en arguments pour une commande | `-n 1` un à la fois, `-I {}` une ligne à la fois |
| `tr` | Transforme des caractères | `-d` supprimer, `-s` compresser |
| `cut` | Extrait des champs | `-d` séparateur, `-f` champ |

| Syntaxe | Signifie |
|---|---|
| `>` / `>>` | stdout vers un fichier (écraser / ajouter) |
| `<` | stdin depuis un fichier |
| `2>` | stderr vers un fichier, p. ex. `2> /dev/null` |
| `2>&1` | stderr au même endroit que stdout |
| `\|` | Pipe : stdout d'une commande dans stdin de la suivante |
| `a ; b` | Lancer a, puis b |
| `a && b` | Lancer b seulement si a a réussi |
| `a \|\| b` | Lancer b seulement si a a échoué |
| `*`, `?`, `[abc]` | Jokers pour les noms de fichiers |
