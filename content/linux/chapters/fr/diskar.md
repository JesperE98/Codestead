# Disques et systèmes de fichiers

Où finissent réellement les fichiers que vous enregistrez ? Sous Windows, la
réponse est une lettre – `C:`, `D:`, `E:`. Linux n'a pas du tout de lettres de
lecteur, seulement **une** arborescence de répertoires qui commence à `/`.
Dans ce chapitre, vous regardez sous le capot : quels disques possède
l'ordinateur, comment ils sont découpés, combien de place il reste – et
comment brancher une clé USB puis la retirer sans rien perdre.

## Disque, partition et système de fichiers

Trois mots qu'on confond souvent, mais qui désignent des choses différentes :

- Un **disque** est le support de stockage lui-même : un SSD, un disque dur,
  une carte SD ou une clé USB.
- Une **partition** est un morceau du disque. Un disque peut être découpé en
  plusieurs partitions qui servent à des choses différentes. L'endroit où
  chaque partition commence et se termine est enregistré dans la **table des
  partitions** du disque – du type **GPT** sur les ordinateurs récents, et
  l'ancien **MBR** (que les outils appellent `dos`) sur les ordinateurs plus
  anciens et la plupart des clés USB.
- Un **système de fichiers** est l'organisation *à l'intérieur* d'une
  partition : la façon dont les noms de fichiers, les répertoires, les
  permissions et le contenu lui-même sont stockés. Une nouvelle partition est
  vide et inutilisable tant que vous n'y avez pas créé de système de fichiers
  – c'est ce que signifie **formater**.

Imaginez le disque comme un entrepôt vide, les partitions comme les murs qui
le divisent en pièces et le système de fichiers comme les étagères et les
étiquettes de chaque pièce. Sans étagères, on ne retrouve rien.

```quiz
Vous venez de créer une nouvelle partition sur un disque. Pourquoi ne
pouvez-vous pas encore y enregistrer de fichiers ?
- [ ] Elle doit d'abord être ajoutée à la table des partitions
- [x] Elle n'a pas encore de système de fichiers – il faut d'abord la formater
- [ ] Les partitions ne peuvent pas contenir de fichiers, seuls les disques le peuvent
- [ ] Elle doit d'abord recevoir une lettre de lecteur
---
Une nouvelle partition est vide et inutilisable tant que vous n'y avez pas
créé de système de fichiers. C'est ce que signifie formater.
```

## Les disques sont des fichiers dans `/dev`

Sous Linux, presque tout est un fichier – les disques aussi. Chaque disque et
chaque partition a un **fichier de périphérique** dans `/dev` :

```sh
ls -l /dev/sd*
```

| Fichier de périphérique | Est |
|---|---|
| `/dev/sda` | Le premier disque (SATA, USB ou disque virtuel) |
| `/dev/sda1`, `/dev/sda2` | Les partitions 1 et 2 de `sda` |
| `/dev/sdb` | Le deuxième disque – la clé USB de cet ordinateur |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | Un SSD NVMe et sa première partition |
| `/dev/vda` | Un disque dans une machine virtuelle |
| `/dev/mmcblk0p1` | La première partition d'une carte SD (par ex. dans un Raspberry Pi) |

Les lettres sont attribuées dans l'ordre où les disques sont détectés. Si
l'ordinateur a un SSD NVMe, une clé USB peut très bien devenir `sda` – donc
**ne devinez jamais**, vérifiez toujours. Les fichiers de périphérique
appartiennent à root et au groupe `disk` ; en tant qu'utilisateur ordinaire,
vous ne pouvez donc pas lire les disques directement.

## Quels disques y a-t-il ? – `lsblk`

`lsblk` (*list block devices*) dessine les disques sous forme d'arbre, avec
les partitions sous chaque disque :

```sh
lsblk
```

| Colonne | Signifie |
|---|---|
| `NAME` | Le nom dans `/dev` |
| `RM` | 1 = amovible, par ex. une clé USB |
| `SIZE` | La taille |
| `TYPE` | `disk` ou `part` (partition) |
| `MOUNTPOINTS` | L'endroit où le système de fichiers apparaît dans l'arborescence, `[SWAP]` pour le swap |

