# Traitement de texte avec sed, tr et awk

Avec `grep`, vous pouvez *trouver* des lignes. Mais souvent, on veut aller
plus loin : remplacer un mot, supprimer certaines lignes, extraire une colonne
ou additionner des nombres. C'est là qu'interviennent trois outils
classiques :

| Outil | Travaille sur | Usage typique |
|---|---|---|
| `tr` | des **caractères** isolés | passer en majuscules, transformer les `:` en retours à la ligne |
| `sed` | des **lignes** | remplacer un mot, supprimer des lignes |
| `awk` | des **colonnes** (champs) | extraire des colonnes, additionner, compter |

Tous les trois sont des *filtres* : ils lisent du texte, le transforment et
écrivent le résultat sur stdout. Ils se marient donc parfaitement avec les
pipes. Et le fichier d'origine n'est **pas** modifié (à une exception près,
`sed -i`, que nous verrons plus loin).

Dans `{{documents}}` se trouve un troisième fichier d'exercice, un fichier CSV
avec les notes des élèves :

```sh
cat ~/{{documents}}/{{grades}}
```

CSV signifie *comma-separated values* (valeurs séparées par des virgules) –
les colonnes sont séparées par des virgules, et la première ligne est un
en-tête.

## Transformer des caractères – `tr`

`tr` (*translate*) remplace chaque caractère du premier ensemble par le
caractère à la même position dans le second. `a-z` désigne toutes les lettres
de a à z :

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

Vous avez remarqué le é ? `tr` travaille sur des *octets* individuels, et les
lettres comme é – ou è, à et ç – ne font pas partie de `a-z`. C'est
bon à savoir – GNU `awk` (plus bas) s'en sort mieux.

`tr` lit **uniquement** depuis stdin, jamais depuis des fichiers. Pour
utiliser un fichier, faites-le entrer avec `<` ou un pipe :

```sh
tr a-z A-Z < ~/{{documents}}/{{fruits}}
```

Une astuce classique consiste à transformer les deux-points en retours à la
ligne (`\n`), pour que chaque répertoire de `PATH` se retrouve sur sa propre
ligne :

```sh
echo $PATH | tr ':' '\n'
```

Avec `-d` (*delete*), vous supprimez des caractères, et avec `-s` (*squeeze*),
vous réduisez plusieurs caractères identiques consécutifs à un seul :

```sh
echo "070-123 45 67" | tr -d ' -'
echo "beaucoup     trop      espacé" | tr -s ' '
```

```predict
$ echo "hello world" | tr -d o
hell wrld
---
`-d` supprime chaque `o`, où qu'il se trouve.
```

Au lieu de plages, vous pouvez écrire des *classes*, p. ex. `[:upper:]`
(majuscules), `[:lower:]` (minuscules), `[:digit:]` (chiffres) et
`[:space:]` (espaces) :

```sh
echo "Salle 101, étage 3" | tr -d '[:digit:]'
```

## L'éditeur de flux – `sed`

`sed` (*stream editor*) lit le texte ligne par ligne et exécute un petit
*script* sur chaque ligne. La commande la plus courante est `s` –
*substitute*.

### Remplacer du texte – `s`

```sh
sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

Le script `s/ERROR/{{errorWord}}/` signifie : remplacer `ERROR` par
`{{errorWord}}`. Il a la forme

```text
s/MOTIF/REMPLACEMENT/DRAPEAUX
```

Sans drapeau, seule la **première** occurrence de chaque ligne est remplacée.
Avec `g` (*global*), elles le sont toutes :

```sh
echo "cat cat cat" | sed 's/cat/dog/'
echo "cat cat cat" | sed 's/cat/dog/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
Sans `g`, seul le premier `a` de la ligne est remplacé.
```

Le drapeau `i` rend la recherche insensible à la casse, comme `grep -i` :

```sh
sed 's/warn/WARNING/i' ~/{{documents}}/server.log
```

Le motif est une *expression régulière*, comme dans `grep`. Ici, on supprime
la date au début de chaque ligne (`^` = début de ligne, `[0-9-]*` = chiffres
et tirets) :

```sh
sed 's/^[0-9-]* //' ~/{{documents}}/server.log
```

Dans le remplacement, `&` signifie « ce qui a été trouvé » :

```sh
echo "Linux est super" | sed 's/Linux/**&**/'
```

**Un autre délimiteur.** Si le texte lui-même contient des barres obliques,
ça devient vite illisible : `s/\/usr\/local/\/opt/`. Mais c'est le caractère
juste après `s` qui détermine le délimiteur, alors autant utiliser `|` ou
`#` :

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Les groupes.** Avec `-E` (expressions régulières étendues), vous pouvez
capturer des parties de la correspondance avec des parenthèses et les
réutiliser dans le remplacement sous la forme `\1`, `\2` … Ici, on inverse la
date :

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/{{documents}}/server.log
```

### Choisir les lignes – les adresses

Devant une commande, vous pouvez écrire une *adresse* qui choisit les lignes
auxquelles elle s'applique. La commande `d` (*delete*) supprime des lignes et
`p` (*print*) les affiche :

```sh
sed '/INFO/d' ~/{{documents}}/server.log
sed '1d' ~/{{documents}}/{{grades}}
```

La première supprime toutes les lignes contenant `INFO`, la seconde supprime
la ligne 1 – l'en-tête.

Normalement, `sed` affiche *toutes* les lignes. Avec `-n`, il cesse de le
faire, et seul ce que `p` demande est affiché. Voici comment afficher les
lignes 5 à 8 :

```sh
sed -n '5,8p' ~/{{documents}}/server.log
```

| Adresse | Signifie |
|---|---|
| `5` | la ligne 5 |
| `$` | la dernière ligne |
| `/ERROR/` | les lignes qui correspondent au motif |
| `2,4` | les lignes 2 à 4 |
| `/WARN/,/ERROR/` | d'une ligne avec WARN jusqu'à la ligne suivante avec ERROR |
| `/INFO/!` | toutes les lignes **sauf** celles qui correspondent |

Les adresses fonctionnent avec toutes les commandes, y compris `s`. Ici, seules
les lignes d'erreur sont marquées :

```sh
sed '/ERROR/s/^/>>> /' ~/{{documents}}/server.log
```

La commande `q` (*quit*) s'arrête après une ligne donnée – `sed 3q` fait donc
la même chose que `head -n 3`. Pour enchaîner plusieurs commandes, séparez-les
par `;` ou utilisez plusieurs `-e` :

```sh
sed -e '/INFO/d' -e 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

