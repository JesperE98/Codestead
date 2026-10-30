# Naviguer dans le système de fichiers

Linux n'a pas de lettres de lecteur comme `C:`. Tout – disques durs, clés USB,
et même le matériel – se trouve dans **une seule arborescence** de
répertoires qui commence à la **racine**, notée `/`.

## Les répertoires les plus importants

| Répertoire | Contenu |
|---|---|
| `/` | La racine – le sommet de l'arborescence |
| `/home` | Les répertoires personnels des utilisateurs, p. ex. `/home/elev` |
| `/root` | Le répertoire personnel de l'administrateur, root |
| `/etc` | Les réglages du système (fichiers de configuration) |
| `/usr/bin` | Les programmes (commandes) comme `ls` et `cat` |
| `/var/log` | Les fichiers journaux (logs) |
| `/tmp` | Les fichiers temporaires, où tout le monde peut écrire |
| `/dev` | Les périphériques, p. ex. les disques |
| `/proc` | Des informations sur les processus et le noyau |
| `/boot` | Les fichiers nécessaires au démarrage de l'ordinateur |

Cette organisation s'appelle le *Filesystem Hierarchy Standard* (FHS), et elle
est quasiment identique d'une distribution à l'autre.

## Où suis-je ? – `pwd`

`pwd` (*print working directory*) affiche le répertoire dans lequel vous vous
trouvez :

```sh
pwd
```

## Qu'y a-t-il ici ? – `ls`

`ls` liste le contenu d'un répertoire. Sans argument, il affiche le répertoire
où vous êtes, mais vous pouvez aussi en indiquer un autre :

```sh
ls /etc
```

L'option `-l` donne un format long avec plus d'informations :

```sh
ls -l
```

Les fichiers dont le nom commence par un point sont **cachés** et ne sont pas
affichés par défaut. Ce sont souvent des fichiers de réglages, comme
`.bashrc`. L'option `-a` (*all*) les affiche :

```sh
ls -a
```

Les options peuvent se combiner : `ls -la` équivaut à `ls -l -a`.

## Changer de répertoire – `cd`

`cd` (*change directory*) vous déplace dans un autre répertoire :

```sh
cd /var/log
```

Il existe deux sortes de chemins :

- Un chemin **absolu** commence par `/` et part de la racine, p. ex.
  `/var/log`. Il fonctionne où que vous soyez.
- Un chemin **relatif** part du répertoire où vous êtes. Si vous êtes dans
  `/`, vous pouvez atteindre `/var/log` avec simplement `cd var/log`.

Quelques noms spéciaux à connaître :

| Nom | Signifie |
|---|---|
| `.` | Le répertoire où vous êtes |
| `..` | Le répertoire au-dessus (le parent) |
| `~` | Votre répertoire personnel |
| `-` | (uniquement avec `cd`) le répertoire où vous étiez juste avant |

`cd` sans argument vous ramène toujours chez vous.

```sh
cd ..
```

## La complétion avec Tab

Vous avez rarement besoin de taper les noms en entier. Tapez le début, par
exemple `cd /va`, et appuyez sur **Tab** – le shell complète le reste. S'il y
a plusieurs possibilités, elles s'affichent quand vous appuyez sur Tab. Les
utilisateurs Linux expérimentés appuient sur Tab sans arrêt !
