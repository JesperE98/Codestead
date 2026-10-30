# Les scripts shell

Tout ce que vous avez tapé dans le terminal jusqu'ici peut aussi être
enregistré dans un fichier et exécuté encore et encore. Un tel fichier
s'appelle un **script**. Les scripts vous permettent d'automatiser les tâches
ennuyeuses : sauvegardes, renommage d'une centaine de fichiers ou
vérification des logs chaque matin. En plus, bash est un vrai langage de
programmation, avec des variables, des conditions, des boucles et des
fonctions.

## Un premier script

Un script est un fichier texte ordinaire. Sur un vrai ordinateur, vous
l'écririez dans un éditeur de texte comme `nano` ou `vim`. Une autre méthode,
qui fonctionne aussi bien ici que sur les serveurs, est le **here document** :
tout ce qui se trouve entre `<< 'SLUT'` et la ligne `SLUT` est envoyé à la
commande. (*Slut* signifie simplement « fin » en suédois – vous pouvez
choisir le mot que vous voulez, `EOF` est un choix courant.)

Tapez la première ligne et appuyez sur Entrée. L'invite devient `> ` – le
shell attend la suite. Tapez les lignes une par une et terminez par `SLUT` :

```sh
cat > hej.sh << 'SLUT'
#!/bin/bash
echo "Bonjour depuis un script !"
echo "Nous sommes le $(date)"
SLUT
```

La première ligne, `#!/bin/bash`, s'appelle le *shebang* et indique au
système quel programme doit exécuter le fichier. Rendez le script exécutable
et lancez-le :

```sh
chmod +x hej.sh
./hej.sh
```

Les lignes qui commencent par `#` (à part la ligne du shebang) sont des
**commentaires**, que le shell ignore. Servez-vous-en pour expliquer ce que
fait le code !

## Les variables

On crée une variable avec `nom=valeur`. Il ne doit **pas** y avoir d'espace
autour du signe égal – sinon le shell croit que `nom` est une commande.

```sh
stad=Göteborg
echo "J'habite à $stad"
```

(*Stad* signifie « ville ».) Mettez toujours les variables entre **guillemets
doubles** quand vous les utilisez. Sans guillemets, la valeur est découpée
aux espaces, ce qui provoque des erreurs étranges quand un nom de fichier
contient un espace. Si vous voulez écrire du texte juste après le nom de la
variable, utilisez des accolades : `"${stad}_2026"` – sans elles, bash
chercherait une variable nommée `stad_2026`.

```quiz
`stad` contient `Göteborg`, et il n'existe aucune variable nommée `stad_2026`.
Qu'affiche `echo "$stad_2026"` ?
- [ ] `Göteborg_2026`
- [ ] `Göteborg`
- [x] Une ligne vide
---
Bash lit le nom entier `stad_2026`, et cette variable n'existe pas. Écrivez
`"${stad}_2026"` pour obtenir `Göteborg_2026`.
```

## La substitution de commande – `$(...)`

`$(commande)` est remplacé par ce qu'affiche la commande. C'est ainsi qu'on
enregistre le résultat d'une commande dans une variable :

```sh
idag=$(date)
filer=$(ls ~ | wc -l)
echo "Il y a $filer éléments dans votre répertoire personnel"
```

## L'arithmétique – `$(( ))`

Bash fait de l'arithmétique sur les entiers à l'intérieur de `$(( ))`. Entre
les parenthèses, pas besoin de `$` devant les variables :

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) reste $(( 17 % 5 ))
```

Pour modifier une variable, écrivez `(( a++ ))` ou `(( a += 10 ))`.

```predict
$ echo $(( 7 / 2 )) $(( 7 % 2 ))
3 1
---
Bash ne calcule qu'avec des entiers : 7 / 2 donne 3, et le reste (`%`) est 1.
```

## Les arguments

Quand vous lancez `./skript.sh un deux`, le script peut lire les arguments :

| Variable | Contient |
|---|---|
| `$0` | Le nom du script |
| `$1`, `$2` ... | Le premier, le deuxième ... argument |
| `$#` | Le nombre d'arguments |
| `"$@"` | Tous les arguments, chacun séparément |
| `$?` | Le code de retour de la commande précédente |

