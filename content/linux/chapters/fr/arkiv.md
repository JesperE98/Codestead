# Archives et compression

Tôt ou tard, vous voudrez envoyer un répertoire entier à quelqu'un, faire une
sauvegarde ou télécharger le code source d'un programme. Il faut alors que de
nombreux fichiers deviennent **un seul** fichier – et de préférence plus
petit. Sous Linux, on s'y prend généralement avec deux programmes différents
qui travaillent ensemble.

## Archiver et compresser – deux choses différentes

- **Archiver**, c'est rassembler de nombreux fichiers et répertoires dans un
  seul fichier, une *archive*. Les permissions, propriétaires et horodatages
  sont conservés. Le programme s'appelle `tar` (de *tape archive* – il a été
  écrit pour les lecteurs de bandes dans les années 1970). Une archive n'est
  **pas** plus petite que les fichiers qu'elle contient – elle est même
  plutôt plus grosse.
- **Compresser**, c'est rendre un fichier plus petit en codant les
  répétitions de manière plus astucieuse. Le programme le plus courant est
  `gzip`. Il ne traite qu'un fichier à la fois et ne connaît rien aux
  répertoires.

C'est pourquoi on les utilise ensemble : d'abord `tar` pour obtenir un seul
fichier, puis `gzip` pour le rendre plus petit. Le résultat s'appelle
`.tar.gz`, ou `.tgz` en abrégé. C'est la philosophie Unix en un mot : de
petits programmes qui font chacun une chose et qu'on peut combiner.

```quiz
Pourquoi utilise-t-on généralement `tar` et `gzip` ensemble ?
- [ ] `gzip` ne sait pas lire les fichiers que `tar` n'a pas créés
- [x] `tar` rassemble de nombreux fichiers en un seul, et `gzip` rend ce fichier plus petit
- [ ] `tar` rend les fichiers plus petits, et `gzip` leur donne les bonnes permissions
---
gzip ne traite qu'un fichier à la fois et ne connaît rien aux répertoires, et
une archive tar seule n'est pas plus petite que les fichiers qu'elle contient.
```

| Extension | Qu'est-ce que c'est ? | Décompresser avec |
|---|---|---|
| `.tar` | Archive, non compressée | `tar -xf` |
| `.gz` | Un seul fichier compressé | `gunzip` |
| `.tar.gz`, `.tgz` | Archive compressée | `tar -xzf` |
| `.zip` | Archive et compression en un (courant sous Windows) | `unzip` |

Vous rencontrerez aussi `.tar.xz`, `.tar.bz2` et `.tar.zst`. Même principe,
mais avec d'autres programmes de compression (`xz`, `bzip2` et `zstd`).

## Empaqueter avec `tar`

Allez dans votre répertoire personnel et empaquetez le répertoire
`dokument` :

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/betyg.csv
dokument/frukter.txt
dokument/server.log
```

`-c` signifie *créer une archive* (*create*), `-v` demande à tar de montrer
ce qu'il fait et `-f` indique que le nom du fichier d'archive vient ensuite.
Tout ce qui suit le nom de l'archive est empaqueté – autant de fichiers et de
répertoires que vous voulez.

> **Attention !** L'ordre est *d'abord l'archive, puis les fichiers*. Si vous
> vous trompez d'ordre, comme dans `tar -cvf dokument dokument.tar`, tar
> essaie d'écraser le répertoire – ou pire, un fichier que vous vouliez
> garder.

## Les options à retenir

| Option | Abréviation de | Signifie |
|---|---|---|
| `c` | **c**reate | Créer une nouvelle archive |
| `x` | e**x**tract | Extraire |
| `t` | lis**t** (*table of contents*) | Lister le contenu |
| `v` | **v**erbose | Afficher les fichiers traités |
| `f` | **f**ile | Le nom du fichier d'archive vient ensuite |
| `z` | g**z**ip | Compresser ou décompresser avec gzip |

Exactement **une** des options `c`, `x` et `t` doit être présente – elle dit
à tar *quoi* faire. Les autres sont des modificateurs. Un moyen mnémotechnique
courant (en anglais) :

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Mettez toujours `f` en **dernier** quand vous collez les options ensemble,
puisque le nom du fichier doit venir juste après. Pour des raisons
historiques, vous pouvez aussi omettre le tiret : `tar czvf` équivaut à
`tar -czvf`.

```quiz
Que fait `tar -xzvf backup.tar.gz` ?
- [ ] Il crée l'archive compressée `backup.tar.gz`
- [ ] Il liste le contenu de `backup.tar.gz` sans l'extraire
- [x] Il extrait `backup.tar.gz` avec gzip et affiche chaque fichier
---
`x` est l'opération (extraire), `z` signifie gzip, `v` affiche les fichiers et
`f` est suivi du nom de l'archive.
```

## Compresser avec `-z`

Ajoutez `z`, et l'archive passe par gzip au passage :

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   837 Oct 30 12:00 dokument.tar.gz
```

L'archive non compressée pèse 10 240 octets, alors que les fichiers font en
tout un peu plus de 1 000 octets. C'est parce que tar place un en-tête de
512 octets devant chaque fichier et complète l'archive jusqu'à des blocs
entiers. Tout cet espace vide disparaît à la compression par gzip.