### Modifier le fichier directement – `sed -i`

Jusqu'ici, tout a seulement été *affiché*. Le fichier lui-même n'a pas
changé – vérifiez-le donc avec `cat`. Avec `-i` (*in-place*), `sed` réécrit
plutôt le résultat dans le fichier. Essayez sur une copie :

```sh
cp ~/{{documents}}/{{fruits}} ~/fruits-copie.txt
sed -i 's/kiwi/kiwifruit/' ~/fruits-copie.txt
cat ~/fruits-copie.txt
```

Il n'y a pas d'annulation possible avec `sed -i`. Une bonne méthode consiste
à lancer d'abord la commande **sans** `-i` et à regarder le résultat, puis à
ajouter `-i` quand tout semble correct. Si vous écrivez `-i.bak`, l'original
est aussi sauvegardé sous `fichier.bak`.

```quiz
Vous lancez `sed 's/kiwi/KIWI/' ~/{{documents}}/{{fruits}}`. Qu'arrive-t-il au fichier ?
- [ ] Chaque `kiwi` du fichier devient `KIWI`
- [ ] Seul le premier `kiwi` du fichier devient `KIWI`
- [x] Rien – le résultat est seulement affiché, le fichier reste inchangé
---
Sans `-i`, `sed` écrit uniquement sur stdout. Le fichier reste tel quel.
```

Les fichiers de configuration de `/etc` appartiennent à root, il faut donc y
utiliser `sudo sed -i ...`. C'est une façon courante de modifier un réglage
depuis un script sans ouvrir d'éditeur de texte.

## Découper des champs – `cut`

Quand un fichier est constitué de champs séparés par un séparateur, `cut`
peut en extraire un. `-d` choisit le séparateur (*delimiter*) et `-f` le champ
à garder. Voici les matières – le champ 2 – du fichier CSV :

```sh
cut -d, -f2 ~/{{documents}}/{{grades}}
```

Dans `/etc/passwd`, les champs sont séparés par des deux-points et le champ 1
est le nom d'utilisateur, donc `cut -d: -f1 /etc/passwd` liste tous les
utilisateurs. Comme les autres filtres, `cut` trouve sa place dans un pipe –
par exemple devant `tr`.

## Les colonnes – `awk`

`awk` est en réalité tout un petit langage de programmation, mais la plupart
du temps on l'utilise pour une seule chose : travailler avec des
**colonnes**. awk découpe chaque ligne en *champs* :

| Champ | Signifie |
|---|---|
| `$1`, `$2` … | le premier, le deuxième … champ |
| `$0` | la ligne entière |
| `NF` | le nombre de champs de la ligne (*number of fields*) |
| `$NF` | le dernier champ |
| `NR` | le numéro de ligne (*number of record*) |

Par défaut, les champs sont séparés par des espaces (en nombre quelconque).
Dans `server.log`, le champ 3 est le niveau de log :

```sh
awk '{print $3}' ~/{{documents}}/server.log
```

Le programme se place entre `{ }` et s'exécute pour chaque ligne. Mettez
toujours le programme awk entre apostrophes **simples** – sinon le shell
croit que `$3` est une variable du shell et la remplace avant même que awk
ne démarre.

awk trouve parfaitement sa place dans un pipe. Combien y a-t-il de lignes de
chaque niveau ?

```sh
awk '{print $3}' ~/{{documents}}/server.log | sort | uniq -c
```

### D'autres séparateurs – `-F`

