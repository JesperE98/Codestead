# Lire et rechercher du texte

Presque tout, sous Linux, est du texte : les réglages, les journaux, les
listes. C'est pourquoi il existe une foule de petits outils pour lire et
rechercher dans des fichiers texte. Dans votre répertoire personnel se trouve
un répertoire `dokument` avec des fichiers pour vous entraîner, dont
`frukter.txt` (une liste de fruits) et `server.log` (le journal d'un serveur
web imaginaire). Leur contenu est en suédois, mais les mots que vous allez
chercher – `INFO`, `WARN` et `ERROR` – sont les mêmes que dans de vrais logs.

## Afficher un fichier – `cat` et `less`

`cat` affiche le fichier en entier :

```sh
cat dokument/frukter.txt
```

Pour les fichiers longs, `less` est plus pratique. On y fait défiler le texte
avec les flèches et la barre d'espace, on cherche avec `/mot` et on quitte
avec `q`.

Regardez la liste des fruits – vous en aurez besoin pour la question suivante :

```try
cat dokument/frukter.txt
```

## Le début et la fin – `head` et `tail`

`head` affiche les premières lignes et `tail` les dernières. Par défaut, c'est
10 lignes, mais vous pouvez choisir avec `-n` :

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` *suit* un fichier et affiche les nouvelles lignes au fur et à mesure
qu'elles sont écrites – parfait pour les logs. Arrêtez-le avec **Ctrl+C**.

```predict
$ tail -n 1 dokument/frukter.txt
mango
---
`tail -n 1` n'affiche que la toute dernière ligne.
```

## Compter – `wc`

`wc` (*word count*) compte les lignes, les mots et les octets :

```sh
wc dokument/frukter.txt
```

Souvent, on ne veut que le nombre de lignes : `wc -l`.

## Rechercher – `grep`

`grep` est l'une des commandes les plus utiles qui soient. Elle affiche toutes
les lignes qui contiennent un motif :

```sh
grep INFO dokument/server.log
```

Quelques options que vous utiliserez souvent :

| Option | Signification |
|---|---|
| `-i` | Ignorer la différence entre majuscules et minuscules |
| `-n` | Afficher les numéros de ligne |
| `-v` | Afficher les lignes qui ne correspondent *pas* |
| `-c` | Compter les lignes qui correspondent |
| `-r` | Chercher récursivement dans tous les fichiers d'un répertoire |
| `-E` | Motifs étendus, p. ex. `"ERROR|WARN"` |

```sh
grep -n WARN dokument/server.log
```

Le motif est une *expression régulière* (regex). Quelques exemples : `^`
désigne le début de la ligne et `$` la fin de la ligne, donc `grep "^2026"`
trouve les lignes qui commencent par 2026.

```quiz
`server.log` contient deux lignes avec `WARN` et une ligne avec `warn` en
minuscules. Qu'affiche `grep -c WARN dokument/server.log` ?
- [ ] 1
- [x] 2
- [ ] 3
---
`-c` compte les lignes qui correspondent, et sans `-i`, majuscules et
minuscules sont différentes. `grep -ic WARN` compterait les trois.
```

```quiz
Quelle commande affiche toutes les lignes de `server.log` qui ne contiennent **pas** `INFO` ?
- [ ] `grep -i INFO dokument/server.log`
- [ ] `grep -c INFO dokument/server.log`
- [x] `grep -v INFO dokument/server.log`
```

## Trier – `sort` et `uniq`

`sort` trie les lignes par ordre alphabétique (`-n` pour les nombres, `-r`
pour l'ordre inverse). `uniq` supprime les lignes identiques à la ligne
*juste au-dessus* – c'est pourquoi on l'utilise presque toujours après
`sort` :

```sh
sort dokument/frukter.txt
```

```quiz
Pourquoi utilise-t-on presque toujours `uniq` après `sort` ?
- [ ] `uniq` ne fonctionne que sur des fichiers triés et échoue sinon
- [x] `uniq` ne supprime que les lignes identiques à la ligne juste au-dessus, donc les lignes identiques doivent se suivre
- [ ] `sort` supprime les doublons et `uniq` les remet
```

## Le manuel – `man`

Vous avez oublié ce que fait une option ? Chaque commande a sa page de
manuel :

```sh
man grep
```
