# Liens et informations sur les fichiers

Sous Linux, le nom d'un fichier et son contenu sont deux choses différentes.
Dans ce chapitre, vous en profitez pour créer des raccourcis avec des
**liens**, vous apprenez à examiner des fichiers avec `stat` et `file`, et vous
décidez avec `umask` quelles permissions reçoivent les nouveaux fichiers.

## Noms et inodes

Le contenu d'un fichier – avec son propriétaire, ses permissions et ses dates –
est stocké dans un **inode**. Un répertoire n'est qu'une liste de noms, et
chaque nom pointe vers un inode. `ls -i` affiche le numéro d'inode devant
chaque nom :

```sh
ls -i
```

## Liens symboliques – `ln -s`

Un **lien symbolique** (*symlink*) est un petit fichier qui contient le chemin
vers autre chose – un raccourci. La cible vient en premier et le nom du lien en
dernier, exactement comme avec `cp` :

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

Le `l` en début de ligne et la flèche `->` montrent qu'il s'agit d'un lien. Ses
permissions sont toujours `rwxrwxrwx` – elles n'ont aucune importance, ce qui
compte, ce sont les permissions de la cible.

Presque toutes les commandes suivent le lien : `ls ~/log/`, `cat`, `cd` et
ainsi de suite. `cd` se souvient du chemin par lequel vous êtes arrivé, et
`pwd -P` montre où vous êtes vraiment :

```sh
cd ~/log
pwd
pwd -P
```

### Liens relatifs

Un chemin relatif dans un lien part du répertoire **où se trouve le lien** – et
non de celui où vous êtes quand vous le créez :

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

Cela fonctionne, car le lien se trouve dans votre répertoire personnel et
`{{documents}}/{{fruits}}` s'y trouve aussi. Un lien `/tmp/f` avec le même
contenu chercherait `/tmp/{{documents}}/{{fruits}}` – et serait cassé.

`readlink` affiche ce que contient un lien, et `realpath` affiche le chemin
complet, en suivant tous les liens :

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### Liens cassés

Un lien peut pointer vers quelque chose qui n'existe pas :

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
Le lien existe, mais pas le fichier vers lequel il pointe. `ls -l` affiche un
lien cassé en rouge, et `find ~ -type l` trouve tous les liens de votre
répertoire personnel.
```

`rm` supprime le lien lui-même, jamais ce vers quoi il pointe.

```quiz
Vous avez le lien `~/log -> /var/log` et vous lancez `rm ~/log`. Que se passe-t-il ?
- [ ] `/var/log` et tout ce qu'il contient sont supprimés
- [x] Seul le lien est supprimé – `/var/log` n'est pas touché
- [ ] `rm` refuse, car `~/log` est un répertoire
---
`rm` agit sur le lien lui-même. Pour supprimer la cible, il faudrait nommer la
cible.
```

### Où vous rencontrez des liens

Les liens sont partout dans un système Linux. `python3` est souvent un lien
vers une version précise, comme `python3.12`, et quand vous ferez plus tard
démarrer un service au boot avec `systemctl enable`, systemd créera un lien
vers son fichier d'unit. Regardez les services qui démarrent au boot :

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Liens physiques – `ln`

Sans `-s`, `ln` crée un **lien physique** : un nom de plus pour le même inode.

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 231 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 231 Nov  3 10:20 {{todo}}
```

Les deux noms ont le même numéro d'inode, et le nombre après les permissions –
le **compteur de liens** – vaut maintenant 2. C'est le même fichier : une
modification faite par un nom se voit par l'autre. Si vous supprimez l'un des
noms, le contenu survit tant que le fichier a encore au moins un nom.

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` et `b.txt` étaient le même fichier. La ligne écrite par `b.txt` est
toujours là après la suppression de `b.txt`.
```

| | Lien symbolique (`ln -s`) | Lien physique (`ln`) |
|---|---|---|
| Est | Un petit fichier contenant un chemin | Un nom de plus pour le même inode |
| Vers un répertoire | Oui | Non |
| Vers un autre système de fichiers | Oui | Non – les inodes appartiennent à un seul système de fichiers |
| Si l'original est supprimé | Le lien est cassé | Le fichier survit |
| Dans `ls -l` | `l` et `->` | Le compteur de liens augmente |

```quiz
Quel type de lien peut pointer vers un répertoire ?
- [x] Seulement un lien symbolique
- [ ] Seulement un lien physique
- [ ] Les deux
---
Les liens physiques vers des répertoires sont interdits. Pour un raccourci vers
un répertoire, on utilise `ln -s`.
```

## Tout sur un fichier – `stat`

`stat` affiche tout ce que sait l'inode :

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

Vous obtenez la taille, le numéro d'inode, le nombre de liens, les permissions
à la fois en chiffres (`0644`) et en lettres, le propriétaire et le groupe, et
les dates auxquelles le fichier a été lu, son contenu modifié et ses
propriétés changées. Avec `-c`, vous choisissez exactement quoi afficher : `%a`
donne les permissions en chiffres, `%U` le propriétaire et `%n` le nom.

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## Qu'y a-t-il dedans ? – `file`

Linux se moque des extensions de nom de fichier : un fichier appelé `.jpg` peut
contenir n'importe quoi. `file` regarde plutôt le contenu :

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
Le nom se termine par `.jpg`, mais le contenu est du texte – et c'est sur cela
que `file` se base.
```

## Les permissions des nouveaux fichiers – `umask`

Les nouveaux fichiers reçoivent les permissions `rw-rw-rw-` (666) et les
nouveaux répertoires `rwxrwxrwx` (777) – moins les bits du **umask**. `umask`
l'affiche :

```sh
umask
```

Le umask habituel `0022` retire le droit d'écriture au groupe et aux autres,
c'est pourquoi vos fichiers reçoivent `644` et vos répertoires `755`.

| umask | Nouveaux fichiers | Nouveaux répertoires | Signifie |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | L'habituel |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | Le groupe peut lire, les autres rien |
| `077` | `600` `rw-------` | `700` `rwx------` | Vous seul |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 moins 027 : le groupe perd `w`, et les autres perdent tout.
```

`umask` n'agit que sur les fichiers créés ensuite, et seulement dans le shell
où vous l'avez lancé. Pour garder un umask, mettez la ligne dans `~/.bashrc`.

```quiz
Votre umask est `077`. Quelles permissions reçoit un nouveau répertoire ?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
Les répertoires partent de 777. 777 moins 077 donne 700 : tout pour vous, rien
pour les autres.
```