Avec `-F`, vous choisissez le séparateur de champs. Dans `/etc/passwd`, c'est
un deux-points ; le champ 1 est le nom d'utilisateur et le champ 7 le shell :

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

La virgule dans `print` devient un espace dans la sortie. Sans virgule, les
champs sont collés ensemble, et vous pouvez alors y mêler votre propre
texte :

```sh
awk -F: '{print $1 " utilise " $7}' /etc/passwd
```

Comparez avec `cut -d: -f1` de la section précédente. La différence, c'est
que awk peut réordonner les champs, y mêler du texte et gérer plusieurs
espaces consécutifs.

```predict
$ echo "Alva,maths,87" | awk -F, '{print $3, $1}'
87 Alva
---
`-F,` découpe la ligne aux virgules. awk affiche d'abord le champ 3, puis le
champ 1, avec une espace entre les deux grâce à la virgule dans `print`.
```

### Les motifs – choisir les lignes

Avant les `{ }`, vous pouvez écrire un *motif*. Le programme ne s'exécute
alors que pour les lignes qui correspondent. Le motif peut être une
expression régulière, comme dans `grep` :

```sh
awk '/ERROR/ {print $2}' ~/{{documents}}/server.log
```

… ou une condition. Le texte se met entre guillemets doubles :

```sh
awk -F, '$2 == "maths" {print $1, $3}' ~/{{documents}}/{{grades}}
```

Les comparaisons s'écrivent `==`,
`!=`, `<`, `<=`, `>` et `>=`, et les conditions se combinent avec `&&` (et),
`||` (ou) et `!` (non). Voici tous les élèves qui ont au moins 90 points
(sans `{ }`, la ligne entière est affichée) :

```sh
awk -F, '$3 >= 90' ~/{{documents}}/{{grades}}
```

Vous avez aussi obtenu la ligne d'en-tête ? Dans celle-ci, le champ 3 est le
mot `points`, et quand une valeur n'est pas un nombre, awk la compare comme du
*texte* – et `"points"` vient après `"90"` dans l'ordre alphabétique. On saute
l'en-tête avec `NR > 1` :

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/{{documents}}/{{grades}}
```

Essayez un motif de votre cru – les noms de tous ceux qui étudient le
français :

```try
awk -F, '$2 == "français" {print $1}' ~/{{documents}}/{{grades}}
```

### Compter – les variables et `END`

awk possède des variables qu'il n'est pas nécessaire de déclarer – elles
commencent à 0. Le bloc `END { }` s'exécute une seule fois, **après** la
dernière ligne. Ensemble, ils permettent d'additionner facilement une
colonne :

```sh
awk -F, 'NR > 1 {{{sumVar}} += $3} END {print {{sumVar}}}' ~/{{documents}}/{{grades}}
```

`{{sumVar}} += $3` signifie « ajouter le champ 3 à {{sumVar}} ». Si vous comptez
les lignes en même temps (`nombre++` augmente `nombre` de 1), vous pouvez
calculer la moyenne :

```sh
awk -F, 'NR > 1 {{{sumVar}} += $3; nombre++} END {print "Moyenne :", {{sumVar}} / nombre}' ~/{{documents}}/{{grades}}
```

Il existe aussi `BEGIN { }`, qui s'exécute **avant** la première ligne –
pratique pour les titres. Et avec `printf`, vous décidez exactement de
l'allure de la sortie : `%-8s` est du texte aligné à gauche sur 8 caractères
et `%5d` un entier sur 5 caractères.

```sh
awk -F, 'BEGIN {print "Élève    Notes"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/{{documents}}/{{grades}}
```

awk dispose aussi de fonctions, comme `length()`, `toupper()` et `tolower()` :

```sh
awk '{print toupper($0)}' ~/{{documents}}/{{grades}}
```

Regardez bien `matière` et `français`. Sur Ubuntu, qui fait tourner le terminal
ici, `awk` est par défaut **mawk**, une variante petite et rapide. Pour des
programmes simples comme ceux-ci, vous ne verrez aucune différence – mais mawk
ne convertit pas è et ç avec `toupper()`. **GNU awk** (le paquet `gawk`),
lui, le fait, contrairement à `tr`. Les distributions diffèrent quant à l'awk
qu'elles utilisent et à la façon d'installer des logiciels – nous y viendrons
dans le chapitre sur les distributions.

Le simulateur ne connaît qu'une partie du langage awk – ce qui est présenté
ici et un peu plus (`if`, boucles et tableaux). Voir `man awk`.

## Quel outil choisir ?

| Vous voulez … | Utilisez |
|---|---|
| trouver les lignes qui contiennent quelque chose | `grep` |
| remplacer ou supprimer des caractères isolés | `tr` |
| remplacer des mots ou des motifs, supprimer des lignes | `sed` |
| extraire des colonnes, comparer des nombres, additionner | `awk` |

La vraie puissance vient de leur combinaison. Quels niveaux trouve-t-on parmi
les lignes qui ne sont *pas* INFO – sans tenir compte des majuscules et
minuscules ?

```sh
grep -v INFO ~/{{documents}}/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
