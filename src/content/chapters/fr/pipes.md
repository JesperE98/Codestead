# Redirections et pipes

Ce chapitre traite de ce qui rend la ligne de commande si puissante :
*brancher* de petits programmes les uns aux autres.

## Trois flux

Chaque programme dispose de trois flux standard :

| Numéro | Nom | Quoi |
|---|---|---|
| 0 | stdin | L'entrée, normalement depuis le clavier |
| 1 | stdout | La sortie normale, normalement vers l'écran |
| 2 | stderr | Les messages d'erreur, eux aussi vers l'écran |

Avec les *redirections* et les *pipes* (tubes), vous pouvez envoyer ces flux
ailleurs.

## Vers un fichier – `>` et `>>`

`>` envoie stdout dans un fichier au lieu de l'écran. Le fichier est créé s'il
n'existe pas – et **écrasé** s'il existe !

```sh
echo "première ligne" > test.txt
```

`>>` ajoute plutôt à la fin du fichier :

```sh
echo "deuxième ligne" >> test.txt
cat test.txt
```

## Depuis un fichier – `<`

`<` permet à un programme de lire son stdin depuis un fichier :

```sh
wc -l < dokument/frukter.txt
```

## Les messages d'erreur – `2>`

Les messages d'erreur partent sur stderr et ne sont pas concernés par `>`.
Pour les gérer, écrivez le numéro du flux devant :

```sh
ls /finnsinte 2> fel.txt
```

(*Finns inte* signifie « n'existe pas » en suédois, et *fel* veut dire
« erreur ».)

Le fichier `/dev/null` est un « trou noir » – tout ce qu'on y écrit
disparaît. C'est pratique pour faire taire les erreurs. Avec `2>&1`, stderr
est envoyé au même endroit que stdout.

## Les pipes – `|`

Un **pipe** envoie le stdout d'une commande directement dans le stdin de la
suivante. C'est le cœur de la philosophie Unix : *faire une seule chose et la
faire bien, et laisser les programmes travailler ensemble*.

```sh
grep INFO dokument/server.log | wc -l
```

`grep` trouve les lignes et `wc -l` les compte. Vous pouvez en enchaîner
autant que vous voulez :

```sh
sort dokument/frukter.txt | uniq -c | sort -rn
```

Lisez-le étape par étape : on trie les fruits, on compte combien il y en a de
chaque sorte (`uniq -c`), puis on trie numériquement, le plus grand en premier
(`sort -rn`).

## À l'écran et dans un fichier – `tee`

`tee` transmet son entrée plus loin *et* en enregistre une copie dans un
fichier :

```sh
ls /etc | tee etc-lista.txt | wc -l
```

## Enchaînements – `;`, `&&` et `||`

Plusieurs commandes peuvent tenir sur la même ligne :

| Syntaxe | Signifie |
|---|---|
| `a ; b` | Exécuter a, puis b |
| `a && b` | Exécuter b seulement si a a réussi |
| `a \|\| b` | Exécuter b seulement si a a échoué |

```sh
mkdir -p ny && cd ny
```
