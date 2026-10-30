# Résumé : Scripts et automatisation

Dans cette partie, vous avez transformé des commandes en programmes bien à
vous.

## Les scripts shell

Un script est un fichier texte contenant des commandes, qui commence par le
shebang `#!/bin/bash`. Vous pouvez l'écrire avec un here document
(`cat > file << 'SLUT'`), le rendre exécutable avec `chmod +x` et le lancer
avec `./`. Les lignes qui commencent par `#` sont des commentaires.

On crée des variables avec `name=value` – sans espaces – et on les utilise
entre guillemets doubles : `"$name"`, ou `"${name}_text"` quand du texte suit
immédiatement. `$(command)` est remplacé par ce qu'affiche la commande, et
`$(( ))` fait de l'arithmétique sur des entiers. Un script lit ses arguments
dans `$1`, `$2` …, `$#` et `"$@"`.

`if` regarde le code de retour d'une commande, généralement la commande de
test `[ ]`. Les nombres se comparent avec `-eq`, `-lt` et compagnie ; le texte
avec `=` et `!=`. `for` parcourt une liste, `while` continue tant qu'une
condition est vraie, et `while read` parcourt un fichier ligne par ligne.
`case` choisit entre des motifs, les fonctions sont des morceaux de code
nommés avec leur propre `$1`, et `read` demande une saisie à l'utilisateur.
`exit 1` indique à celui qui a appelé le script que quelque chose s'est mal
passé.

## Commandes et syntaxe

| Syntaxe | Fait |
|---|---|
| `#!/bin/bash` | Le shebang : quel programme exécute le script |
| `cat > file << 'SLUT'` | Écrire des lignes dans un fichier jusqu'à la ligne `SLUT` |
| `name=value` · `"$name"` · `"${name}"` | Créer · utiliser une variable |
| `$(command)` | Remplacé par ce qu'affiche la commande |
| `$(( a * 6 ))` · `(( a++ ))` | Arithmétique sur des entiers · modifier une variable |
| `$0` · `$1` · `$#` · `"$@"` | Le nom du script · premier argument · nombre d'arguments · tous les arguments |
| `if [ ... ]; then ...; elif ...; else ...; fi` | Conditions |
| `-f` · `-d` · `-z` | Le fichier existe · le répertoire existe · la variable est vide |
| `=` · `!=` | Texte égal · différent |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | Comparer des nombres |
| `[[ $file == *.txt ]]` | Le test plus malin de bash, avec des motifs |
| `for x in list; do ...; done` | Boucler sur une liste |
| `while [ ... ]; do ...; done` | Boucler tant que la condition est vraie |
| `while read line; do ...; done < file` | Parcourir un fichier ligne par ligne |
| `break` · `continue` | Quitter la boucle · passer au tour suivant |
| `case $x in pattern) ...;; *) ...;; esac` | Choisir selon un motif |
| `name() { ...; }` · `local` · `return` | Une fonction · variable locale · terminer la fonction |
| `read -p "Question " var` | Lire une ligne au clavier |
| `exit 1` | Terminer le script avec un code de retour |
| `set -euo pipefail` | Arrêter le script à la première erreur |