```quiz
Un script est lancé avec `./skript.sh red green blue`. Que contiennent `$1` et
`$#` ?
- [ ] `$1` vaut `./skript.sh` et `$#` vaut `4`
- [x] `$1` vaut `red` et `$#` vaut `3`
- [ ] `$1` vaut `red` et `$#` vaut `blue`
---
Le nom du script lui-même est dans `$0`, il n'est donc pas compté dans `$#`.
```

## Les conditions – `if`

`if` exécute une commande et regarde son **code de retour** : 0 signifie
vrai, toute autre valeur faux. La plupart du temps, on utilise la commande
`[` (aussi appelée `test`) :

```sh
if [ -f ~/.bashrc ]; then echo "Le fichier existe"; else echo "Le fichier est absent"; fi
```

Les espaces à l'intérieur de `[ ]` sont obligatoires ! Sur plusieurs lignes,
comme dans un script, cela ressemble à ceci :

```text
if [ "$reponse" = "oui" ]; then
    echo "Super !"
elif [ "$reponse" = "non" ]; then
    echo "Dommage."
else
    echo "Répondez par oui ou par non."
fi
```

Les tests les plus courants :

| Test | Vrai si |
|---|---|
| `-f FILE` | le fichier existe (et est un fichier ordinaire) |
| `-d DIR` | le répertoire existe |
| `-z "$x"` | la variable est vide |
| `"$a" = "$b"` | les chaînes sont égales (`!=` différentes) |
| `$a -eq $b` | les nombres sont égaux |
| `$a -lt $b` | inférieur à (`-le`, `-gt`, `-ge`, `-ne`) |
| `! CONDITION` | la condition n'est *pas* vraie |

Remarquez que les nombres se comparent avec `-eq`, `-lt` et ainsi de suite,
tandis que `=` et `<` comparent du texte. Bash dispose aussi de `[[ ... ]]`,
un peu plus malin : on peut y écrire `&&` et `||` et comparer à des motifs
comme `[[ $file == *.txt ]]`.

Pour les conditions courtes, `&&` et `||` suffisent souvent :

```sh
[ -d ~/bilder ] && echo "Le répertoire des images existe"
```

```predict
$ x=""
$ if [ -z "$x" ]; then echo empty; else echo "not empty"; fi
empty
```

## Les boucles

Une **boucle for** fait la même chose pour chaque élément d'une liste :

```sh
for frukt in äpple banan kiwi; do echo "J'aime $frukt"; done
```

La liste peut venir de caractères génériques ou d'une commande :

```sh
for fil in ~/dokument/*; do echo "Fichier : $fil"; done
for i in $(seq 1 3); do echo "Tour $i"; done
```

Une **boucle while** continue tant que la condition est vraie :

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

La façon la plus courante de parcourir un fichier ligne par ligne est
`while read`, en faisant entrer le fichier avec `<` après `done` :

```sh
while read rad; do echo "> $rad"; done < ~/dokument/frukter.txt
```

`break` sort d'une boucle, et `continue` passe directement au tour suivant.

```predict
$ for x in 2 4 6; do echo $(( x * 10 )); done
20
40
60
```

> **Attention aux boucles infinies !** Une boucle dont la condition ne devient
> jamais fausse tourne indéfiniment. Dans un vrai terminal, on l'arrête avec
> **Ctrl+C**. Le simulateur l'arrête tout seul au bout de 20 000 étapes.

## Choisir avec `case`

Quand une variable peut prendre beaucoup de valeurs différentes, `case` est
plus lisible qu'une longue chaîne de `elif` :

```sh
fil=semester.jpg
case $fil in *.jpg|*.png) echo "Une image";; *.txt) echo "Un fichier texte";; *) echo "Type inconnu";; esac
```

Chaque alternative se termine par `;;`, et `*)` attrape tout le reste.

## Les fonctions

Une **fonction** est un morceau de code nommé que vous pouvez appeler comme
une commande à part entière. Elle reçoit des arguments de la même manière
qu'un script – `$1`, `$2` et `$#` :

```sh
halsa() { echo "Bonjour $1, bienvenue !"; }
halsa Kim
```

Les variables qui ne doivent exister qu'à l'intérieur de la fonction se
créent avec `local`, et `return` termine la fonction avec un code de retour.

## Interroger l'utilisateur – `read`

`read` lit une ligne au clavier et la place dans une variable :

```sh
read -p "Comment vous appelez-vous ? " namn; echo "Bonjour $namn !"
```

## Un exemple complet

Voici un script qui utilise l'essentiel de ce que ce chapitre a présenté. Il
sauvegarde les fichiers que vous lui donnez en arguments :

```text
#!/bin/bash
# backup.sh – copie chaque fichier vers fichier.bak

if [ $# -eq 0 ]; then
    echo "Usage : $0 FICHIER..."
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.bak"
        echo "$file copié"
    else
        echo "Impossible de trouver $file" >&2
    fi
done
```

`exit 1` termine le script avec le code de retour 1, pour que celui qui a
appelé le script puisse voir que quelque chose s'est mal passé.

## Conseils pour de bons scripts

- Commencez par `#!/bin/bash` et écrivez des commentaires.
- Mettez les variables entre guillemets : `"$file"`, pas `$file`.
- Beaucoup de gens commencent leurs scripts par `set -euo pipefail`, pour que
  le script s'arrête à la première erreur au lieu de continuer à l'aveugle.
- Le programme **ShellCheck** détecte les erreurs courantes dans les scripts
  bash – vous pouvez l'installer avec le gestionnaire de paquets sur toutes
  les grandes distributions.