La commande `du` (*disk usage*) indique combien de place quelque chose occupe
sur le disque. Avec `-h`, vous obtenez des tailles lisibles par un humain, et
avec `-s`, un total pour tout un répertoire :

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
16K	dokument
```

Le disque est divisé en blocs de 4 Kio, donc `du` n'affiche jamais moins de
`4.0K` pour un fichier non vide. Pour voir la taille exacte, utilisez
`ls -l` (ou `ls -lh`).

## Regarder dans une archive avant de l'extraire

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev       146 2026-10-30 12:00 dokument/betyg.csv
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

Avec `v`, le contenu s'affiche comme avec `ls -l`, avec permissions,
propriétaire et taille. Regarder d'abord est une bonne habitude : certaines
archives n'ont pas de répertoire racine commun et éparpillent des centaines
de fichiers là où vous vous trouvez au moment de les extraire.

## Extraire

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C` (C majuscule) choisit le répertoire dans lequel tar extrait (*uppackat*
signifie « décompressé »). Sans cette option, tout atterrit dans le
répertoire où vous êtes. Les versions modernes de tar détectent toutes seules
si une archive est compressée lors de l'extraction, donc
`tar -xf dokument.tar.gz` fonctionne aussi.

> **Attention !** tar ne demande rien avant d'écraser des fichiers qui
> existent déjà. Listez d'abord le contenu si vous avez un doute.

### Les chemins absolus

Si vous empaquetez un chemin absolu, le `/` du début est retiré pour que
l'archive puisse être extraite n'importe où :

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

L'archive contient maintenant `home/elev/dokument/...`. Si vous voulez
seulement `dokument/` dans l'archive, vous pouvez demander à tar de changer
d'abord de répertoire avec `-C` :

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

```quiz
Vous lancez `tar -czf backup.tar.gz -C ~ dokument`. Que contient l'archive ?
- [x] `dokument/` et les fichiers qu'il contient
- [ ] `home/elev/dokument/` et les fichiers qu'il contient
- [ ] `/home/elev/dokument/` et les fichiers qu'il contient
---
`-C ~` demande à tar de passer d'abord dans votre répertoire personnel, donc
les noms dans l'archive commencent à `dokument/`.
```

## Compresser un seul fichier avec `gzip`

`gzip` compresse un fichier et le **remplace** par un fichier `.gz`. Les
permissions et l'horodatage sont conservés :

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` affiche la taille avant et après, et `gunzip` décompresse à nouveau
le fichier :

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

Si vous voulez garder l'original, utilisez `gzip -k` (*keep*). Essayez avec un
tout petit fichier – il devient en fait **plus gros**, car gzip ajoute un
en-tête contenant, entre autres, le nom du fichier :

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

```predict
$ cp dokument/frukter.txt .
$ cp dokument/server.log .
$ gzip frukter.txt
$ gzip -k server.log
$ ls frukter* server*
frukter.txt.gz  server.log  server.log.gz
---
Un simple `gzip` remplace le fichier par un fichier `.gz` ; `-k` garde
l'original.
```

### Lire directement des fichiers compressés

Les anciens fichiers journaux de `/var/log` sont souvent stockés en `.gz` pour
gagner de la place. Avec `zcat`, vous pouvez les lire sans les décompresser –
et le résultat peut passer dans un pipe comme d'habitude :

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` équivaut à `gzip -dc` : décompresser (`d`) vers la sortie standard
(`c`). Sur un vrai système, il existe aussi `zless` et `zgrep`.

## zip – pour partager avec Windows

Le format `.zip` fait les deux à la fois : il rassemble les fichiers *et* les
compresse. Windows et macOS savent ouvrir les fichiers zip sans logiciel
supplémentaire, c'est donc le choix évident quand vous envoyez des fichiers à
quelqu'un qui n'utilise pas Linux. Dans le monde Linux, `.tar.gz` est plus
courant, car il conserve mieux les propriétaires et les permissions.

Les programmes `zip` et `unzip` ne sont pas toujours préinstallés, et dans ce
terminal, vous devez d'abord les installer. On le fait avec le gestionnaire de
paquets – vous apprendrez tout à son sujet dans la partie consacrée aux
distributions et aux paquets. Sur Ubuntu, on procède ainsi :

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` télécharge la liste des paquets disponibles. Sans cela, apt ne
trouve aucun paquet.

Ensuite, empaquetez le répertoire. N'oubliez pas `-r` (*recursive*) – sans
cette option, zip n'ajoute que le répertoire vide, pas les fichiers qu'il
contient :

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/betyg.csv (deflated 17%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

Remarquez que l'ordre est le même que pour tar : d'abord l'archive, puis les
fichiers. `unzip -l` liste le contenu, et `-d` choisit où extraire (le
répertoire est créé s'il n'existe pas) :

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

Si les fichiers existent déjà, unzip les ignore. Avec `unzip -o`, ils sont
écrasés.

```quiz
Vous lancez `zip dokument.zip dokument` sans `-r`. Que contient le fichier zip ?
- [ ] Tous les fichiers de `dokument`
- [x] Seulement le répertoire vide `dokument/`
- [ ] Rien – zip refuse de s'exécuter
---
Sans `-r` (*recursive*), zip n'entre pas dans le répertoire.
```

## Récapitulatif

| Si vous voulez ... | Commande |
|---|---|
| empaqueter et compresser un répertoire | `tar -czvf archive.tar.gz répertoire` |
| voir ce que contient une archive | `tar -tzvf archive.tar.gz` |
| extraire une archive | `tar -xzvf archive.tar.gz` (ajoutez `-C répertoire`) |
| compresser un fichier | `gzip fichier` (ou `gzip -k fichier`) |
| décompresser un fichier `.gz` | `gunzip fichier.gz` |
| lire directement un fichier `.gz` | `zcat fichier.gz` |
| créer ou extraire un fichier zip | `zip -r archive.zip répertoire` · `unzip archive.zip` |
| voir la taille de quelque chose | `du -sh répertoire` · `ls -lh` |