Sur cet ordinateur, `sda1` est la **partition EFI** (depuis laquelle le
firmware de l'ordinateur démarre) sur `/boot/efi`, `sda2` est le **système de
fichiers racine** `/` et `sda3` est le **swap**. D'autres distributions – et
d'autres installations – peuvent découper le disque autrement, alors regardez
toujours au lieu de supposer.

Avec `-f`, `lsblk` affiche aussi les systèmes de fichiers – type, étiquette,
UUID et espace libre :

```sh
lsblk -f
```

Remarquez `sdb1` : un système de fichiers `vfat` portant l'étiquette
`USBMINNE` (« mémoire USB » en suédois) qui n'est monté nulle part. C'est la
clé USB que nous allons brancher.

## Les différents systèmes de fichiers

Il existe de nombreux systèmes de fichiers, avec des points forts différents :

| Système de fichiers | Sert à |
|---|---|
| `ext4` | Le standard Linux classique. Stable et rapide – Debian et Ubuntu l'utilisent |
| `btrfs` | Snapshots, compression et sous-volumes. Par défaut sur Fedora et openSUSE |
| `xfs` | Performant avec les gros fichiers et sur les serveurs. Par défaut sur Red Hat Enterprise Linux |
| `vfat` (FAT32) | Fonctionne partout : Windows, macOS, appareils photo, autoradios. Pas de permissions Linux et au maximum 4 Gio par fichier. La partition EFI doit être en FAT |
| `exfat` | Comme FAT, mais sans la limite de 4 Gio. Courant sur les clés USB et cartes SD récentes |
| `ntfs` | Le système de fichiers de Windows. Linux sait le lire et l'écrire |
| `swap` | Pas un système de fichiers pour des fichiers – de la « mémoire » supplémentaire sur le disque |
| `tmpfs` | Un système de fichiers qui n'existe qu'en RAM et disparaît au redémarrage |

## Tout est un seul arbre – le montage

**Monter** un système de fichiers, c'est l'accrocher à l'arborescence à un
répertoire donné, un **point de montage**. Le système de fichiers racine est
monté sur `/`, et tout le reste est accroché quelque part en dessous. C'est
pour cela que Linux se passe de lettres de lecteur : un autre disque n'est
qu'un répertoire de plus.

`findmnt` affiche tous les montages sous forme d'arbre :

```sh
findmnt
```

Et `mount` sans argument liste la même chose, une ligne par système de
fichiers :

```sh
mount
```

Vous voyez aussi des choses qui ne sont pas des disques : `proc` sur `/proc`
et `sysfs` sur `/sys` sont les informations du noyau déguisées en fichiers, et
les `tmpfs` sont des systèmes de fichiers en RAM. Points de montage courants :

| Répertoire | Sert à |
|---|---|
| `/` | Le système de fichiers racine |
| `/boot`, `/boot/efi` | Le noyau et la partition EFI |
| `/mnt` | Les montages temporaires que vous faites à la main |
| `/media/{{user}}/…` ou `/run/media/{{user}}/…` | Là où le bureau monte automatiquement les clés USB |

## Combien de place reste-t-il ? – `df`

`df` (*disk free*) affiche le taux de remplissage de chaque système de
fichiers monté. Avec `-h`, vous obtenez des tailles lisibles par un humain :

```sh
df -h
```

| Colonne | Signifie |
|---|---|
| `Filesystem` | Où se trouve le système de fichiers, par ex. une partition ou `tmpfs` |
| `Size`, `Used`, `Avail` | Taille, espace utilisé et disponible |
| `Use%` | Le taux de remplissage |
| `Mounted on` | Le point de montage |

`-T` ajoute le type de système de fichiers, et si vous donnez un chemin, seul
le système de fichiers sur lequel il se trouve est affiché :

```sh
df -hT
df -h ~
```

Vous remarquez que `Used` et `Avail` ne font pas tout à fait `Size` ? ext4
réserve 5 % à root, pour que le système continue de fonctionner même quand un
utilisateur ordinaire a rempli le disque.

```try
df -hT
---
La colonne `Type` montre que `/` est en `ext4` et `/boot/efi` en `vfat`.
```

## `df` ou `du` ?

Deux commandes au nom presque identique, mais qui répondent à des questions
différentes :

| Question | Commande |
|---|---|
| Le **disque** est-il plein ? | `df -h` – interroge le système de fichiers |
| Combien de place prennent ces **fichiers** ? | `du -sh répertoire` – parcourt les fichiers et additionne |

Quand un disque se remplit, on utilise les deux : d'abord `df -h` pour voir
*quel* système de fichiers est plein, puis `du` pour trouver *ce qui* prend la
place :

```sh
du -h -d 1 ~
```

## Monter une clé USB

Branchons maintenant la clé USB. D'abord : de quel périphérique s'agit-il ?
`lsblk -f` montrait un disque amovible, `sdb`, avec la partition `sdb1`
étiquetée `USBMINNE`. C'est la **partition** que l'on monte, pas le disque
entier.

Il faut ensuite un point de montage – un répertoire ordinaire et vide. Le
créer comme monter nécessitent les droits root :

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

`mount` reconnaît tout seul le système de fichiers FAT ; si vous voulez être
explicite, vous pouvez ajouter `-t vfat`. Les fichiers de la clé apparaissent
maintenant dans le répertoire :

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

À partir de là, la clé fonctionne comme n'importe quel autre répertoire.
Copiez un fichier dans votre répertoire personnel :

```sh
cp /mnt/usb/{{todo}} ~
```

> **Pourquoi tout appartient-il à root ?** FAT n'a pas de permissions Linux.
> Quand une clé FAT est montée, *tous* les fichiers reçoivent donc le même
> propriétaire et les mêmes permissions – le propriétaire est celui qui l'a
> montée, c'est-à-dire root. Pour écrire sur la clé, il vous faut soit `sudo`,
> soit la monter de façon à en devenir propriétaire :
> `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb` (1000 est votre
> identifiant d'utilisateur – voir `id`).

Vous pouvez aussi monter par étiquette plutôt que par nom de périphérique :
`sudo mount LABEL=USBMINNE /mnt/usb`. Sur un ordinateur avec un environnement
de bureau, le gestionnaire de fichiers fait tout cela automatiquement quand
vous branchez la clé.

```quiz
Après `sudo mount /dev/sdb1 /mnt/usb`, tous les fichiers de la clé FAT
appartiennent à root. Pourquoi ?
- [ ] Les fichiers ont été créés par root sur un autre ordinateur
- [x] FAT n'a pas de permissions Linux, donc tous les fichiers reçoivent comme propriétaire celui qui l'a montée – root
- [ ] Tout ce qui se trouve dans `/mnt` appartient toujours à root
- [ ] Les clés USB ne peuvent être utilisées que par root
---
Avec `-o uid=1000,gid=1000`, vous pouvez choisir vous-même le propriétaire au
moment du montage.
```

## Démonter – avant de retirer la clé !

Linux n'écrit pas toujours immédiatement sur le disque. Les modifications sont
rassemblées en RAM (*cache*) et écrites un peu plus tard, parce que c'est
beaucoup plus rapide. Si vous retirez une clé encore montée, des fichiers que
vous avez « enregistrés » peuvent manquer ou être abîmés. C'est pourquoi on
**démonte** d'abord – cela s'écrit `umount`, sans n :

```text
sudo umount /mnt/usb
```

`umount` écrit tout ce qui est en attente, puis détache le système de
fichiers. Quand l'invite revient, vous pouvez retirer la clé sans risque.
(`sync` écrit lui aussi tout ce qui est en attente, mais sans démonter.)

Si quelque chose utilise le système de fichiers, `umount` refuse :

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

Ici, c'est votre propre shell qui se trouve dans le répertoire. Sortez-en avec
`cd ~` et réessayez. Après le démontage, `/mnt/usb` redevient un répertoire
vide – mais les fichiers, et les modifications que vous avez faites, sont
toujours sur la clé la prochaine fois que vous la monterez.

```quiz
Pourquoi faut-il démonter une clé USB avant de la retirer ?
- [ ] Sinon, les fichiers de la clé sont supprimés
- [x] Des modifications peuvent encore attendre en RAM – `umount` les écrit avant de détacher le système de fichiers
- [ ] Sinon, la clé reçoit un nouveau nom de périphérique la fois suivante
- [ ] La clé ne peut pas être remontée tant qu'elle n'a pas été démontée sur le même ordinateur
---
Linux rassemble les modifications en RAM (*cache*) et les écrit un peu plus
tard. Une clé retirée alors qu'elle est encore montée peut perdre des
fichiers que vous aviez « enregistrés ».
```

## `/etc/fstab` – ce qui est monté au démarrage

Le système de fichiers racine, `/boot` et le swap sont montés automatiquement
à chaque démarrage de l'ordinateur. Ce qui doit être monté est listé dans le
fichier `/etc/fstab` (*file system table*) :

```sh
cat /etc/fstab
```

Chaque ligne comporte six colonnes :

| Colonne | Exemple | Signifie |
|---|---|---|
| Périphérique | `UUID=3f1c…` | Quel système de fichiers |
| Point de montage | `/` | Où dans l'arborescence (`none` pour le swap) |
| Type | `ext4` | Le type de système de fichiers |
| Options | `defaults`, `errors=remount-ro` | Options de montage, séparées par des virgules |
| dump | `0` | Ancien indicateur de sauvegarde, presque toujours 0 |
| pass | `1` | L'ordre dans lequel `fsck` les vérifie au démarrage (1 = racine, 2 = les autres, 0 = jamais) |

L'option `errors=remount-ro` signifie que le système de fichiers racine passe
en lecture seule si une erreur est détectée – mieux vaut cela que d'abîmer
davantage. Les commentaires comme `# / was on /dev/sda2 during installation`
ont été écrits par l'installateur.

Pourquoi `UUID=…` et pas simplement `/dev/sda2` ? Les noms de périphériques
peuvent changer – branchez un nouveau disque et l'ancien peut recevoir une
nouvelle lettre. Un UUID est créé en même temps que le système de fichiers et
ne change jamais. Vous le trouvez avec `lsblk -f`, `blkid` ou `findmnt` :

```sh
sudo blkid
findmnt -n -o UUID /
```

Avec `findmnt`, `-o` choisit les colonnes à afficher et `-n` supprime
l'en-tête – pratique quand vous ne voulez que la valeur elle-même.

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
`/boot/efi` est la partition EFI, et la partition EFI doit être en FAT.
```

Si vous voulez que la clé puisse toujours être montée sur `/mnt/usb`, vous
pouvez ajouter une ligne comme celle-ci :

```text
LABEL=USBMINNE  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` signifie qu'elle n'est pas montée au démarrage (la clé n'est
peut-être pas branchée), et `user` que les utilisateurs ordinaires ont le
droit de la monter – `mount /mnt/usb` suffit alors, sans `sudo`.

> **Attention :** une erreur dans `/etc/fstab` peut empêcher l'ordinateur de
> démarrer correctement. Testez toujours vos modifications avec
> `sudo mount -a`, qui monte tout ce qui figure dans le fichier et n'est pas
> encore monté, *avant* de redémarrer. Pour les disques externes qui ne sont
> pas toujours branchés, ajoutez l'option `nofail`.

## Le swap

Le **swap** est un espace utilisé quand la RAM vient à manquer : les parties
de la mémoire qui ne servent pas en ce moment y sont déplacées, pour que les
programmes tiennent. Le swap est bien plus lent que la RAM ; un ordinateur qui
swappe beaucoup devient donc poussif – mais c'est mieux que des programmes qui
plantent.

```sh
swapon --show
free -h
```

Ici, le swap est une partition à part entière, `sda3`. Beaucoup
d'installations (par exemple les Ubuntu récents) utilisent plutôt un *fichier
d'échange* (*swap file*) sur le système de fichiers racine.

## Partitionner et formater – avec la plus grande prudence

`fdisk -l` affiche les tables des partitions de tous les disques, avec le
début et la fin de chaque partition et son type. Il faut les droits root :

```sh
sudo fdisk -l
```

Avec `fdisk` (sans `-l`), `parted` ou l'outil graphique `gparted`, vous pouvez
modifier la table des partitions, et avec `mkfs` vous créez un nouveau système
de fichiers – vous formatez :

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBMINNE /dev/sdb1    # FAT32 – fonctionne partout
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4 – permissions Linux, mais uniquement sous Linux
```

> **Attention !** `fdisk` et `mkfs` font partie des commandes les plus
> dangereuses qui existent. Une seule lettre de travers – `sda` au lieu de
> `sdb` – et tout le disque système est perdu. Avant de formater quoi que ce
> soit sur un vrai ordinateur : vérifiez avec `lsblk -f` que la taille, la
> colonne `RM` et l'étiquette correspondent, assurez-vous que la partition
> n'est pas montée, et ayez une sauvegarde de tout ce qui est important.

Dans le simulateur, vous pouvez essayer `mkfs.ext4` et `mkfs.vfat` sur la clé
USB – mais faites d'abord les exercices, car les fichiers de la clé
disparaissent. Les partitions du système sont protégées parce qu'elles sont
montées, exactement comme sur un vrai système.

## Résumé

| Commande | Fait |
|---|---|
| `lsblk`, `lsblk -f` | Affiche les disques, les partitions et les systèmes de fichiers |
| `blkid` | Affiche le type, l'étiquette et l'UUID |
| `df -h` | Quel est le taux de remplissage des systèmes de fichiers ? |
| `du -sh répertoire` | Combien de place prennent les fichiers ? |
| `findmnt`, `mount` | Qu'est-ce qui est monté, et où ? |
| `sudo mount /dev/sdb1 /mnt/usb` | Monte un système de fichiers |
| `sudo umount /mnt/usb` | Démonte – avant de retirer la clé |
| `cat /etc/fstab` | Qu'est-ce qui est monté au démarrage ? |
| `swapon --show` | Affiche le swap |
| `sudo fdisk -l` | Affiche les tables des partitions |
